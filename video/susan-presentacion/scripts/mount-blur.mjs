#!/usr/bin/env node
// Agrega desenfoque de movimiento DIRECCIONAL a las transiciones de empuje, cortina y barrida de index.html.
//
// Técnica (receta motion-blur-streak de HyperFrames, la misma de whip-pan-cut): un <feGaussianBlur> de un solo eje (stdDeviation "X 0" o
// "0 Y") aplicado con CSS filter solo MIENTRAS dura el movimiento, con una envolvente que sube con power3.in hasta la mitad y baja con
// power3.out: refleja la curva de velocidad de power3.inOut (la de los empujes), así el borroso es máximo a la velocidad máxima y es cero en
// los extremos. El valor se reescribe en cada actualización de la línea de tiempo (determinista, seek-safe) y el filtro se quita al
// terminar (fuera de la transición no hay capa de filtro: costo cero). Techo 30 px (límite de legibilidad de la receta).
//
// Entradas: index.html con el bloque de transiciones de scripts/build-index.mjs (no se edita). Salida: dos bloques idempotentes,
//   <!-- blur-defs:start/end -->  (las definiciones SVG de los filtros, antes del <script> principal)
//   // <!-- blur:start/end -->     (los tweens, justo después de «transitions:end»)
// ORDEN DEL PIPELINE: build-index -> extract-events -> mount-sfx -> mount-voz -> mount-blur -> render (build-index reescribe index.html).
// Uso: node scripts/mount-blur.mjs [--dry] [--quitar]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const seco = args.includes('--dry');
const quitar = args.includes('--quitar');

// Una fila por elemento que se mueve en una transición. Los tiempos y selectores son los del bloque de transiciones (se comprueban abajo).
// pico = stdDeviation máxima en px: ~ proporcional a la distancia que recorre (techo 30); el saliente recorre menos, así que lleva menos.
const FILAS = [
    // 2. 02-minutos -> 03-tarde: push up 0.4 s @ 7.78 (entra 1080 px; sale 378 px)
    { id: 'mb-02-in',  sel: '#el-03-tarde',    eje: 'y', pico: 30, t: 7.78,  dur: 0.4  },
    { id: 'mb-02-out', sel: '#el-02-minutos',  eje: 'y', pico: 11, t: 7.78,  dur: 0.4  },
    // 3. 03-tarde -> 04-intro: squeeze 0.4 s @ 10.88 (la cortina barre todo el ancho; escala en X, sin traslado)
    { id: 'mb-03-out', sel: '#el-03-tarde',    eje: 'x', pico: 22, t: 10.88, dur: 0.4  },
    { id: 'mb-03-in',  sel: '#el-04-intro',    eje: 'x', pico: 22, t: 10.88, dur: 0.4  },
    // 7. 07-revision -> 08-reportes: push left 0.35 s @ 28.68 (entra 1920 px; sale 768 px)
    { id: 'mb-07-in',  sel: '#el-08-reportes', eje: 'x', pico: 30, t: 28.68, dur: 0.35 },
    { id: 'mb-07-out', sel: '#el-07-revision', eje: 'x', pico: 12, t: 28.68, dur: 0.35 },
    // 9. 09-analitica -> 10-alumno: wipe up 0.35 s @ 37.67 (el borde de acento recorre 1080 px; el contenido se descubre con clip-path)
    { id: 'mb-09-edge', sel: '#tx-borde-9',    eje: 'y', pico: 24, t: 37.67, dur: 0.35 },
    // 10. 10-alumno -> 11-confianza: push down 0.35 s @ 41.35 (entra 1080 px; sale 432 px)
    { id: 'mb-10-in',  sel: '#el-11-confianza', eje: 'y', pico: 30, t: 41.35, dur: 0.35 },
    { id: 'mb-10-out', sel: '#el-10-alumno',   eje: 'y', pico: 12, t: 41.35, dur: 0.35 },
];

const rutaIdx = join(RAIZ, 'index.html');
let html = readFileSync(rutaIdx, 'utf8');

// 0. Quitar bloques previos (idempotente).
const reDefs = /[ \t]*<!-- blur-defs:start[\s\S]*?<!-- blur-defs:end -->\n?/;
const reJs = /[ \t]*\/\/ <!-- blur:start[\s\S]*?\/\/ <!-- blur:end -->\n?/;
html = html.replace(reDefs, '').replace(reJs, '');
if (quitar) {
    if (!seco) writeFileSync(rutaIdx, html);
    console.log(seco ? '--dry: se quitarían los bloques de desenfoque' : 'Bloques de desenfoque quitados de index.html');
    process.exit(0);
}

