#!/usr/bin/env node
// mount-voz.mjs - monta la locucion en index.html POR ANCLAS, sin estirar ningun cuadro, y baja los SFX que suenan durante la voz.
//
// Entradas: SCRIPT.md (texto y **Anchor:** «palabra» @ t LOCAL del cuadro de cada linea), STORYBOARD.md (Frame N -> frame_id),
//           index.html (data-start real de cada cuadro el-<frame_id>), datos/voz-alineacion.json (generar-voz.mjs: instante de cada
//           caracter) y datos/sfx-montado.json (mount-sfx.mjs: categoria de cada efecto para el ducking).
// Salida  : bloque <!-- voz:start --> ... <!-- voz:end --> despues del de sfx (un <audio> por linea), ducking de los <audio> sfx
//           (data-volume bajado, el original en data-vol-orig: idempotente) y datos/voz-montada.json.
//
// Colocacion: para cada palabra ancla k, objetivo_k = data-start del cuadro + t_k y t_palabra_k = inicio de la palabra en el clip.
//   data-start de la linea = desplazamiento que minimiza el error maximo entre anclas ((min + max) / 2 de objetivo_k - t_palabra_k); con
//   una sola ancla cae exacta. Error de cualquier ancla > holgura (0.3 s, SINTESIS 4) = ERROR: se ajusta la escena por dentro o se
//   recorta el texto; NUNCA se toca un data-duration ni un data-start de cuadro (prohibido `audio.mjs sync-durations`).
// Habla REAL: el ultimo caracter alineado ('.', '…') arrastra la cola de silencio del clip (hasta ~1 s con la voz de la v4), asi que
//   habla_ini/habla_fin se miden sobre la senal (RMS de 20 ms >= -40 dBFS, el tono de sala queda en ~-45) y la alineacion queda como
//   habla_ini_alineacion/habla_fin_alineacion. Con ellas se calculan huecos entre frases, silencio final, ducking y ventanas de verify-sfx.
// Comprobaciones: nada antes de 0 ni despues del final del video, frases separadas >= 0.12 s (ERROR); costura < 0.3 s, primera palabra
//   antes de 1.0 s, < 1.5 s de silencio al cerrar, ancla dentro de la transicion entrante del cuadro y pico de la mezcla > -1 dBFS (AVISO).
//
// ORDEN: assemble-index -> localizar-gsap -> transitions inject -> mount-sfx -> mount-voz -> render. assemble-index borra ambos bloques;
// mount-sfx reaplica el ducking si la voz ya esta montada.
// Uso: node scripts/mount-voz.mjs [--root <proyecto>] [--dry] [--sin-ducking] [--holgura 0.3]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bandera, leerJson, opcion, r3, raiz, rutas } from './lib/rutas.mjs';
import { leerScript, leerStoryboard, normalizarTexto } from './lib/storyboard.mjs';
import { escribirBloque, leerIndice } from './lib/indice.mjs';
import { VOZ, aplicarDucking } from './lib/voz-lib.mjs';
import { db, leerWav, mezclar } from './lib/sfx-lib.mjs';

const argv = process.argv;
const R = raiz(argv);
const P = rutas(R);
const SECO = bandera(argv, '--dry');
const SIN_DUCKING = bandera(argv, '--sin-ducking');
const mz = VOZ.mezcla;
const HOLGURA = Number(opcion(argv, '--holgura', mz.holgura_ancla_s));
const errores = [], avisos = [];
const morir = (lista) => { console.error(`mount-voz: ${lista.length} error(es); no se escribio nada:\n  ${lista.join('\n  ')}`); process.exit(1); };

for (const [r, que] of [[P.script, 'SCRIPT.md'], [P.storyboard, 'STORYBOARD.md'], [P.index, 'index.html'], [P.vozAlineacion, 'datos/voz-alineacion.json (corre generar-voz.mjs)']]) if (!existsSync(r)) morir([`falta ${que}`]);
const sc = leerScript(readFileSync(P.script, 'utf8'));
if (sc.errores.length) morir(sc.errores);
const sb = leerStoryboard(readFileSync(P.storyboard, 'utf8'));
let html = readFileSync(P.index, 'utf8');
const indice = leerIndice(html);
const alin = leerJson(P.vozAlineacion);
const montado = leerJson(P.sfxMontado);
if (!indice.tieneSfx) avisos.push('index.html no tiene bloque sfx: la voz se monta antes del cierre de #root (corre mount-sfx.mjs antes si hay efectos)');
const total = indice.duracion;
const cuadroDe = Object.fromEntries(indice.cuadros.map((c) => [c.id, c]));

// Indice del primer caracter de `palabra` como palabra completa (sin mayusculas ni acentos) dentro de los caracteres alineados.
function buscarPalabra(caracteres, palabra) {
    const plano = caracteres.map((c) => normalizarTexto(c) || ' ');           // un caracter -> un caracter (o espacio si es puntuacion)
    const texto = plano.map((c) => c[0] ?? ' ').join('');
    const objetivo = normalizarTexto(palabra);
    const re = new RegExp(`(^|[^a-z0-9])(${objetivo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^a-z0-9])`);
    const m = re.exec(texto);
    return m ? m.index + m[1].length : -1;
}

