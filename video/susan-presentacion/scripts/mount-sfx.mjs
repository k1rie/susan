#!/usr/bin/env node
// Montador de efectos v2 (REEMPLAZA al que montaba con el inicio del archivo y recortaba por el cue siguiente).
//
// Entrada : v2/sfx-cues.json (lo escribe `extract-events.mjs --cues`: un cue por etiqueta sfx:<nombre>@<vol>#<n> con tiempo ABSOLUTO)
//           assets/sfx/CATALOG.json (ancla, duracion, categoria, volumen por defecto de cada sonido)
// Salida  : bloque <!-- sfx:start --> ... <!-- sfx:end --> de index.html (se reemplaza; idempotente) + v2/sfx-mounted.json
//           + assets/sfx/baked/<cuadro>-<n>.wav (frases tecleadas, ver bake-typing.mjs)
//
// Uso:  node scripts/mount-sfx.mjs [--root <proyecto>] [--cues v2/sfx-cues.json] [--html index.html] [--dry]
//                                  [--polifonia 4] [--tope-dbfs -1.5] [--gap-frase 0.6] [--wav-referencia <ruta.wav>]
//   Orden de trabajo del proyecto:  extract-events.mjs --cues  ->  mount-sfx.mjs  ->  verify-sfx.mjs  ->  render  ->  verify-sfx.mjs --video
//
// Reglas (audit/sonido/REPORT.md 7.2 y 7.5):
//   data-start      = round(t - ancla, 3); si es < 0: data-start = 0 y data-media-start = ancla - t (se recorta el principio del archivo)
//   data-duration   = max(ancla - mediaStart + 0.15, duracion - mediaStart): NUNCA se recorta un archivo por el cue siguiente (dos usos del
//                     mismo archivo se solapan). El corte de data-duration es duro: jamas por debajo de ancla + 150 ms.
//   data-volume     = volumen de la etiqueta x ganancia de su categoria (sfx-lib GANANCIA_DB / `gananciaDb` del catalogo; tope VOL_MAX_CUE 0.80), o
//                     volDefecto del catalogo (que ya trae la ganancia) si la etiqueta no lleva volumen; despues, AJUSTES_CUE (sfx-lib) por nombre + ventana de tiempo
//   teclas          = una frase (key-* a <= 0.6 s entre si, mismo cuadro) se hornea en un wav y se monta como UN <audio> (data-volume 1)
//   polifonia       <= 4 simultaneos: si hay mas, los de menor rango (catalogo.rango) se atenuan x0.5 y se avisa
//   tope de mezcla  se suma la forma de onda real de todos los <audio> (lineal, como el motor) y se baja el volumen de los cues presentes en el
//                   pico hasta que el pico quede <= -1.5 dBFS (por defecto; v2.1: antes -1, con margen para el pico verdadero tras AAC)
//   informe         LUFS integrados y pico verdadero ESTIMADOS por el mezclador de referencia (validado contra ffmpeg ebur128); --wav-referencia guarda la mezcla
// Salida de verificacion: v2/sfx-mounted.json con { id, file, cuadro, tCue, dataStart, ancla, ... } por <audio>.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { AJUSTES_CUE, RANGO, SR, VOL_MAX_CUE, cargarCatalogo, db, escribirWav, leerWav, lineal, lufsIntegrado, mezclar, opcion, picoVerdadero, raiz, r3, volConGanancia } from './lib/sfx-lib.mjs';
import { agruparTeclas, esTecla, hornearFrase, ANCLA_HORNEADO } from './bake-typing.mjs';

const R = raiz();
const seco = process.argv.includes('--dry');
const POLI = Number(opcion(process.argv, '--polifonia', 4));
const TOPE = 10 ** (Number(opcion(process.argv, '--tope-dbfs', -1.5)) / 20);
const GAP = Number(opcion(process.argv, '--gap-frase', 0.6));
const rutaCues = resolve(R, opcion(process.argv, '--cues', 'v2/sfx-cues.json'));
const rutaHtml = resolve(R, opcion(process.argv, '--html', 'index.html'));
const rutaSalida = join(R, 'v2/sfx-mounted.json');
const avisos = [];

if (!existsSync(rutaCues)) { console.error(`mount-sfx: falta ${rutaCues}. Ejecuta antes:  node scripts/extract-events.mjs --cues`); process.exit(1); }
const manifiesto = JSON.parse(readFileSync(rutaCues, 'utf8'));
const cat = cargarCatalogo(R);
let html = readFileSync(rutaHtml, 'utf8');
const duracionTotal = manifiesto.duracion ?? Number(/id="root"[\s\S]*?data-duration="([\d.]+)"/.exec(html)?.[1] ?? 0);