// 1. Comprobar que cada fila corresponde a un tween real del bloque de transiciones (si build-index cambió los tiempos, no inventar).
const bloque = /<!-- transitions:start[\s\S]*?<!-- transitions:end -->/.exec(html)?.[0];
if (!bloque) { console.error('mount-blur: no encuentro el bloque de transiciones en index.html (¿se corrió build-index?)'); process.exit(1); }
const escapa = (s) => s.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&');
const faltan = FILAS.filter((f) => !new RegExp(`tl\\.(?:fromTo|to)\\("${escapa(f.sel)}",[^\\n]*?,\\s*${escapa(String(f.t))}\\);`).test(bloque));
if (faltan.length) {
    console.error('mount-blur: estas filas no coinciden con ningún tween del bloque de transiciones (¿cambiaron los tiempos?):\n' + faltan.map((f) => `  ${f.sel} @ ${f.t}`).join('\n'));
    process.exit(1);
}

// 2. Definiciones SVG (una por elemento; el eje decide hacia dónde se extiende la región del filtro).
const defs = FILAS.map((f) => {
    const region = f.eje === 'x' ? 'x="-50%" y="-20%" width="200%" height="140%"' : 'x="-20%" y="-50%" width="140%" height="200%"';
    return `        <filter id="${f.id}" ${region} color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="0 0" /></filter>`;
}).join('\n');
const bloqueDefs = `    <!-- blur-defs:start (generado por scripts/mount-blur.mjs: filtros de desenfoque direccional de las transiciones; NO editar a mano) -->
    <svg width="0" height="0" aria-hidden="true" style="position: absolute">
      <defs>
${defs}
      </defs>
    </svg>
    <!-- blur-defs:end -->
`;
const marcaScript = /^(\s*)<script>\n\s*window\.__timelines = window\.__timelines \|\| \{\};/m.exec(html);
if (!marcaScript) { console.error('mount-blur: no encuentro el <script> principal'); process.exit(1); }
html = html.slice(0, marcaScript.index) + bloqueDefs + html.slice(marcaScript.index);

// 3. Tweens: filtro puesto solo durante el movimiento + envolvente del valor (power3.in arriba, power3.out abajo).
const llamadas = FILAS.map((f) => `        mb(${JSON.stringify(f.sel)}, ${JSON.stringify(f.id)}, ${JSON.stringify(f.eje)}, ${f.pico}, ${f.t}, ${f.dur});`).join('\n');
const bloqueJs = `        // <!-- blur:start (generado por scripts/mount-blur.mjs; NO editar a mano) -->
        // Desenfoque de movimiento direccional: pico = stdDeviation en px (techo 30), envolvente igual a la velocidad de power3.inOut.
        function mb(sel, id, eje, pico, t0, dur) {
            var nodo = document.querySelector("#" + id + " feGaussianBlur");
            var proxy = { v: 0 };
            function escribe() { nodo.setAttribute("stdDeviation", eje === "x" ? proxy.v + " 0" : "0 " + proxy.v); }
            escribe();   // frame 0 sin desenfoque
            tl.set(sel, { filter: "url(#" + id + ")", immediateRender: false }, t0);
            tl.fromTo(proxy, { v: 0 }, { v: pico, duration: dur / 2, ease: "power3.in", onUpdate: escribe, immediateRender: false }, t0);
            tl.to(proxy, { v: 0, duration: dur / 2, ease: "power3.out", onUpdate: escribe }, t0 + dur / 2);
            tl.set(sel, { filter: "none", immediateRender: false }, t0 + dur);
        }
${llamadas}
        // <!-- blur:end -->
`;
const finTrans = /^(\s*)\/\/ <!-- transitions:end -->\n/m.exec(html);
if (!finTrans) { console.error('mount-blur: no encuentro «transitions:end»'); process.exit(1); }
const pos = finTrans.index + finTrans[0].length;
html = html.slice(0, pos) + bloqueJs + html.slice(pos);

console.log(`Desenfoque direccional: ${FILAS.length} elementos en 5 transiciones (pico máx ${Math.max(...FILAS.map((f) => f.pico))} px).`);
if (seco) console.log('--dry: no se escribió nada');
else { writeFileSync(rutaIdx, html); console.log('index.html actualizado (bloques blur-defs y blur)'); }