// Inicio y fin del habla sobre la senal de un clip (s, relativos al clip). null si el WAV no se puede leer o no pasa el umbral.
function limitesHabla(ruta, umbralDb = -40) {
    let wav;
    try { wav = leerWav(ruta); } catch { return null; }
    const x = wav.ch[0], h = Math.round(wav.sr * 0.01), w = 2 * h, umbral = 10 ** (umbralDb / 20);
    let ini = null, fin = null;
    for (let i = 0; i + w <= x.length; i += h) {
        let s = 0;
        for (let k = i; k < i + w; k++) s += x[k] * x[k];
        if (Math.sqrt(s / w) >= umbral) { if (ini === null) ini = i / wav.sr; fin = (i + w) / wav.sr; }
    }
    return ini === null ? null : { ini, fin };
}

// ---- 1. colocar cada linea por sus anclas
const filas = [];
for (const l of sc.lineas) {
    const a = alin[l.id];
    if (!a) { errores.push(`Line ${l.numero}: falta su alineacion en datos/voz-alineacion.json (generar-voz.mjs --solo ${l.id})`); continue; }
    if (normalizarTexto(a.texto) !== normalizarTexto(l.texto)) { errores.push(`Line ${l.numero}: el texto cambio desde que se genero la voz ("${a.texto}" -> "${l.texto}"): vuelve a correr generar-voz.mjs`); continue; }
    const f = sb.frames.find((x) => x.numero === l.frame);
    const c = f && cuadroDe[f.frameId];
    if (!c) { errores.push(`Line ${l.numero}: el Frame ${l.frame}${f ? ` (${f.frameId})` : ''} no esta montado en index.html`); continue; }
    const anclas = [];
    for (const an of l.anclas) {
        const i = buscarPalabra(a.caracteres, an.palabra);
        if (i < 0) { errores.push(`Line ${l.numero}: la palabra ancla "${an.palabra}" no esta en "${a.caracteres.join('')}"`); continue; }
        anclas.push({ palabra: an.palabra, tLocal: an.t, objetivo: c.start + an.t, enClip: a.inicio_s[i] });
        const tIn = f.transicion?.dur ?? 0;
        if (an.t < tIn - 1e-9) avisos.push(`Line ${l.numero}: el ancla «${an.palabra}» @ ${an.t} s cae dentro de la transicion entrante de ${f.frameId} (${tIn} s): ahi el cuadro todavia no se ve (SINTESIS 4)`);
    }
    if (anclas.length !== l.anclas.length) continue;
    const desp = anclas.map((x) => x.objetivo - x.enClip);
    const inicio = (Math.min(...desp) + Math.max(...desp)) / 2;
    for (const x of anclas) {
        x.error = r3(inicio + x.enClip - x.objetivo);
        if (Math.abs(x.error) > HOLGURA + 1e-9) errores.push(`Line ${l.numero}: el ancla «${x.palabra}» queda a ${x.error} s de su t (holgura ${HOLGURA} s): la frase real no encaja en la escena; ajusta la escena por dentro o recorta el texto (nunca estires el cuadro)`);
    }
    const habla = a.caracteres.map((ch, k) => (/\S/.test(ch) ? k : -1)).filter((k) => k >= 0);
    const alIni = a.inicio_s[habla[0]], alFin = a.fin_s[habla.at(-1)];
    const real = existsSync(join(R, a.archivo)) ? limitesHabla(join(R, a.archivo)) : null;   // senal medida; la alineacion es el respaldo
    const hIni = real ? Math.max(real.ini, alIni) : alIni, hFin = real ? Math.min(real.fin, alFin) : alFin;
    filas.push({
        id: l.id, frame: l.frame, cuadro: c.id, texto: l.texto, archivo: a.archivo, inicio: r3(inicio), fin: r3(inicio + a.duracion_s),
        habla_ini: r3(inicio + hIni), habla_fin: r3(inicio + hFin), habla_ini_alineacion: r3(inicio + alIni), habla_fin_alineacion: r3(inicio + alFin),
        habla_medida: !!real, duracion: a.duracion_s,
        anclas: anclas.map((x) => ({ palabra: x.palabra, tLocal: x.tLocal, t: r3(x.objetivo), error: x.error })),
        fixture: !!a.fixture,
    });
}
for (const f of filas) if (!existsSync(join(R, f.archivo))) errores.push(`${f.id}: no existe ${f.archivo}`);