// ---- 1. resolver nombres contra el catalogo (un nombre desconocido es un error: no se adivina)
const desconocidos = [...new Set(manifiesto.cues.filter((c) => !cat[c.nombre]).map((c) => `${c.cuadro}: ${c.nombre}`))];
if (desconocidos.length) { console.error(`mount-sfx: sonidos que no estan en CATALOG.json:\n  ${desconocidos.join('\n  ')}`); process.exit(1); }

// ---- 2. cues normales + frases horneadas
const items = [];
const wavDe = {};
const cargar = (file) => (wavDe[file] ??= leerWav(join(R, file)));
for (const c of manifiesto.cues.filter((x) => !esTecla(x.nombre))) {
    const e = cat[c.nombre];
    items.push({ id: c.id, cuadro: c.cuadro, nombre: c.nombre, file: e.file, t: c.t, ancla: e.anclaMs / 1000, dur: e.duracionMs / 1000, cola: e.colaMs / 1000,
        vol: c.vol != null ? volConGanancia(c.vol, e) : e.volDefecto, categoria: e.categoria, rango: e.rango, anclaje: e.anclaje });
}
const frases = agruparTeclas(manifiesto.cues, GAP);
const dirBaked = join(R, 'assets/sfx/baked');
if (!seco) { mkdirSync(dirBaked, { recursive: true }); for (const f of readdirSync(dirBaked)) if (f.endsWith('.wav')) rmSync(join(dirBaked, f)); }
for (const f of frases) {
    const b = hornearFrase(R, cat, f);
    const file = `assets/sfx/baked/${f.cuadro}-${f.n}.wav`;
    if (!seco) escribirWav(join(R, file), b.ch);
    wavDe[file] = { sr: SR, canales: 2, frames: b.ch[0].length, ch: b.ch, dur: b.dur };
    items.push({ id: `${f.cuadro}-teclas${f.n}`, cuadro: f.cuadro, nombre: `teclas(${f.teclas.length})`, file, t: f.teclas[0].t, ancla: ANCLA_HORNEADO, dur: b.dur, cola: b.dur - ANCLA_HORNEADO,
        vol: 1, categoria: 'key', rango: RANGO.key, anclaje: 'hit', horneado: { teclas: f.teclas.length, hasta: r3(f.teclas.at(-1).t) } });
}
items.sort((a, b) => a.t - b.t);

// ---- 2b. ajustes puntuales por cue (sfx-lib AJUSTES_CUE): suavizan saltos de nivel sin tocar los cuadros
let ajustados = 0;
for (const aj of AJUSTES_CUE) {
    const en = items.filter((q) => q.nombre === aj.nombre && q.t >= aj.desde && q.t <= aj.hasta);
    if (!en.length) { avisos.push(`AJUSTES_CUE sin coincidencias: ${aj.nombre} en ${aj.desde}-${aj.hasta} s (${aj.motivo ?? ''}); revisa la ventana si el cuadro cambio`); continue; }
    for (const q of en) { q.vol = r3(Math.min(VOL_MAX_CUE, aj.vol ?? q.vol * lineal(aj.db))); ajustados++; }
}

// ---- 3. polifonia: <= POLI sonidos simultaneos. Ventana audible = [t - min(ancla, 0.6), t + cola]
const ventana = (q) => [q.t - Math.min(q.ancla, 0.6), q.t + q.cola];
let atenuadosPoli = 0;
for (const q of items) {
    const [a] = ventana(q);
    const vivos = items.filter((o) => { const [x, y] = ventana(o); return x <= a + 1e-9 && y > a; }).sort((p, o) => o.rango - p.rango || o.vol - p.vol);
    vivos.slice(POLI).forEach((o) => {
        if (!o.polifonia) { o.polifonia = true; o.vol = r3(o.vol * 0.5); atenuadosPoli++; avisos.push(`polifonia > ${POLI} en t=${r3(a)} s: se atenua ${o.id} (${o.nombre}, rango ${o.rango}) x0.5`); }
    });
}

