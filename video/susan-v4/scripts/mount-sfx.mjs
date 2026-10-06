#!/usr/bin/env node
// mount-sfx.mjs - monta los efectos de sonido de la v4 en index.html a partir de `sfx_cues` de STORYBOARD.md.
//
// Entrada : STORYBOARD.md       `- sfx_cues: 0.40 whoosh-s; 1.55 tap -3dB; ...` por cuadro (sintaxis: scripts/lib/storyboard.mjs y README)
//           index.html          ensamblado (assemble-index + transitions inject): da el data-start de cada cuadro el-<frame_id>
//           assets/sfx/CATALOG.json   ancla (golpe medido de cada WAV derivado), duracion, cola, categoria, volDefecto
// Salida  : bloque <!-- sfx:start --> ... <!-- sfx:end --> dentro de #root en index.html (se reemplaza en cada corrida: idempotente)
//           datos/sfx-cues.json     cues con su tiempo ABSOLUTO (lo usa verify-sfx.mjs contra los tweens)
//           datos/sfx-montado.json  un registro por <audio> (lo usan verify-sfx.mjs, verify-sfx-sync.py y mount-voz.mjs)
//
// Uso:  node scripts/mount-sfx.mjs [--root <proyecto>] [--dry] [--bus-db 0] [--objetivo-lufs <LUFS>] [--polifonia 4] [--tope-dbfs -1.5]
//                                  [--wav-referencia datos/mezcla-sfx.wav]
//
// Reglas de montaje (heredadas de la v3, que midio 0 fallos en 205 cues a <= 33 ms):
//   t absoluto     = data-start del cuadro en index.html + t local del cue (transitions inject nunca mueve un data-start)
//   data-start     = round(t - ancla, 3); si sale < 0: data-start = 0 y data-media-start = ancla - t (se recorta el principio del archivo).
//                    `ancla` = anclaMs del catalogo = ataque MEDIDO de cada WAV derivado (<= 10 ms en percusivos, pico del barrido en
//                    whoosh, final del archivo en riser/zoom-in): asi el golpe cae en el fotograma del evento (compensacion de ataque).
//   data-duration  = el archivo entero desde media-start; nunca se recorta por el cue siguiente; nunca por debajo de ancla + 150 ms.
//   data-volume    = volDefecto del catalogo x ganancia del cue (+-N dB en sfx_cues), tope 0.80 por cue; despues el bus (--bus-db u
//                    --objetivo-lufs, tope 1.0); polifonia <= 4 simultaneos (los de menor rango x0.5); techo de la mezcla <= -1.5 dBFS
//                    (se baja el volumen de los cues que suenan en el pico, mezclador lineal como el motor).
// Reglas de la v4 (SINTESIS 22; las mismas que exige verify-sfx.mjs, aqui solo se informan): ~1-2 SFX/s, 2-3 capas por evento,
//   saltos de nivel <= 12 dB entre segundos que suenan, sin ticks por entero, sin whoosh-rev en el cierre, golpes fuertes fuera de la voz.
// Errores que DETIENEN el montaje (no se escribe nada): sintaxis de sfx_cues, nombre desconocido / alias heredado / obsoleto, cue fuera
//   de [0, duration] de su cuadro, cuadro con sfx_cues que no esta en index.html, <audio> ajenos en el indice (p. ej. de audio_meta.json).
// Si index.html ya tiene la voz montada (<!-- voz:start -->) se reaplica su ducking con datos/voz-montada.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { bandera, leerJson, opcion, r3, raiz, rutas } from './lib/rutas.mjs';
import { leerStoryboard, parseSfxCues } from './lib/storyboard.mjs';
import { escribirBloque, leerIndice } from './lib/indice.mjs';
import { RANGO, SR, VOL_MAX_CUE, cargarCatalogo, db, escribirWav, leerWav, lineal, lufsIntegrado, mezclar, nivelesPorSegundo, picoVerdadero, resolverSonido, saltosDeNivel } from './lib/sfx-lib.mjs';
import { REGLAS, densidad, ticksPorEntero, whooshRevAlCierre } from './lib/reglas-sonido.mjs';
import { aplicarDucking } from './lib/voz-lib.mjs';