// ---- 2. comprobaciones de tiempo
filas.sort((x, y) => x.habla_ini - y.habla_ini);
filas.forEach((f, k) => {
    if (f.inicio < 0) errores.push(`${f.id}: el clip empezaria antes de 0 (${f.inicio} s)`);
    if (total && f.fin > total + 0.05) errores.push(`${f.id}: termina a ${f.fin} s, despues del final del video (${total} s)`);
    const prev = filas[k - 1];
    if (prev) {
        const hueco = f.habla_ini - prev.habla_fin;
        if (hueco < mz.separacion_minima_s) errores.push(`${f.id}: habla a ${f.habla_ini} s y la linea ${prev.id} termina a ${prev.habla_fin} s (separacion ${r3(hueco)} s < ${mz.separacion_minima_s} s)`);
        else if (hueco < mz.costura_s) avisos.push(`${f.id}: solo ${r3(hueco)} s de silencio tras la linea ${prev.id} (SINTESIS 2 pide 0.3-0.5 s en cada costura)`);
    }
});
if (filas.length) {
    if (filas[0].habla_ini < mz.silencio_inicial_s) avisos.push(`la primera palabra suena a ${filas[0].habla_ini} s (SINTESIS 2: 1.0-1.5 s de silencio al abrir)`);
    const cola = total - Math.max(...filas.map((f) => f.habla_fin));
    if (cola < mz.silencio_final_s) avisos.push(`solo ${r3(cola)} s sin voz al cerrar (SINTESIS 2: >= ${mz.silencio_final_s} s)`);
}
if (errores.length) morir(errores);

// ---- 3. bloque de voz (pistas 40/41 alternas: dos lineas contiguas pueden solapar sus colas) + ducking
const lineasAudio = filas.map((f, k) => `      <audio id="voz-${f.id}" src="${f.archivo}" data-start="${f.inicio}" data-duration="${r3(f.duracion + 0.02)}" data-track-index="${40 + (k % 2)}" data-volume="${mz.volumen_voz}"></audio>`);
const antes = html;
html = escribirBloque(html, 'voz', 'generado por scripts/mount-voz.mjs desde SCRIPT.md: data-start = t de la palabra ancla - su instante en el clip', lineasAudio.join('\n'), { despuesDe: 'sfx' });
let detalle = [];
if (!SIN_DUCKING) ({ html, detalle } = aplicarDucking(html, filas, mz, montado?.cues ?? []));
else ({ html } = aplicarDucking(html, [], mz, []));   // --sin-ducking: restaura los volumenes originales

// ---- 4. ningun cuadro cambia (la voz se acomoda al video, no al reves)
const firma = (h) => JSON.stringify({ d: leerIndice(h).duracion, c: leerIndice(h).cuadros });
if (firma(antes) !== firma(html)) morir(['el montaje de la voz cambio la duracion o los cuadros del indice (no deberia ocurrir)']);

// ---- 5. pico de la mezcla completa (SFX con ducking + voz)
const idx2 = leerIndice(html);
const items = [...idx2.sfx, ...idx2.voz].filter((x) => existsSync(join(R, x.src))).map((x) => ({ wav: leerWav(join(R, x.src)), dataStart: x.start, mediaStart: x.mediaStart, dataDuration: x.duration, vol: x.volume }));
const mezcla = items.length ? mezclar(items, total) : { pico: 0, picoT: 0 };
if (db(mezcla.pico) > -1) avisos.push(`pico de la mezcla SFX + voz ${r3(db(mezcla.pico))} dBFS en t=${r3(mezcla.picoT)} s (> -1 dBFS): baja los SFX de ese instante con -NdB en sfx_cues`);

// ---- 6. informe
const habla = filas.reduce((s, f) => s + (f.habla_fin - f.habla_ini), 0);
const palabras = filas.reduce((s, f) => s + f.texto.split(/\s+/).filter(Boolean).length, 0);
console.log(`Voz: ${filas.length} lineas por ancla; ${palabras} palabras, voz ${r3(habla)} s de ${total} s (${Math.round((100 * habla) / total)} %, SINTESIS 2: 65-75 %), ${r3(palabras / Math.max(habla, 1e-6))} palabras/s; ${detalle.length} efectos con ducking; pico SFX + voz ${r3(db(mezcla.pico))} dBFS`);
for (const f of filas) console.log(`  ${f.id} (${f.cuadro})  clip ${f.inicio}-${f.fin}  habla ${f.habla_ini}-${f.habla_fin}  anclas ${f.anclas.map((x) => `«${x.palabra}»@${x.t}${x.error ? ` (${x.error > 0 ? '+' : ''}${x.error})` : ''}`).join(' ')}${f.fixture ? '  [voz de prueba]' : ''}`);
for (const a of avisos) console.log(`AVISO: ${a}`);
if (SECO) { console.log('--dry: no se escribio nada'); process.exit(0); }
writeFileSync(P.index, html);
mkdirSync(P.datos, { recursive: true });
writeFileSync(P.vozMontada, JSON.stringify({ generado: new Date().toISOString(), lineas: filas, ducking: detalle, mezcla: mz, picoMezclaDbFS: r3(db(mezcla.pico)) }, null, 1) + '\n');
console.log('index.html actualizado; detalle en datos/voz-montada.json');