// ---- 4. atributos de cada <audio>
for (const q of items) {
    let inicio = q.t - q.ancla, media = 0;
    if (inicio < 0) { media = -inicio; inicio = 0; }
    q.dataStart = r3(inicio);
    q.mediaStart = r3(media);
    let d = Math.max(q.ancla - q.mediaStart + 0.15, q.dur - q.mediaStart);
    const resto = duracionTotal - q.dataStart;
    if (duracionTotal > 0 && d > resto && resto >= q.ancla - q.mediaStart + 0.15) d = resto;   // no pasar del final del video, sin cortar el golpe
    // el piso de ancla + 0.15 s no debe pasar de la duracion real del archivo: el motor acorta el hueco al largo del medio y
    // `hyperframes check` avisa (clip_media_fit) por cada sonido corto (tick/pop de 70 ms). floor a 1 ms para no quedar por encima.
    const largo = Math.floor((q.dur - q.mediaStart) * 1000) / 1000;
    if (largo > 0 && d > largo) d = largo;
    q.dataDuration = r3(d);
}

// ---- 5. tope de mezcla: se suma la forma de onda real (lineal, como el motor)
const mezcla = () => mezclar(items.map((q) => ({ wav: cargar(q.file), dataStart: q.dataStart, mediaStart: q.mediaStart, dataDuration: q.dataDuration, vol: q.vol })), duracionTotal);
let m = mezcla(), iter = 0, bajados = new Set();
while (m.pico > TOPE && iter < 80) {
    const f = Math.max(0.5, (TOPE / m.pico) * 0.97);
    const en = items.filter((q) => q.dataStart <= m.picoT + 0.002 && q.dataStart + q.dataDuration - q.mediaStart >= m.picoT - 0.002);
    for (const q of en) { q.vol = r3(q.vol * f); bajados.add(q.id); }
    m = mezcla(); iter++;
}
if (m.pico > TOPE) { console.error(`mount-sfx: no se pudo bajar el pico de la mezcla de ${r3(db(m.pico))} dBFS a ${r3(db(TOPE))} dBFS`); process.exit(1); }
if (bajados.size) avisos.push(`tope de mezcla: se bajo el volumen de ${bajados.size} cues para llevar el pico a <= ${r3(db(TOPE))} dBFS (${iter} pasadas)`);
// nivel por ventana de 1 s (informativo para el director): RMS maximo y mayor salto entre ventanas contiguas
const rms1 = [];
// solo ventanas COMPLETAS dentro del video: la ultima ventana parcial (45.00-45.05 s) se promediaba sobre 1 s de silencio de relleno y daba un salto falso de 22 dB
for (let s = 0; s + SR <= m.ch[0].length && (s + SR) / SR <= duracionTotal + 1e-9; s += SR) {
    let a = 0; for (let i = s; i < s + SR; i++) a += (m.ch[0][i] ** 2 + m.ch[1][i] ** 2) / 2;
    rms1.push(Math.max(-60, db(Math.sqrt(a / SR))));   // piso de -60 dBFS: el silencio absoluto no cuenta como salto
}
const saltoMax = Math.max(0, ...rms1.slice(1).map((v, i) => Math.abs(v - rms1[i])));
const saltos = rms1.slice(1).map((v, i) => ({ de: i, a: i + 1, db: Math.abs(v - rms1[i]) })).sort((a, b) => b.db - a.db);
// sonoridad y pico verdadero estimados sobre la duracion exacta del video (sin el segundo de relleno de la mezcla)
const nVideo = Math.round(duracionTotal * SR);
const recorte = m.ch.map((c) => c.subarray(0, nVideo));
const lufs = lufsIntegrado(recorte), picoVerd = picoVerdadero(recorte);
let saturadas = 0; for (const c of recorte) for (let i = 0; i < c.length; i++) if (Math.abs(c[i]) >= 0.99) saturadas++;
const maxVol = Math.max(...items.filter((q) => !q.horneado).map((q) => q.vol));   // los wav horneados van a 1: sus teclas ya llevan la ganancia dentro
const rutaWavRef = opcion(process.argv, '--wav-referencia');
if (rutaWavRef) escribirWav(resolve(R, rutaWavRef), recorte);
// ventana de 3 s mas debil de los primeros 2.5 s (el gancho) para vigilar que el tecleo suene
const rmsGancho = rms1.slice(0, 3);

// ---- 6. pistas (solo para Studio; el render no las lee): empaquetado voraz en 20..
const fines = [];
for (const q of items) {
    let p = fines.findIndex((fin) => fin <= q.dataStart + 1e-9);
    if (p < 0) { p = fines.length; fines.push(0); }
    fines[p] = q.dataStart + q.dataDuration;
    q.pista = 20 + p;
}

