#!/usr/bin/env node
// preview-frame.mjs - fotogramas PNG de UN cuadro de la v4 en los instantes que pidas (y hoja de contactos), sin renderizar el video.
//
// Uso:
//   node scripts/preview-frame.mjs <frame_id> [--at 0.4,1.0,2.2] [--every 0.5] [--bordes] [--anclas] [--sheet] [--out DIR] [--file ruta.html]
//
//   <frame_id>   sNN-nombre (compositions/frames/<id>.html)
//   --at LISTA   instantes LOCALES del cuadro (s), separados por coma
//   --every N    un instante cada N s de 0 a la duracion (por omision 0.5 si no hay --at ni --bordes ni --anclas)
//   --bordes     agrega los bordes del cuadro: 0, fin de la transicion entrante (si hay), duracion - 1/30 (el fotograma del handoff)
//   --anclas     agrega los instantes de vo_anchor y de sfx_cues del Frame (la imagen que acompana cada palabra y cada golpe)
//   --sheet      hoja de contactos sheet.png (4 columnas, con el instante y la etiqueta de cada celda)
//   --out DIR    carpeta de salida (por omision revision/<id>/, ignorada por git); t-<seg>.png al tamano del video
//   --file RUTA  aloja un borrador en lugar de compositions/frames/<id>.html
//
// Aloja el cuadro con el RUNTIME REAL de la CLI fijada (0.8.134) en un proyecto temporal con solo ese cuadro (scripts/lib/runtime-host.mjs)
// y busca cada instante con window.__player.renderSeek, como snapshot y render. Para el video completo usa `npx hyperframes@0.8.134 snapshot`.
// Sale con codigo 1 si el cuadro falla al cargar.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { opcion, raiz, rutas } from './lib/rutas.mjs';
import { leerStoryboard, parseAnclas, parseSfxCues } from './lib/storyboard.mjs';
import { crearHost } from './lib/runtime-host.mjs';

const R = raiz();
const P = rutas(R);
const args = process.argv.slice(2);
const VAL = new Set(['--at', '--every', '--out', '--file', '--root']);
const flag = (n) => opcion(args, `--${n}`);
const tiene = (n) => args.includes(`--${n}`);
const id = args.find((a, i) => !a.startsWith('--') && !(i > 0 && VAL.has(args[i - 1])));
if (!id || tiene('help')) {
    console.error('Uso: node scripts/preview-frame.mjs <frame_id> [--at 0.4,1.0] [--every 0.5] [--bordes] [--anclas] [--sheet] [--out DIR] [--file ruta.html]');
    process.exit(id ? 0 : 2);
}
const sb = existsSync(P.storyboard) ? leerStoryboard(readFileSync(P.storyboard, 'utf8')) : { frames: [], globals: {} };
const f = sb.frames.find((x) => x.frameId === id) ?? null;
const [ANCHO, ALTO] = (/^(\d+)x(\d+)$/.exec(sb.globals.format ?? '') ?? [0, 1920, 1080]).slice(1).map(Number);
const salida = resolve(flag('out') ?? join(P.revision, id));
mkdirSync(salida, { recursive: true });
const et = (t) => t.toFixed(2);

const host = await crearHost(R);
let codigo = 0;
try {
    const c = await host.abrirCuadro(id, { archivo: flag('file'), duracion: f?.duracion ?? null, ancho: ANCHO, alto: ALTO });
    if (c.errores.length) { console.error(`Errores al cargar ${id}:\n  ${c.errores.join('\n  ')}`); codigo = 1; }
    if (!c.meta.registrado) { console.error(`El cuadro no registro window.__timelines["${id}"] (claves: ${c.meta.claves.join(', ') || 'ninguna'})`); process.exit(1); }
    const D = c.meta.duracion;
    const tiempos = new Map();   // t -> etiqueta
    const poner = (t, e = '') => { const x = Math.round(Math.min(Math.max(t, 0), D - 1 / 30) * 1000) / 1000; if (!tiempos.has(x) || e) tiempos.set(x, [tiempos.get(x), e].filter(Boolean).join(' · ')); };
    if (flag('at')) for (const x of flag('at').split(',')) { const n = Number(x); if (!Number.isFinite(n) || n < 0) { console.error(`Instante invalido: "${x}"`); process.exit(2); } poner(n); }
    if (tiene('bordes')) { poner(0, 'inicio'); if (f?.transicion) poner(f.transicion.dur, `fin de ${f.transicion.tipo}`); poner(D - 1 / 30, 'handoff'); }
    if (tiene('anclas') && f) {
        for (const a of parseAnclas(f.voAnchorCrudo ?? '').anclas) poner(a.t, `«${a.palabra}»`);
        for (const q of parseSfxCues(f.sfxCuesCrudo ?? '').cues) poner(q.t, q.nombre);
    }
    if (flag('every') || (!flag('at') && !tiene('bordes') && !tiene('anclas'))) {
        const paso = Number(flag('every') ?? 0.5);
        if (!(paso > 0)) { console.error('--every debe ser > 0'); process.exit(2); }
        for (let t = 0; t < D - 1e-9; t += paso) poner(t);
    }
    const lista = [...tiempos.keys()].sort((a, b) => a - b);
    const t0 = Date.now();
    const archivos = [];
    for (const t of lista) {
        const ruta = join(salida, `t-${et(t)}.png`);
        await c.captura(t, { ruta });
        archivos.push({ t, ruta, etiqueta: tiempos.get(t) });
    }
    console.log(`${id}: ${archivos.length} capturas en ${((Date.now() - t0) / 1000).toFixed(1)} s (duracion ${D} s, timeline ${c.meta.duracionTimeline?.toFixed(2)} s) -> ${salida}`);
    if (tiene('sheet')) {
        const { readFileSync: leer } = await import('node:fs');
        const celdas = archivos.map(({ t, ruta, etiqueta }) => `<figure><img src="data:image/png;base64,${leer(ruta).toString('base64')}"><figcaption>t = ${et(t)} s${etiqueta ? ` · ${etiqueta}` : ''}</figcaption></figure>`).join('');
        const filas = Math.ceil(archivos.length / 4);
        const p = await host.navegador.newPage();
        await p.setViewport({ width: 1920, height: Math.max(1, filas) * 300, deviceScaleFactor: 1 });
        await p.setContent(`<!doctype html><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#222;font:600 16px sans-serif;color:#fff;width:1920px}
.g{display:grid;grid-template-columns:repeat(4,480px)}figure{position:relative;width:480px;height:300px;border:1px solid #222}img{display:block;width:480px;height:270px;object-fit:contain;background:#000}
figcaption{height:30px;line-height:30px;padding-left:10px;background:#111;white-space:nowrap;overflow:hidden}</style><div class="g">${celdas}</div>`);
        const hoja = join(salida, 'sheet.png');
        await p.screenshot({ path: hoja, clip: { x: 0, y: 0, width: 1920, height: Math.max(1, filas) * 300 } });
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
