#!/usr/bin/env node
// verify-sfx.mjs - criterio de aceptacion del sonido de la v4. Falla (codigo 1) si algo no cuadra.
//
// Uso:  node scripts/verify-sfx.mjs [--root <proyecto>] [--video renders/video.mp4] [--tol-ms 33.3] [--solo biblioteca|cues|montaje|render]
//                                   [--lectura-min 1.2] [--sin-visible] [--out datos/verify-sfx.json]
// Orden (cada seccion corre si sus entradas existen; --solo corre una):
//   (a) biblioteca  CATALOG.json + assets/sfx/derived: ancla <= 10 ms en percusivos (medida otra vez con analyze-sfx.mjs), pico a -6 dBFS,
//                   sin md5 repetidos, sin mudos, impactos sin cola sostenida, riser que sube >= 25 dB, alturas crecientes en tick-1..4.
//   (b) cues        datos/sfx-cues.json (mount-sfx) contra datos/eventos.json (extract-events; se regenera si el indice o los cuadros
//                   cambiaron): cada cue de `sfx_cues` debe caer en un evento visual de SU cuadro o en una transicion de `main`:
//                     - golpes (anclaje hit/inicio/fin): a <= 33.3 ms del INICIO o del FINAL (llegada) de un tween;
//                     - whoosh: dentro de un tween (+-66 ms), es decir, sobre un movimiento; ticks y teclas: dentro de un tween.
//                   Cue huerfano = ERROR. 'Sonido sin evento visible' (tap/click/blip/soft-in/pop/check/stamp/snap/lock/shutter sin un cambio
//                   perceptible que empiece o acabe en su fotograma, umbrales de lib/sfx-visible.mjs) = AVISO.
//                   Reglas de la v4 (SINTESIS 22): nombre canonico (ni alias ni obsoleto) = ERROR; ticks por entero (> 4 tick en 1 s) =
//                   ERROR; whoosh-rev en el cuadro final o antes de la voz del cierre = ERROR; golpe fuerte (impact/snap/alert/chime/check)
//                   dentro de una frase: ERROR con la voz montada (datos/voz-montada.json), AVISO con las ventanas **Time:** de SCRIPT.md;
//                   densidad > 2 SFX/s, > 3 capas por evento (4 en costura) y eventos/s fuera de ~0.8-1 = AVISO.
//                   Marcas `read:` (readMark): el corte siguiente debe llegar >= --lectura-min s despues (1.2 s por omision, SINTESIS 5).
//   (c) montaje     index.html + datos/sfx-montado.json: data-start + ancla - media-start == tCue (+-1 ms), data-duration >= ancla + 0.15,
//                   archivos existentes, todos los cues montados, volumenes coherentes (con ducking si hay voz), mezcla recalculada desde el
//                   HTML (SFX + voz) con pico <= -1 dBFS y sin saturar, y subidas de nivel <= 12 dB entre segundos que suenan (ERROR).
//   (d) render      con --video: scripts/verify-sfx-sync.py (correlacion de ataque contra el MP4, tolerancia 33.3 ms) con los volumenes
//                   EFECTIVOS del HTML (ducking incluido) y la voz como fondo de la mezcla ideal.
// Escribe datos/verify-sfx.json (y datos/verify-sfx-sync.json con --video).
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DIR_SCRIPTS, bandera, leerJson, opcion, r3, raiz, rutas } from './lib/rutas.mjs';
import { leerIndice } from './lib/indice.mjs';
import { leerScript, leerStoryboard } from './lib/storyboard.mjs';
import { RANGO, SR, cargarCatalogo, db, leerWav, mezclar, nivelesPorSegundo, picoWav, resolverSonido, saltosDeNivel } from './lib/sfx-lib.mjs';
import { REGLAS, densidad, ticksPorEntero, transitoriosEnVoz, whooshRevAlCierre } from './lib/reglas-sonido.mjs';
import { SONIDOS_CON_EVENTO, describirEvento, propiedadesVisibles } from './lib/sfx-visible.mjs';
import { VOZ } from './lib/voz-lib.mjs';
import { huellaProyecto } from './extract-events.mjs';