const argv = process.argv;
const R = raiz(argv);
const P = rutas(R);
const SECO = bandera(argv, '--dry');
const POLI = Number(opcion(argv, '--polifonia', 4));
const TOPE = lineal(Number(opcion(argv, '--tope-dbfs', -1.5)));
const BUS_DB = Number(opcion(argv, '--bus-db', 0));
const OBJ_LUFS = opcion(argv, '--objetivo-lufs') === null ? null : Number(opcion(argv, '--objetivo-lufs'));
const errores = [], avisos = [];

function fallar(lista) {
    console.error(`mount-sfx: ${lista.length} error(es); no se escribio nada:\n  ${lista.join('\n  ')}`);
    process.exit(1);
}

// ---- 1. entradas
if (!existsSync(P.storyboard)) fallar([`falta ${P.storyboard}`]);
if (!existsSync(P.index)) fallar([`falta ${P.index}: corre assemble-index.mjs (y transitions inject) antes`]);
const sb = leerStoryboard(readFileSync(P.storyboard, 'utf8'));
errores.push(...sb.errores);
avisos.push(...sb.avisos);
let html = readFileSync(P.index, 'utf8');
const indice = leerIndice(html);
const cat = cargarCatalogo(R);
const duracionTotal = indice.duracion;
if (!(duracionTotal > 0)) fallar(['index.html: #root sin data-duration']);
if (indice.ajenos.length) errores.push(`index.html tiene ${indice.ajenos.length} <audio> fuera de los bloques sfx/voz (${indice.ajenos.slice(0, 3).map((a) => a.id ?? a.src).join(', ')}): ¿audio_meta.json de audio.mjs fetch-sfx? (SINTESIS 22 lo prohibe; borralo y re-ensambla)`);
const inicioDe = Object.fromEntries(indice.cuadros.map((c) => [c.id, c]));

// ---- 2. cues por cuadro
const items = [];
const cuadrosSb = sb.frames.filter((f) => f.frameId);
for (const f of cuadrosSb) {
    if (f.sfxCuesCrudo == null) { if (inicioDe[f.frameId]) avisos.push(`Frame ${f.numero} (${f.frameId}) sin "- sfx_cues:" (escribe "none" si es a proposito)`); continue; }
    const { cues, errores: e } = parseSfxCues(f.sfxCuesCrudo);
    errores.push(...e.map((x) => `Frame ${f.numero} (${f.frameId}): ${x}`));
    if (!cues.length) continue;
    const host = inicioDe[f.frameId];
    if (!host) { errores.push(`Frame ${f.numero}: ${f.frameId} tiene sfx_cues pero no esta montado en index.html (¿status/src? re-ensambla)`); continue; }
    const D = f.duracion ?? host.duration;
    for (const c of cues) {
        const r = resolverSonido(cat, c.nombre);
        if (r.error) { errores.push(`Frame ${f.numero} (${f.frameId}) cue ${c.n} "${c.texto}": ${r.error}`); continue; }
        if (c.t > D + 1e-9) { errores.push(`Frame ${f.numero} (${f.frameId}) cue ${c.n} "${c.texto}": t=${c.t} s pasa de la duracion del cuadro (${D} s)`); continue; }
        const e = r.entrada;
        const volPedido = e.volDefecto * lineal(c.gananciaDb);
        if (volPedido > VOL_MAX_CUE + 1e-9) avisos.push(`${f.frameId}#${c.n} (${c.nombre} ${c.gananciaDb > 0 ? '+' : ''}${c.gananciaDb} dB): ${r3(volPedido)} > ${VOL_MAX_CUE}, se queda en ${VOL_MAX_CUE} por cue (sube el bus o baja los demas)`);
        items.push({
            id: `${f.frameId}-${c.n}`, cuadro: f.frameId, frame: f.numero, n: c.n, nombre: c.nombre, texto: c.texto, tLocal: c.t, t: r3(host.start + c.t),
            gananciaDb: c.gananciaDb, file: e.file, ancla: e.anclaMs / 1000, dur: e.duracionMs / 1000, cola: e.colaMs / 1000,
            vol: Math.min(VOL_MAX_CUE, volPedido), categoria: e.categoria, rango: e.rango ?? RANGO[e.categoria] ?? 1, anclaje: e.anclaje,
        });
    }
}
for (const it of items) if (!existsSync(resolve(R, it.file))) errores.push(`${it.id}: no existe ${it.file}`);
if (errores.length) fallar(errores);
items.sort((a, b) => a.t - b.t || a.cuadro.localeCompare(b.cuadro) || a.n - b.n);

