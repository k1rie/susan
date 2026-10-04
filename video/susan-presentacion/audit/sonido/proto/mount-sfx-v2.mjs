#!/usr/bin/env node
// PROTOTIPO del montador v2. Lee cues absolutos (sfx-cues.json) + sfx-meta.json de la biblioteca y escribe los <audio> con
//   data-start = t - ancla      (el GOLPE del archivo cae en el instante visual)
// y, si t - ancla < 0, data-start = 0 y data-media-start = ancla - t (se recorta el principio del archivo).
// El audio de teclas se hornea aparte (bake-typing.mjs) y entra como un cue más.
// Uso: node mount-sfx-v2.mjs <cues.json> <index.html> [--lib <carpeta>] [--out <index-salida.html>]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const [cuesPath, htmlPath] = process.argv.slice(2, 4);
const opt = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const manifiesto = JSON.parse(readFileSync(cuesPath, 'utf8'));
const lib = resolve(opt('--lib', manifiesto.libreria));
const meta = Object.fromEntries(JSON.parse(readFileSync(join(lib, 'sfx-meta.json'), 'utf8')).map((m) => [m.archivo.replace(/\.\w+$/, ''), m]));
const r3 = (x) => Math.round(x * 1000) / 1000; // el motor redondea adelay al milisegundo (adelay = round(data-start*1000))
const cues = [...manifiesto.cues, ...(manifiesto.bakedCues ?? [])];
const lineas = [];
const salida = [];
cues.forEach((c, i) => {
    const m = meta[c.sfx];
    if (!m) throw new Error(`sfx desconocido: ${c.sfx}`);
    if (m.ancla === null) throw new Error(`${c.sfx} no tiene ancla (archivo silencioso/defectuoso)`);
    let inicio = c.t - m.ancla, media = 0;
    if (inicio < 0) { media = -inicio; inicio = 0; }
    // duración: toda la cola útil (nunca se corta antes de ancla + 150 ms; dos usos del mismo archivo SE SOLAPAN, no se recortan entre sí)
    const dur = Math.max(m.ancla - media + 0.15, m.duracion - media);
    const src = relative(dirname(resolve(htmlPath)), join(lib, m.archivo)).split('\\').join('/');
    lineas.push(`      <audio id="sfx-${c.id}" src="${src}" data-start="${r3(inicio)}" ${media ? `data-media-start="${r3(media)}" ` : ''}data-duration="${r3(dur)}" data-track-index="${20 + (i % 6)}" data-volume="${c.vol}"></audio>`);
    salida.push({ ...c, archivo: m.archivo, ancla: m.ancla, dataStart: r3(inicio), mediaStart: r3(media), golpeEsperado: r3(inicio + m.ancla - media) });
});
const bloque = `\n      <!-- sfx:start (v2: data-start = golpe visual - ancla) -->\n${lineas.join('\n')}\n      <!-- sfx:end -->\n`;
let html = readFileSync(htmlPath, 'utf8').replace(/\n?[ \t]*<!-- sfx:start[^>]*-->[\s\S]*?<!-- sfx:end -->\n?/g, '\n');
html = html.replace(/(\n\s*)<\/div>(\s*<script>)/, `${bloque}    </div>$2`);
writeFileSync(opt('--out', htmlPath), html);
writeFileSync(opt('--manifest-out', 'sfx-mounted.json'), JSON.stringify({ libreria: lib, cues: salida }, null, 1));
console.log(`${lineas.length} cues montados; ${salida.filter((s) => s.mediaStart).length} con data-media-start`);