const argv = process.argv;
const R = raiz(argv);
const P = rutas(R);
const SOLO = opcion(argv, '--solo');
const TOL = Number(opcion(argv, '--tol-ms', 1000 / 30)) / 1000;
const LECTURA = Number(opcion(argv, '--lectura-min', 1.2));
const VIDEO = opcion(argv, '--video');
const quiere = (n) => !SOLO || SOLO === n;
const informe = { generado: new Date().toISOString(), proyecto: R, secciones: {} };
let fallos = 0;
const seccion = (nombre) => (informe.secciones[nombre] = { errores: [], avisos: [], notas: [] });
const cerrar = (nombre, s) => {
    s.ok = s.errores.length === 0;
    console.log(`\n== (${nombre}) ${s.ok ? 'OK' : 'FALLA'}: ${s.errores.length} errores, ${s.avisos.length} avisos`);
    for (const n of s.notas) console.log(`   ${n}`);
    for (const e of s.errores) console.log(`   ERROR  ${e}`);
    for (const a of s.avisos.slice(0, 40)) console.log(`   aviso  ${a}`);
    if (s.avisos.length > 40) console.log(`   aviso  ... y ${s.avisos.length - 40} mas (ver datos/verify-sfx.json)`);
    if (!s.ok) fallos++;
};

// ------------------------------------------------------------------------------------------------ (a) biblioteca
function dominante(x, desde, n) {
    // frecuencia dominante (Hz) de x[desde, desde+n) con un barrido de Goertzel de 200 a 8000 Hz (paso 10 Hz)
    let mejor = 0, f0 = 0;
    for (let f = 200; f <= 8000; f += 10) {
        const k = 2 * Math.cos((2 * Math.PI * f) / SR);
        let s1 = 0, s2 = 0;
        for (let i = 0; i < n; i++) { const s = x[desde + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))) + k * s1 - s2; s2 = s1; s1 = s; }
        const p = s1 * s1 + s2 * s2 - k * s1 * s2;
        if (p > mejor) { mejor = p; f0 = f; }
    }
    return f0;
}
function biblioteca() {
    const s = seccion('biblioteca');
    const cat = cargarCatalogo(R);
    const unicos = Object.entries(cat).filter(([, e]) => !e.alias);
    for (const [a, e] of Object.entries(cat)) if (e.alias && !cat[e.alias]) s.errores.push(`alias ${a} -> ${e.alias} no existe`);
    const tmp = join(tmpdir(), `susan-v4-analisis-${process.pid}.json`);
    execFileSync('node', [join(DIR_SCRIPTS, 'analyze-sfx.mjs'), '--dir', P.sfxDerivados, '--out', tmp], { stdio: 'ignore', maxBuffer: 1 << 28 });
    const meta = Object.fromEntries(JSON.parse(readFileSync(tmp, 'utf8')).map((m) => [m.archivo.replace(/\.wav$/, ''), m]));
    rmSync(tmp, { force: true });
    const md5 = {};
    for (const [n, e] of unicos) {
        const ruta = join(R, e.file);
        if (!existsSync(ruta)) { s.errores.push(`${n}: no existe ${e.file}`); continue; }
        const h = createHash('md5').update(readFileSync(ruta)).digest('hex');
        (md5[h] ??= []).push(n);
        const w = leerWav(ruta), m = meta[n];
        const pk = db(picoWav(w));
        if (w.sr !== SR) s.errores.push(`${n}: ${w.sr} Hz (se exigen ${SR})`);
        if (pk < -40) s.errores.push(`${n}: archivo mudo (pico ${r3(pk)} dBFS)`);
        if (Math.abs(pk - -6) > 0.3) s.errores.push(`${n}: pico ${r3(pk)} dBFS (se exigen -6 +-0.3)`);
        if (Math.abs(Math.abs(e.picoDbFS) - Math.abs(pk)) > 0.05) s.errores.push(`${n}: CATALOG picoDbFS ${e.picoDbFS} != medido ${r3(pk)} (regenera el catalogo)`);
        if (!m) { s.errores.push(`${n}: sin medicion de analyze-sfx`); continue; }
        const esperado = e.anclaje === 'hit' ? m.ancla : e.anclaje === 'pico' ? m.pico : e.anclaje === 'inicio' ? m.onset : w.dur;
        if (Math.abs(e.anclaMs - esperado * 1000) > 1.5) s.errores.push(`${n}: anclaMs ${e.anclaMs} != medido ${r3(esperado * 1000)} (anclaje ${e.anclaje}; regenera el catalogo)`);
        if ((e.anclaje === 'hit' || e.anclaje === 'inicio') && e.anclaMs > 10) s.errores.push(`${n}: ancla ${e.anclaMs} ms > 10 ms (recorta el inicio en derive-sfx.sh)`);
        if (Math.abs(e.duracionMs - w.dur * 1000) > 1.5) s.errores.push(`${n}: duracionMs ${e.duracionMs} != ${r3(w.dur * 1000)}`);
        for (const k of ['categoria', 'anclaje', 'volDefecto', 'uso', 'file', 'rango']) if (e[k] === undefined) s.errores.push(`${n}: falta el campo ${k} en CATALOG.json`);
        if (e.rango !== RANGO[e.categoria]) s.errores.push(`${n}: rango ${e.rango} no coincide con la categoria ${e.categoria}`);
        if (e.categoria === 'impact') {
            if (e.duracionMs > 1000) s.errores.push(`${n}: impacto de ${e.duracionMs} ms (> 1000: drone sostenido)`);
            if (m.sostenido > 0.5) s.errores.push(`${n}: impacto sostenido (${r3(m.sostenido * 100)} % del archivo a <= 6 dB del maximo)`);
        }
        if (e.categoria === 'riser') {
            const rms = (a, b) => { let t = 0; for (let i = a; i < b; i++) t += w.ch[0][i] ** 2; return db(Math.sqrt(t / Math.max(1, b - a))); };
            const ini = rms(0, Math.round(0.1 * SR)), fin = rms(w.frames - Math.round(0.15 * SR), w.frames);
            if (fin - ini < 25) s.errores.push(`${n}: el riser sube solo ${r3(fin - ini)} dB (< 25)`);
            if (fin < -30) s.errores.push(`${n}: el final del riser es inaudible (${r3(fin)} dBFS)`);
        }
    }
    for (const [h, ns] of Object.entries(md5)) if (ns.length > 1) s.errores.push(`archivos duplicados (md5 ${h.slice(0, 8)}): ${ns.join(', ')}`);
    const subida = (prefijo, n, durMs, nivel) => {
        const fs = [];
        for (let i = 1; i <= n; i++) {
            const e = cat[`${prefijo}${i}`];
            if (!e) { s.errores.push(`falta ${prefijo}${i}`); return; }
            fs.push(dominante(leerWav(join(R, e.file)).ch[0], 0, Math.round((durMs / 1000) * SR)));
        }
        s.notas.push(`${prefijo}1..${n}: frecuencia dominante ${fs.join(' < ')} Hz`);
        if (!fs.every((f, i) => i === 0 || f > fs[i - 1])) (nivel === 'error' ? s.errores : s.avisos).push(`${prefijo}1..${n}: las alturas no crecen (${fs.join(', ')} Hz)`);
    };
    subida('tick-', 4, 40, 'error');
    subida('pop-', 4, 30, 'aviso');
    const obsoletos = Object.entries(cat).filter(([, e]) => e.deprecated).map(([k]) => k);
    s.notas.push(`${unicos.length} archivos unicos, ${Object.keys(cat).length - unicos.length} alias heredados (rechazados en sfx_cues), obsoletos: ${obsoletos.join(', ')}`);
    cerrar('a: biblioteca', s);
}