// ---- 3. atributos (antes del nivel: la mezcla de referencia los necesita)
const wavDe = {};
const cargar = (file) => (wavDe[file] ??= leerWav(resolve(R, file)));
for (const q of items) {
    let inicio = q.t - q.ancla, media = 0;
    if (inicio < 0) { media = -inicio; inicio = 0; }
    q.dataStart = r3(inicio);
    q.mediaStart = r3(media);
    let d = Math.max(q.ancla - q.mediaStart + 0.15, q.dur - q.mediaStart);
    const resto = duracionTotal - q.dataStart;
    if (d > resto && resto >= q.ancla - q.mediaStart + 0.15) d = resto;          // no pasar del final del video sin cortar el golpe
    const largo = Math.floor((q.dur - q.mediaStart) * 1000) / 1000;              // ni del largo real del archivo (check: clip_media_fit)
    if (largo > 0 && d > largo) d = largo;
    q.dataDuration = r3(d);
}
const mezcla = () => mezclar(items.map((q) => ({ wav: cargar(q.file), dataStart: q.dataStart, mediaStart: q.mediaStart, dataDuration: q.dataDuration, vol: q.vol })), duracionTotal);

// ---- 4. bus: ganancia global fija (--bus-db) o la que lleva la mezcla de referencia a --objetivo-lufs
let busDb = BUS_DB;
if (OBJ_LUFS !== null && items.length) {
    const m0 = mezcla();
    const l0 = lufsIntegrado(m0.ch.map((c) => c.subarray(0, Math.round(duracionTotal * SR))));
    busDb = Number.isFinite(l0) ? OBJ_LUFS - l0 : 0;
    console.log(`bus: la mezcla mide ${r3(l0)} LUFS; para ${OBJ_LUFS} LUFS se aplican ${r3(busDb)} dB`);
}
if (busDb) for (const q of items) { const v = q.vol * lineal(busDb); if (v > 1) avisos.push(`${q.id}: con el bus (${r3(busDb)} dB) pide ${r3(v)}; data-volume se queda en 1`); q.vol = Math.min(1, v); }

// ---- 5. polifonia: <= POLI sonidos simultaneos. Ventana audible = [t - min(ancla, 0.6), t + cola]
const ventana = (q) => [q.t - Math.min(q.ancla, 0.6), q.t + q.cola];
let atenuadosPoli = 0;
for (const q of items) {
    const [a] = ventana(q);
    const vivos = items.filter((o) => { const [x, y] = ventana(o); return x <= a + 1e-9 && y > a; }).sort((p, o) => o.rango - p.rango || o.vol - p.vol);
    vivos.slice(POLI).forEach((o) => {
        if (!o.polifonia) { o.polifonia = true; o.vol = o.vol * 0.5; atenuadosPoli++; avisos.push(`polifonia > ${POLI} en t=${r3(a)} s: se atenua ${o.id} (${o.nombre}, rango ${o.rango}) x0.5`); }
    });
}

// ---- 6. techo de la mezcla (lineal, como el motor)
let m = mezcla(), iter = 0;
const bajados = new Set();
while (items.length && m.pico > TOPE && iter < 80) {
    const f = Math.max(0.5, (TOPE / m.pico) * 0.97);
    for (const q of items.filter((x) => x.dataStart <= m.picoT + 0.002 && x.dataStart + x.dataDuration >= m.picoT - 0.002)) { q.vol *= f; bajados.add(q.id); }
    m = mezcla(); iter++;
}
if (m.pico > TOPE) fallar([`no se pudo bajar el pico de la mezcla de ${r3(db(m.pico))} a ${r3(db(TOPE))} dBFS`]);
if (bajados.size) avisos.push(`techo de mezcla: se bajo el volumen de ${bajados.size} cues para dejar el pico <= ${r3(db(TOPE))} dBFS (${iter} pasadas)`);
for (const q of items) q.vol = r3(q.vol);
if (items.length) m = mezcla();