// ---- 7. HTML
const idDe = (q) => `sfx-${q.id}`;
const lineas = items.map((q) => `      <audio id="${idDe(q)}" src="${q.file}" data-start="${q.dataStart}"${q.mediaStart ? ` data-media-start="${q.mediaStart}"` : ''} data-duration="${q.dataDuration}" data-track-index="${q.pista}" data-volume="${r3(q.vol)}"></audio>`);
const bloque = `      <!-- sfx:start (generado por scripts/mount-sfx.mjs v2: data-start = t del cue - ancla del archivo; NO editar a mano) -->\n${lineas.join('\n')}\n      <!-- sfx:end -->`;
const reMarca = /[ \t]*<!-- sfx:start[^>]*-->[\s\S]*?<!-- sfx:end -->/;
if (reMarca.test(html)) html = html.replace(reMarca, () => bloque);
else {
    const iScript = html.search(/<script>/);
    const iCierre = html.lastIndexOf('</div>', iScript);
    if (iScript < 0 || iCierre < 0) { console.error('mount-sfx: no se encontro <!-- sfx:start --> ni el cierre de #root antes del <script>'); process.exit(1); }
    html = `${html.slice(0, iCierre)}${bloque}\n    ${html.slice(iCierre)}`;
}

// ---- 8. v2/sfx-mounted.json (lo leen verify-sfx.mjs y verify-sfx-sync.py)
const mounted = {
    generado: new Date().toISOString(),
    html: relative(R, rutaHtml),
    duracion: duracionTotal,
    mezcla: { picoDbFS: r3(db(m.pico)), picoT: r3(m.picoT), topeDbFS: r3(db(TOPE)), rmsMax1sDbFS: r3(Math.max(...rms1)), saltoMax1sDb: r3(saltoMax),
        lufsIntegradoEstimado: r3(lufs), picoVerdaderoEstimadoDbFS: r3(db(picoVerd)), muestrasMayoresA099: saturadas, volMaxCue: r3(maxVol), polifoniaMax: POLI,
        saltosMayores: saltos.slice(0, 3).map((x) => ({ deSegundo: x.de, aSegundo: x.a, db: r3(x.db) })), rmsGancho1s: rmsGancho.map(r3), rmsPorSegundoDbFS: rms1.map((v) => Math.round(v * 10) / 10) },
    cues: items.map((q) => ({
        id: idDe(q).slice(4), audioId: idDe(q), file: q.file, cuadro: q.cuadro, sfx: q.nombre, tCue: r3(q.t), dataStart: q.dataStart, mediaStart: q.mediaStart,
        dataDuration: q.dataDuration, ancla: r3(q.ancla), anclaje: q.anclaje, categoria: q.categoria, volume: r3(q.vol), pista: q.pista,
        ...(q.horneado ? { horneado: q.horneado } : {}), ...(q.polifonia ? { atenuadoPorPolifonia: true } : {}),
    })),
};
const conMedia = items.filter((q) => q.mediaStart).length;
console.log(`SFX v2: ${items.length} <audio> (${manifiesto.cues.length} cues; ${frases.length} frases horneadas con ${frases.reduce((a, f) => a + f.teclas.length, 0)} teclas); ${conMedia} con data-media-start`);
console.log(`mezcla estimada: ${mounted.mezcla.lufsIntegradoEstimado} LUFS integrados, pico verdadero ${mounted.mezcla.picoVerdaderoEstimadoDbFS} dBFS, ${saturadas} muestras >= 0.99, volumen maximo de cue ${mounted.mezcla.volMaxCue}, ${ajustados} cues con ajuste puntual`);
console.log(`gancho (RMS por segundo 0-2 s): ${rmsGancho.map((v) => r3(v)).join(' / ')} dBFS; mayores saltos entre segundos: ${saltos.slice(0, 6).map((x) => `${x.de}->${x.a} s ${r3(x.db)} dB`).join(', ')}`);
console.log(`mezcla: pico ${mounted.mezcla.picoDbFS} dBFS (tope ${mounted.mezcla.topeDbFS}), RMS maximo por segundo ${mounted.mezcla.rmsMax1sDbFS} dBFS, salto maximo entre segundos ${mounted.mezcla.saltoMax1sDb} dB, atenuados por polifonia: ${atenuadosPoli}`);
for (const a of avisos) console.log(`AVISO: ${a}`);
if (seco) {
    console.log('--dry: no se escribio nada');
    console.log(lineas.slice(0, 6).join('\n'));
} else {
    mkdirSync(dirname(rutaSalida), { recursive: true });
    writeFileSync(rutaHtml, html);
    writeFileSync(rutaSalida, JSON.stringify(mounted, null, 1) + '\n');
    console.log(`${relative(R, rutaHtml)} y v2/sfx-mounted.json actualizados`);
}