// ------------------------------------------------------------------------------------------------ eventos (extract-events)
function cargarEventos(s) {
    const actual = huellaProyecto(R);
    let ev = leerJson(P.eventos);
    if (!ev || ev.huella !== actual) {
        const r = spawnSync('node', [join(DIR_SCRIPTS, 'extract-events.mjs'), '--root', R], { encoding: 'utf8', maxBuffer: 1 << 26 });
        if (r.status !== 0) { s.errores.push(`extract-events.mjs fallo: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-4).join(' | ')}`); return null; }
        s.notas.push(`datos/eventos.json ${ev ? 'desactualizado' : 'ausente'}: regenerado con extract-events.mjs (runtime real 0.8.134)`);
        ev = leerJson(P.eventos);
    }
    return ev;
}

// Ventanas de voz absolutas: reales (voz-montada.json) o estimadas (**Time:** de SCRIPT.md + inicio del cuadro).
function ventanasVoz(cuadrosIdx) {
    const vm = leerJson(P.vozMontada);
    const html = existsSync(P.index) ? readFileSync(P.index, 'utf8') : '';
    if (vm?.lineas?.length && /<!-- voz:start/.test(html)) return { origen: 'voz montada (datos/voz-montada.json)', real: true, v: vm.lineas.map((l) => ({ id: l.id, ini: l.habla_ini, fin: l.habla_fin })) };
    if (!existsSync(P.script) || !existsSync(P.storyboard)) return { origen: null, real: false, v: [] };
    const sb = leerStoryboard(readFileSync(P.storyboard, 'utf8'));
    const sc = leerScript(readFileSync(P.script, 'utf8'));
    const v = [];
    for (const l of sc.lineas) {
        const f = sb.frames.find((x) => x.numero === l.frame);
        const c = f && cuadrosIdx[f.frameId];
        if (c && l.ventana) v.push({ id: l.id, ini: c.start + l.ventana.desde, fin: c.start + l.ventana.hasta });
    }
    return { origen: 'estimadas con **Time:** de SCRIPT.md', real: false, v };
}

