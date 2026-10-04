#!/usr/bin/env node
// preview-frame.mjs - captura PNG de UN cuadro en los instantes que pidas, sin renderizar el video.
//
// Uso:
//   node scripts/preview-frame.mjs <frame_id> [--at 0.4,1.0,2.2] [--every 0.5] [--out DIR] [--sheet] [--file ruta.html]
//
//   <frame_id>   nombre del cuadro (compositions/frames/<id>.html), p. ej. 06-vivo
//   --at LISTA   instantes LOCALES del cuadro, en segundos, separados por coma
//   --every N    ademas (o en lugar de --at): un instante cada N s desde 0 hasta la duracion del cuadro (por omision 0.5 si no hay --at)
//   --out DIR    carpeta de salida (por omision v2/preview/<id>/); se guardan t-<seg>.png a 1920x1080
//   --sheet      ademas, una hoja de contactos sheet.png (4 columnas, con marca de tiempo) hecha con el propio Chrome
//   --file RUTA  usa otro archivo HTML en lugar de compositions/frames/<id>.html (p. ej. un borrador)
//
// Aloja el cuadro como el runtime (ver scripts/lib/frame-host.mjs): envoltorio con data-composition-id, fuentes de assets/, GSAP local,
// ventanas data-start/data-duration y el mismo "totalTime + meneo" que usa el adaptador gsap al buscar un instante.
// Los instantes se procesan en orden ascendente (igual que el render, que avanza hacia delante). Sale con codigo 1 si el cuadro falla al cargar.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearHost } from './lib/frame-host.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const tiene = (n) => args.includes(`--${n}`);
const id = args.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--at', '--every', '--out', '--file'].includes(args[i - 1])));
if (!id || tiene('help')) {
    console.error('Uso: node scripts/preview-frame.mjs <frame_id> [--at 0.4,1.0,2.2] [--every 0.5] [--out DIR] [--sheet] [--file ruta.html]');
    process.exit(id ? 0 : 2);
}
const salida = resolve(flag('out') ?? join(RAIZ, 'v2/preview', id));
mkdirSync(salida, { recursive: true });
const etiqueta = (t) => t.toFixed(2);

const host = await crearHost(RAIZ);
let codigo = 0;
try {
    const c = await host.abrir(id, { archivo: flag('file') });
    if (c.errores.length) { console.error(`Errores al cargar ${id}:\n  ${c.errores.join('\n  ')}`); codigo = 1; }
    if (!c.meta.registrado) { console.error(`El cuadro no registro window.__timelines["${id}"] (claves: ${c.meta.claves.join(', ') || 'ninguna'})`); process.exit(1); }
    const dur = c.meta.raizDuracion ?? c.meta.duracionTimeline;
    const tiempos = new Set();
    if (flag('at')) for (const x of flag('at').split(',')) { const n = Number(x); if (!Number.isFinite(n) || n < 0) { console.error(`Instante invalido: "${x}"`); process.exit(2); } tiempos.add(n); }
    if (flag('every') || !flag('at')) {
        const paso = Number(flag('every') ?? 0.5);
        if (!(paso > 0)) { console.error('--every debe ser > 0'); process.exit(2); }
        for (let t = 0; t <= dur + 1e-9; t += paso) tiempos.add(Math.round(t * 1000) / 1000);
    }
    const lista = [...tiempos].sort((a, b) => a - b);
    const t0 = Date.now();
    const archivos = [];
    for (const t of lista) {
        const f = join(salida, `t-${etiqueta(t)}.png`);
        await c.captura(t, { ruta: f });
        archivos.push({ t, f });
    }
    console.log(`${id}: ${archivos.length} capturas en ${((Date.now() - t0) / 1000).toFixed(1)} s (duracion ${dur} s, timeline ${c.meta.duracionTimeline?.toFixed(2)} s) -> ${salida}`);
    if (tiene('sheet')) {
        const celdas = archivos.map(({ t, f }) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>t = ${etiqueta(t)} s</figcaption></figure>`).join('');
        const filas = Math.ceil(archivos.length / 4);
        const p = await host.navegador.newPage();
        await p.setViewport({ width: 1920, height: Math.max(1, filas) * 300, deviceScaleFactor: 1 });
        await p.setContent(`<!doctype html><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#222;font:600 16px system-ui;color:#fff;width:1920px}
.g{display:grid;grid-template-columns:repeat(4,480px)}figure{position:relative;width:480px;height:300px;border:1px solid #222}img{display:block;width:480px;height:270px}
figcaption{height:30px;line-height:30px;padding-left:10px;background:#111}</style><div class="g">${celdas}</div>`);
        const hoja = join(salida, 'sheet.png');
        await p.screenshot({ path: hoja, clip: { x: 0, y: 0, width: 1920, height: filas * 300 } });
        await p.close();
        console.log(`hoja de contactos: ${hoja}`);
    }
    await c.cerrar();
} catch (e) {
    console.error(e.stack || String(e));
    codigo = 1;
} finally {
    await host.cerrar();
}
process.exit(codigo);