// ---- 7. informe de nivel y densidad (verify-sfx.mjs lo exige; aqui se avisa)
const nVideo = Math.round(duracionTotal * SR);
const recorte = m.ch.map((c) => c.subarray(0, nVideo));
const niveles = nivelesPorSegundo(recorte, duracionTotal);
const saltos = saltosDeNivel(niveles.max100, REGLAS.pisoActivoDbFS);
const saltoMax = saltos.find((s) => s.cuenta) ?? { db: 0 };
const lufs = items.length ? lufsIntegrado(recorte) : -Infinity, pv = items.length ? picoVerdadero(recorte) : 0;
const cortes = indice.cuadros.slice(1).map((c) => c.start);
const dens = densidad(items, duracionTotal, cortes);
const ticks = ticksPorEntero(items);
const rev = whooshRevAlCierre(items, indice.cuadros.at(-1)?.id);
for (const s of saltos.filter((x) => x.cuenta && x.db > REGLAS.saltoMaxDb)) avisos.push(`subida de nivel de ${r3(s.db)} dB del segundo ${s.de} al ${s.a} (${s.niveles.map(r3).join(' -> ')} dBFS; maximo ${REGLAS.saltoMaxDb}): ajusta la ganancia de sus cues en sfx_cues`);
if (dens.sfxPorSeg > REGLAS.sfxPorSegMax) avisos.push(`densidad ${r3(dens.sfxPorSeg)} SFX/s (> ${REGLAS.sfxPorSegMax})`);
for (const d of dens.densos) avisos.push(`evento con ${d.capas} capas en t=${r3(d.t)} s (${d.nombres.join(' + ')}; maximo ${d.tope}${d.costura ? ' en costura' : ''})`);
for (const t of ticks) avisos.push(`${t.n} ticks en 1 s desde t=${r3(t.desde)} s: ticks por entero (maximo ${REGLAS.ticksMax})`);
for (const c of rev) avisos.push(`${c.id}: whoosh-rev en el cuadro final (prohibido antes de la voz del cierre)`);

// ---- 8. pistas (solo para Studio; el render no las lee): empaquetado voraz desde la 20
const fines = [];
for (const q of items) {
    let p = fines.findIndex((fin) => fin <= q.dataStart + 1e-9);
    if (p < 0) { p = fines.length; fines.push(0); }
    fines[p] = q.dataStart + q.dataDuration;
    q.pista = 20 + p;
}

// ---- 9. HTML
const lineas = items.map((q) => `      <audio id="sfx-${q.id}" src="${q.file}" data-start="${q.dataStart}"${q.mediaStart ? ` data-media-start="${q.mediaStart}"` : ''} data-duration="${q.dataDuration}" data-track-index="${q.pista}" data-volume="${q.vol}"></audio>`);
html = escribirBloque(html, 'sfx', 'generado por scripts/mount-sfx.mjs desde sfx_cues de STORYBOARD.md: data-start = t del cue - ancla del archivo', lineas.join('\n'));
let ducking = null;
const vozMontada = leerJson(P.vozMontada);
if (indice.tieneVoz && vozMontada) {
    const r = aplicarDucking(html, vozMontada.lineas ?? [], vozMontada.mezcla ?? {}, items);
    html = r.html; ducking = r.detalle;
    console.log(`voz ya montada: ducking reaplicado a ${ducking.length} efectos (datos/voz-montada.json)`);
} else if (indice.tieneVoz) avisos.push('index.html tiene <!-- voz --> pero falta datos/voz-montada.json: corre mount-voz.mjs para reaplicar el ducking');