// ------------------------------------------------------------------------------------------------ (b) cues <-> tweens
function cues() {
    const s = seccion('cues');
    const d = leerJson(P.sfxCues);
    if (!d) { s.errores.push('falta datos/sfx-cues.json: node scripts/mount-sfx.mjs'); return cerrar('b: cues<->tweens y reglas', s); }
    const cat = cargarCatalogo(R);
    const ev = cargarEventos(s);
    if (!ev) return cerrar('b: cues<->tweens y reglas', s);
    // tweens que cuentan como evento: con objetivo del DOM o propiedades (fuera el ancla `tl.to({}, {duration})` y los `set` vacios)
    const utiles = ev.eventos.filter((e) => e.tipo !== 'call' && Object.keys(e.propiedades ?? {}).length > 0 && !(e.tipo === 'set' && e.duracion === 0));
    const por = {};
    for (const e of utiles) (por[e.cuadro] ??= []).push(e);
    const candidatos = (c) => [...(por[c.cuadro] ?? []), ...(por.main ?? [])];
    let exactos = 0, ventana = 0;
    const enriquecidos = [];
    for (const c of d.cues) {
        const r = resolverSonido(cat, c.nombre);
        if (r.error) { s.errores.push(`${c.id} (${c.texto}): ${r.error}`); continue; }
        const e = r.entrada;
        const cue = { ...c, categoria: e.categoria, anclaje: e.anclaje };
        enriquecidos.push(cue);
        if (c.t < -1e-6 || c.t > d.duracion + 1e-6) { s.errores.push(`${c.id}: t=${c.t} fuera del video (0-${d.duracion})`); continue; }
        const ts = candidatos(c);
        if (e.categoria === 'whoosh') {
            const dentro = ts.filter((t) => c.t >= t.inicioAbsoluto - 0.066 && c.t <= t.finAbsoluto + 0.066 && t.duracion > 0);
            if (!dentro.length) s.errores.push(`${c.id} (${c.nombre} @${c.tLocal} s local, ${c.t} abs): el whoosh no cae sobre ningun movimiento de ${c.cuadro} ni de una transicion`);
            ventana++; continue;
        }
        if (e.categoria === 'tick' || e.categoria === 'key') {
            if (!ts.some((t) => c.t >= t.inicioAbsoluto - TOL && c.t <= t.finAbsoluto + TOL)) s.errores.push(`${c.id} (${c.nombre} @${c.tLocal} s): tick/tecla huerfano (ningun tween activo en ${c.cuadro})`);
            ventana++; continue;
        }
        // golpes: inicio o final (llegada) de un tween a <= TOL; en `main` tambien cuenta la entrada de un cuadro (corte seco)
        const cerca = ts.filter((t) => Math.abs(t.inicioAbsoluto - c.t) <= TOL + 1e-9 || Math.abs(t.finAbsoluto - c.t) <= TOL + 1e-9);
        const corte = Object.values(d.cuadros ?? {}).some((q) => Math.abs(q.start - c.t) <= TOL + 1e-9) && c.tLocal <= TOL + 1e-9;
        if (cerca.length || corte) exactos++;
        else {
            const propios = por[c.cuadro] ?? [];
            const mas = propios.reduce((m, t) => {
                for (const x of [t.inicioAbsoluto, t.finAbsoluto]) if (Math.abs(x - c.t) < Math.abs(m - c.t)) m = x;
                return m;
            }, Infinity);
            const base = d.cuadros?.[c.cuadro]?.start ?? 0;
            s.errores.push(`${c.id} (${c.texto}; ${c.t} s abs): ningun tween de ${c.cuadro} empieza ni termina a <= ${r3(TOL * 1000)} ms${Number.isFinite(mas) ? ` (el mas cercano: ${r3(mas - base)} s local, ${r3((c.t - mas) * 1000)} ms)` : ''}. Corrige sfx_cues o el cuadro`);
        }
        // sonido sin evento visible
        if (!bandera(argv, '--sin-visible') && SONIDOS_CON_EVENTO.test(c.nombre) && !corte) {
            const vis = cerca.some((t) => t.cuadro === 'main' || propiedadesVisibles(t).length);
            if (cerca.length && !vis) s.avisos.push(`sonido sin evento visible: ${c.id} (${c.nombre} @${c.tLocal} s): solo hay ${cerca.slice(0, 3).map(describirEvento).join(' | ')}, todo por debajo del umbral de percepcion`);
        }
    }
    s.notas.push(`${d.cues.length} cues: ${exactos} golpes a <= ${r3(TOL * 1000)} ms del inicio o final de un tween, ${ventana} por ventana (whoosh/ticks); eventos.json con ${ev.eventos.length} tweens`);
    // reglas de la v4
    const cortes = Object.values(d.cuadros ?? {}).map((q) => q.start).filter((x) => x > 0);
    const dens = densidad(enriquecidos, d.duracion, cortes);
    s.notas.push(`densidad: ${r3(dens.sfxPorSeg)} SFX/s (max ${REGLAS.sfxPorSegMax}), ${r3(dens.eventosPorSeg)} eventos/s (objetivo ${REGLAS.eventosPorSeg.join('-')}), hasta ${dens.capasMax} capas por evento`);
    if (dens.sfxPorSeg > REGLAS.sfxPorSegMax) s.avisos.push(`densidad ${r3(dens.sfxPorSeg)} SFX/s > ${REGLAS.sfxPorSegMax} (SINTESIS 22: ~1-2 SFX/s)`);
    if (dens.eventosPorSeg > REGLAS.eventosPorSegMax) s.avisos.push(`${r3(dens.eventosPorSeg)} eventos sonoros/s (objetivo ~0.8-1, maximo sugerido ${REGLAS.eventosPorSegMax}): agrupa capas en menos golpes`);
    for (const x of dens.densos) s.avisos.push(`evento con ${x.capas} capas en t=${r3(x.t)} s (${x.nombres.join(' + ')}; maximo ${x.tope}${x.costura ? ' en costura' : ''})`);
    for (const t of ticksPorEntero(enriquecidos)) s.errores.push(`ticks por entero: ${t.n} tick en 1 s desde t=${r3(t.desde)} s (maximo ${REGLAS.ticksMax}: un tic por columna al asentarse, SINTESIS 22)`);
    const vv = ventanasVoz(d.cuadros ?? {});
    const ultimaVoz = vv.v.length ? Math.max(...vv.v.map((x) => x.ini)) : null;
    for (const c of whooshRevAlCierre(enriquecidos, d.cuadroFinal, ultimaVoz)) s.errores.push(`${c.id}: whoosh-rev en el cierre (cuadro final o antes de la voz del cierre): preferencia registrada de la persona duena (LECCIONES-V3 3.6)`);
    if (vv.v.length) {
        const malos = transitoriosEnVoz(enriquecidos, vv.v);
        s.notas.push(`voz: ${vv.v.length} ventanas (${vv.origen}); ${malos.length} golpes fuertes dentro de una frase`);
        for (const m of malos) (vv.real ? s.errores : s.avisos).push(`${m.cue.id} (${m.cue.nombre}, ${m.cue.categoria}) cae en ${r3(m.cue.t)} s, dentro de la frase ${m.linea} (${m.ventana.map(r3).join('-')} s): los transitorios fuertes van en los huecos de la voz`);
    } else s.notas.push('voz: sin ventanas (no hay SCRIPT.md con **Time:** ni voz montada)');
    // marcas de lectura (readMark): el corte siguiente debe llegar >= LECTURA s despues
    const cuadros = Object.entries(d.cuadros ?? {}).map(([id, v]) => ({ id, ini: v.start })).sort((a, b) => a.ini - b.ini);
    const lecturas = (ev.etiquetas ?? []).filter((x) => x.etiqueta.startsWith('read:'));
    for (const l of lecturas) {
        const propio = cuadros.find((y) => y.id === l.cuadro);
        const sig = cuadros.find((x) => x.ini > (propio?.ini ?? Infinity));
        const limite = sig ? sig.ini : d.duracion;
        if (limite - l.t < LECTURA - 1e-9) s.errores.push(`lectura corta: "${l.etiqueta.slice(5).replace(/#\d+$/, '')}" (${l.cuadro}) queda completa en ${l.t} s y ${sig ? 'el corte llega' : 'el video termina'} en ${r3(limite)} s (${r3(limite - l.t)} s < ${LECTURA} s)`);
    }
    s.notas.push(`${lecturas.length} marcas read: comprobadas (minimo ${LECTURA} s antes del corte)`);
    // huecos sin sonido: solo informativo (la voz llena; no hay lecho continuo en la v4)
    const iv = enriquecidos.map((c) => { const e = cat[c.nombre]; return [c.t - Math.min(e.anclaMs / 1000, 0.6), c.t + Math.min(e.colaMs / 1000, 0.5)]; }).sort((a, b) => a[0] - b[0]);
    let fin = 0, hueco = { dur: 0 };
    for (const [a, b] of iv) { if (a - fin > hueco.dur) hueco = { dur: a - fin, de: fin, a }; fin = Math.max(fin, b); }
    if (hueco.dur > 0) s.notas.push(`hueco mas largo sin SFX: ${r3(hueco.dur)} s (${r3(hueco.de)}-${r3(hueco.a)} s); informativo`);
    cerrar('b: cues<->tweens y reglas', s);
}

// ------------------------------------------------------------------------------------------------ (c) montaje
function audiosDelIndice() {
    const html = readFileSync(P.index, 'utf8');
    return { html, indice: leerIndice(html) };
}
function montaje() {
    const s = seccion('montaje');
    const m = leerJson(P.sfxMontado);
    if (!m) { s.errores.push('falta datos/sfx-montado.json: node scripts/mount-sfx.mjs'); return cerrar('c: montaje', s); }
    const cat = cargarCatalogo(R);
    const { indice } = audiosDelIndice();
    const tags = Object.fromEntries(indice.sfx.map((a) => [a.id, a]));
    s.notas.push(`${indice.sfx.length} <audio> en el bloque sfx y ${indice.voz.length} en el de voz; ${m.cues.length} cues en sfx-montado.json`);
    if (!indice.tieneSfx) s.errores.push('index.html no tiene el bloque <!-- sfx:start --> (¿se re-ensamblo despues de mount-sfx? vuelve a correr mount-sfx.mjs)');
    if (indice.ajenos.length) s.errores.push(`${indice.ajenos.length} <audio> fuera de los bloques sfx/voz (p. ej. ${indice.ajenos[0].id ?? indice.ajenos[0].src})`);
    if (indice.sfx.length !== m.cues.length) s.errores.push(`el HTML tiene ${indice.sfx.length} <audio> sfx y sfx-montado.json ${m.cues.length}: re-ejecuta mount-sfx.mjs`);
    if (Math.abs((indice.duracion ?? 0) - m.duracion) > 1e-6) s.errores.push(`el video dura ${indice.duracion} s y el montaje se hizo para ${m.duracion} s: re-ejecuta mount-sfx.mjs`);
    const vm = leerJson(P.vozMontada);
    const ventanas = indice.tieneVoz && vm ? vm.lineas.map((f) => [f.habla_ini - VOZ.mezcla.ducking_sfx.antes_s, f.habla_fin + VOZ.mezcla.ducking_sfx.despues_s]) : [];
    let maxErr = 0;
    const items = [];
    for (const c of m.cues) {
        const a = tags[c.audioId];
        if (!a) { s.errores.push(`${c.id}: no hay <audio id="${c.audioId}"> en el HTML`); continue; }
        const e = cat[c.sfx];
        if (!e) { s.errores.push(`${c.id}: "${c.sfx}" no esta en el catalogo`); continue; }
        if (e.deprecated || e.alias) s.errores.push(`${c.id}: "${c.sfx}" ${e.deprecated ? 'obsoleto' : `alias de ${e.alias}`}`);
        const ancla = e.anclaMs / 1000;
        const err = (a.start + ancla - a.mediaStart - c.tCue) * 1000;
        maxErr = Math.max(maxErr, Math.abs(err));
        if (Math.abs(err) > 1.0 + 1e-6) s.errores.push(`${c.id}: data-start ${a.start} + ancla ${ancla} - media-start ${a.mediaStart} = ${r3(a.start + ancla - a.mediaStart)} != tCue ${c.tCue} (error ${r3(err)} ms)`);
        const largo = e.duracionMs / 1000 - a.mediaStart;
        if (a.duration < Math.min(ancla - a.mediaStart + 0.15, largo) - 2e-3) s.errores.push(`${c.id}: data-duration ${a.duration} < ancla + 0.15 (el golpe se cortaria)`);
        if (a.start < 0) s.errores.push(`${c.id}: data-start negativo (${a.start})`);
        const volMontado = a.volOrig ?? a.volume;
        if (Math.abs(a.start - c.dataStart) > 1e-6 || Math.abs(a.duration - c.dataDuration) > 1e-6 || Math.abs(volMontado - c.volume) > 1e-6) s.errores.push(`${c.id}: el HTML no coincide con sfx-montado.json (re-ejecuta mount-sfx.mjs)`);
        if (a.src !== c.file) s.errores.push(`${c.id}: src "${a.src}" != "${c.file}"`);
        if (!existsSync(join(R, c.file))) { s.errores.push(`${c.id}: no existe ${c.file}`); continue; }
        if (!(a.volume > 0 && a.volume <= 1)) s.errores.push(`${c.id}: data-volume ${a.volume} fuera de (0,1]`);
        // ducking coherente con la voz montada
        const choca = ventanas.some(([x, y]) => a.start < y && a.start + Math.min(a.duration, 0.6) > x);
        if (choca && a.volOrig == null) s.errores.push(`${c.id}: suena durante la voz y no tiene ducking (re-ejecuta mount-voz.mjs)`);
        if (!choca && a.volOrig != null) s.errores.push(`${c.id}: tiene ducking (data-vol-orig) pero no choca con ninguna frase (re-ejecuta mount-voz.mjs)`);
        items.push({ wav: leerWav(join(R, c.file)), dataStart: a.start, mediaStart: a.mediaStart, dataDuration: a.duration, vol: a.volume });
    }
    s.notas.push(`aritmetica de montaje: error maximo ${r3(maxErr)} ms (tolerancia 1 ms); ${m.cues.filter((c) => c.mediaStart).length} con data-media-start`);
    const d = leerJson(P.sfxCues);
    if (d) {
        for (const c of d.cues) {
            const x = m.cues.find((y) => y.id === c.id);
            if (!x) s.errores.push(`el cue ${c.id} (${c.texto}) no esta montado: re-ejecuta mount-sfx.mjs`);
            else if (Math.abs(x.tCue - c.t) > 0.0006) s.errores.push(`${c.id}: tCue ${x.tCue} != ${c.t} (montaje desactualizado)`);
        }
    }
    // voz (si esta montada): entra en la mezcla recalculada
    for (const v of indice.voz) {
        if (!existsSync(join(R, v.src))) { s.errores.push(`${v.id}: no existe ${v.src}`); continue; }
        items.push({ wav: leerWav(join(R, v.src)), dataStart: v.start, mediaStart: v.mediaStart, dataDuration: v.duration, vol: v.volume });
    }
    if (!items.length) return cerrar('c: montaje', s);
    const dur = indice.duracion ?? m.duracion;
    const mz = mezclar(items, dur);
    const recorte = mz.ch.map((c) => c.subarray(0, Math.round(dur * SR)));
    let saturadas = 0;
    for (const ch of recorte) for (let i = 0; i < ch.length; i++) if (Math.abs(ch[i]) >= 0.99) saturadas++;
    s.notas.push(`mezcla recalculada desde el HTML (${indice.voz.length ? 'SFX + voz' : 'solo SFX'}): pico ${r3(db(mz.pico))} dBFS en t=${r3(mz.picoT)} s (tope -1), ${saturadas} muestras >= 0.99`);
    if (db(mz.pico) > -1 + 0.05) s.errores.push(`pico de la mezcla ${r3(db(mz.pico))} dBFS > -1 dBFS (t=${r3(mz.picoT)} s)`);
    if (saturadas) s.errores.push(`${saturadas} muestras >= 0.99 (saturacion)`);
    const niveles = nivelesPorSegundo(recorte, dur);
    const saltos = saltosDeNivel(niveles.max100, REGLAS.pisoActivoDbFS).filter((x) => x.cuenta);
    s.notas.push(`nivel por segundo (RMS max en 100 ms, dBFS): ${niveles.max100.map((v) => Math.round(v)).join(' ')}; mayor subida entre segundos que suenan ${r3(saltos[0]?.db ?? 0)} dB`);
    for (const x of saltos.filter((y) => y.db > REGLAS.saltoMaxDb)) s.errores.push(`subida de nivel de ${r3(x.db)} dB del segundo ${x.de} al ${x.a} (${x.niveles.map(r3).join(' -> ')} dBFS; maximo ${REGLAS.saltoMaxDb} dB, SINTESIS 22): baja los cues del segundo ${x.a} con -NdB en sfx_cues o sube los del ${x.de}`);
    cerrar('c: montaje', s);
}