const cuesJson = {
    generado: new Date().toISOString(), proyecto: R, duracion: duracionTotal,
    cuadros: Object.fromEntries(indice.cuadros.map((c) => [c.id, { start: c.start, duration: c.duration }])),
    cuadroFinal: indice.cuadros.at(-1)?.id ?? null,
    cues: items.map((q) => ({ id: q.id, cuadro: q.cuadro, frame: q.frame, n: q.n, nombre: q.nombre, texto: q.texto, tLocal: q.tLocal, t: q.t, gananciaDb: q.gananciaDb, categoria: q.categoria, anclaje: q.anclaje })),
};
const montado = {
    generado: cuesJson.generado, html: relative(R, P.index), duracion: duracionTotal,
    mezcla: {
        busDb: r3(busDb), picoDbFS: r3(db(m.pico)), picoT: r3(m.picoT), topeDbFS: r3(db(TOPE)), lufsIntegradoEstimado: Number.isFinite(lufs) ? r3(lufs) : null,
        picoVerdaderoEstimadoDbFS: r3(db(pv)), polifoniaMax: POLI, atenuadosPorPolifonia: atenuadosPoli,
        nivelPorSegundoDbFS: niveles.max100.map((v) => Math.round(v * 10) / 10), rmsPorSegundoDbFS: niveles.rms1.map((v) => Math.round(v * 10) / 10),
        saltoMaxDb: r3(saltoMax.db), saltosMayores: saltos.filter((s) => s.cuenta).slice(0, 3).map((s) => ({ deSegundo: s.de, aSegundo: s.a, db: r3(s.db) })),
        densidad: { cues: dens.cues, sfxPorSeg: r3(dens.sfxPorSeg), eventos: dens.eventos, eventosPorSeg: r3(dens.eventosPorSeg), capasMax: dens.capasMax },
    },
    cues: items.map((q) => ({
        id: q.id, audioId: `sfx-${q.id}`, file: q.file, cuadro: q.cuadro, sfx: q.nombre, tLocal: q.tLocal, tCue: q.t, gananciaDb: q.gananciaDb,
        dataStart: q.dataStart, mediaStart: q.mediaStart, dataDuration: q.dataDuration, ancla: r3(q.ancla), anclaje: q.anclaje, categoria: q.categoria,
        volume: q.vol, pista: q.pista, ...(q.polifonia ? { atenuadoPorPolifonia: true } : {}),
    })),
};

console.log(`SFX v4: ${items.length} <audio> desde ${cuadrosSb.filter((f) => f.sfxCuesCrudo).length} cuadros con sfx_cues; ${items.filter((q) => q.mediaStart).length} con data-media-start`);
console.log(`mezcla estimada: ${Number.isFinite(lufs) ? r3(lufs) : '-inf'} LUFS integrados, pico ${r3(db(m.pico))} dBFS (tope ${r3(db(TOPE))}), pico verdadero ${r3(db(pv))} dBFS, bus ${r3(busDb)} dB`);
console.log(`densidad: ${r3(dens.sfxPorSeg)} SFX/s, ${r3(dens.eventosPorSeg)} eventos/s (objetivo ${REGLAS.eventosPorSeg.join('-')}), hasta ${dens.capasMax} capas; subida de nivel maxima entre segundos ${r3(saltoMax.db)} dB (tope ${REGLAS.saltoMaxDb})`);
for (const a of avisos) console.log(`AVISO: ${a}`);
if (SECO) {
    console.log('--dry: no se escribio nada');
    console.log(lineas.slice(0, 8).join('\n'));
} else {
    mkdirSync(dirname(P.sfxMontado), { recursive: true });
    writeFileSync(P.index, html);
    writeFileSync(P.sfxCues, JSON.stringify(cuesJson, null, 1) + '\n');
    writeFileSync(P.sfxMontado, JSON.stringify(montado, null, 1) + '\n');
    const ref = opcion(argv, '--wav-referencia');
    if (ref) escribirWav(resolve(R, ref), recorte);
    console.log(`${relative(R, P.index)}, datos/sfx-cues.json y datos/sfx-montado.json actualizados`);
}