// ------------------------------------------------------------------------------------------------ (d) render
function render() {
    const s = seccion('render');
    const mp4 = resolve(R, VIDEO);
    if (!existsSync(mp4)) { s.errores.push(`no existe ${mp4}`); return cerrar('d: render', s); }
    const m = leerJson(P.sfxMontado);
    if (!m) { s.errores.push('falta datos/sfx-montado.json'); return cerrar('d: render', s); }
    // manifiesto efectivo: los volumenes que de verdad tiene el HTML (ducking) y la voz como fondo (se suma a la mezcla ideal, no se mide)
    const { indice } = audiosDelIndice();
    const vol = Object.fromEntries(indice.sfx.map((a) => [a.id, a.volume]));
    const efectivo = {
        ...m,
        cues: [
            ...m.cues.map((c) => ({ ...c, volume: vol[c.audioId] ?? c.volume })),
            ...indice.voz.map((v) => ({ id: v.id, file: v.src, tCue: r3(v.start - v.mediaStart), ancla: 0, mediaStart: v.mediaStart, dataStart: v.start, dataDuration: v.duration, volume: v.volume, anclaje: 'voz', verificar: false })),
        ],
    };
    mkdirSync(P.datos, { recursive: true });
    const rutaEf = join(P.datos, 'sfx-efectivo.json');
    writeFileSync(rutaEf, JSON.stringify(efectivo, null, 1) + '\n');
    const py = process.env.SUSAN_PYTHON || 'python3';
    const r = spawnSync(py, [join(DIR_SCRIPTS, 'verify-sfx-sync.py'), rutaEf, mp4, '--root', R, '--tol-ms', String(TOL * 1000), '--out', P.verifySync], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const salida = (r.stdout || '').trim();
    console.log(salida);
    if (/No module named/.test(r.stderr || '')) s.errores.push(`verify-sfx-sync.py necesita numpy y scipy: pip install --user numpy scipy (o SUSAN_PYTHON=/ruta/al/python)`);
    for (const l of salida.split('\n')) if (/FALLA/.test(l)) s.errores.push(l.trim());
    if (r.status !== 0 && !s.errores.length) s.errores.push(`verify-sfx-sync.py termino con codigo ${r.status}: ${(r.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
    const j = leerJson(P.verifySync);
    if (j) { s.detalle = j.resumen; s.notas.push(`${j.resumen.cues} cues: ${j.resumen.cues - j.resumen.fallos} OK; error medio ${j.resumen.errorMedioAbsMs} ms, maximo ${j.resumen.errorMaxAbsMs} ms (tolerancia ${j.resumen.toleranciaMs} ms)`); }
    cerrar('d: render', s);
}

try {
    if (quiere('biblioteca')) biblioteca();
    if (quiere('cues')) { if (SOLO || existsSync(P.sfxCues)) cues(); else console.log('\n(b) cues: OMITIDO, no existe datos/sfx-cues.json (node scripts/mount-sfx.mjs)'); }
    if (quiere('montaje')) { if (SOLO || existsSync(P.sfxMontado)) montaje(); else console.log('\n(c) montaje: OMITIDO, no existe datos/sfx-montado.json'); }
    if ((quiere('render') && VIDEO) || SOLO === 'render') render();
    else if (!SOLO) console.log('\n(d) render: OMITIDO, pasa --video renders/video.mp4');
} catch (e) {
    console.error(`verify-sfx: excepcion: ${e.stack || e}`);
    process.exit(1);
}
informe.ok = fallos === 0;
if (!SOLO) { mkdirSync(P.datos, { recursive: true }); writeFileSync(resolve(R, opcion(argv, '--out', P.verifySfx)), JSON.stringify(informe, null, 1) + '\n'); }
console.log(`\nverify-sfx: ${informe.ok ? 'TODO OK' : `FALLO (${fallos} secciones)`}`);
process.exit(informe.ok ? 0 : 1);
