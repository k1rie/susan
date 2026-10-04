#!/usr/bin/env node
// PRUEBA REAL del sistema de sonido v2 en un proyecto de juguete (NO toca el proyecto del video):
// genera 3 cuadros minimos (sub-composiciones <template>) que pegan scripts/frame-helpers.snippet.js y declaran cues sfx(), contadores,
// una frase tecleada y camara; ensambla index.html con transiciones (cuyas etiquetas viven en el timeline raiz); y ejecuta la cadena completa
//   extract-events.mjs --cues -> mount-sfx.mjs -> verify-sfx.mjs (biblioteca, etiquetas, montaje)  -> hyperframes render (0.8.114)
//   -> verify-sfx.mjs --video (correlacion de ataque contra el MP4)  -> CONTROL NEGATIVO (un cue declarado 80 ms tarde DEBE fallar).
// Uso: node scripts/test-sfx-toy.mjs [--dir <carpeta del juguete>] [--sin-render]
// Sale con codigo 1 si cualquiera de los pasos positivos falla o si el control negativo NO falla.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { opcion } from './lib/sfx-lib.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PROYECTO = resolve(AQUI, '..');
const D = resolve(opcion(process.argv, '--dir', join(tmpdir(), 'susan-toy-sfx')));
const SIN_RENDER = process.argv.includes('--sin-render');
const W = 960, H = 540;
const snippet = readFileSync(join(AQUI, 'frame-helpers.snippet.js'), 'utf8');
const sh = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...o });
const paso = (titulo, r, esperado = 0) => {
    const ok = (r.status === 0) === (esperado === 0);
    console.log(`\n=== ${titulo}: ${ok ? 'OK' : 'FALLO'} (codigo ${r.status}${esperado ? `, se esperaba != 0` : ''})`);
    console.log((r.stdout || '').trim().split('\n').slice(-40).join('\n'));
    if (r.status !== 0) console.log((r.stderr || '').trim().split('\n').slice(-15).join('\n'));
    if (!ok) { console.log('PRUEBA FALLIDA'); process.exit(1); }
    return r;
};

// ---- proyecto de juguete
rmSync(D, { recursive: true, force: true });
mkdirSync(join(D, 'compositions/frames'), { recursive: true });
mkdirSync(join(D, 'assets/sfx'), { recursive: true });
cpSync(join(PROYECTO, 'assets/sfx/derived'), join(D, 'assets/sfx/derived'), { recursive: true });
cpSync(join(PROYECTO, 'assets/sfx/CATALOG.json'), join(D, 'assets/sfx/CATALOG.json'));
writeFileSync(join(D, 'hyperframes.json'), readFileSync(join(PROYECTO, 'hyperframes.json')));
writeFileSync(join(D, 'meta.json'), JSON.stringify({ id: 'toy-sfx', name: 'toy-sfx' }));
writeFileSync(join(D, 'package.json'), JSON.stringify({ name: 'toy-sfx', private: true, type: 'module' }));

const GSAP = '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>';
const estilo = (id, fondo) => `<style>
#root{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;font-family:system-ui,sans-serif;background:${fondo}}
.${id}-cam{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
.${id}-b{position:absolute;width:150px;height:90px;border-radius:12px;background:#0061fe;top:130px}
.${id}-t{position:absolute;left:60px;top:40px;font-size:44px;font-weight:700;color:#1e1919;white-space:nowrap}
.${id}-k{position:absolute;left:60px;top:300px;font-size:34px;color:#1e1919;font-family:monospace;white-space:nowrap}
</style>`;
const marco = (id, dur, fondo, cuerpo, js) => `<template>
${estilo(id, fondo)}
<div id="root" data-composition-id="${id}" data-width="${W}" data-height="${H}" data-duration="${dur}">
  <div class="clip" data-start="0" data-duration="${dur}" data-track-index="0" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px"></div>
  <div class="${id}-cam" id="${id}-cam">
${cuerpo}
  </div>
</div>
${GSAP}
<script>
(function () {
    var tl = gsap.timeline({ paused: true });
${snippet}
${js}
    window.__timelines['${id}'] = tl;
})();
</script>
</template>
`;

// Cuadro A (0 - 3.0 s): chip + 4 brackets en escala + contador + clic + riser que termina en el slam
writeFileSync(join(D, 'compositions/frames/a.html'), marco('fa', 3, '#f7f5f2', `
    <div class="fa-t" id="fa-t" style="opacity:0">Cuadro A</div>
    <div class="fa-b" id="fa-b0" style="left:60px;opacity:0"></div><div class="fa-b" id="fa-b1" style="left:260px;opacity:0"></div>
    <div class="fa-b" id="fa-b2" style="left:460px;opacity:0"></div><div class="fa-b" id="fa-b3" style="left:660px;opacity:0"></div>
    <div class="fa-k" id="fa-n">0</div>
    <div class="fa-b" id="fa-btn" style="left:60px;top:400px;width:200px;background:#1e1919"></div>
    <div class="fa-b" id="fa-slam" style="left:300px;top:380px;width:420px;height:110px;background:#c98100;opacity:0"></div>`, `
    var $ = function (n) { return document.getElementById('fa-' + n); };
    // caso ancla > t: el slam cae a 0.45 s y su riser corto (ancla 0.6 s) arranca en data-start 0 con data-media-start
    tl.fromTo($('t'), { y: 30, opacity: 0, scale: 1.4 }, { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: 'power3.out', data: 'hero' }, 0.45);
    sfx(tl, 0.45, 'riser-s', 0.5);
    sfx(tl, 0.45, 'thud', 0.75);
    // 4 brackets: UNA variable de tiempo para tween y sonido
    for (var k = 0; k < 4; k++) {
        var T = 0.75 + k * 0.3;
        tl.fromTo($('b' + k), { opacity: 0, scale: 0.82 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.7)', data: 'hero' }, T);
        sfx(tl, T, 'ping-note' + (k * 2 + 1), 0.5);
    }
    // contador 0 -> 24 (power2.out) de 1.1 a 2.0 s con un tick por cambio de entero
    var obj = { v: 0 };
    tl.to(obj, { v: 24, duration: 0.9, ease: 'power2.out', data: 'hero', onUpdate: function () { $('n').textContent = Math.round(obj.v); } }, 1.1);
    sfxCount(tl, 1.1, 2.0, 0, 24, { ease: 'power2.out' });
    // clic del boton
    tl.fromTo($('btn'), { scale: 1 }, { scale: 0.92, duration: 0.12, ease: 'power2.out', data: 'hero' }, 2.1);
    sfx(tl, 2.1, 'click-hard', 0.5);
    // slam con riser de 1 s que TERMINA en el impacto (anclaje fin: t = impacto)
    tl.fromTo($('slam'), { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'power4.out', data: 'hero' }, 2.5);
    sfx(tl, 2.5, 'riser-1s', 0.55);
    sfx(tl, 2.5, 'impact-hit', 0.8);
`));

// Cuadro B (2.6 - 5.6 s): snap de camara, check, chime, frase tecleada con sfxType + Enter
const FRASE = 'Pasa lista en 6 segundos';
writeFileSync(join(D, 'compositions/frames/b.html'), marco('fb', 3, '#e7f4ea', `
    <div class="fb-t" id="fb-t">Cuadro B</div>
    <div class="fb-b" id="fb-ok" style="left:60px;opacity:0;background:#1f7a47"></div>
    <div class="fb-k" id="fb-k"></div>`, `
    var $ = function (n) { return document.getElementById('fb-' + n); };
    camInit('#fb-cam', 1, 0, 0);
    camSnap(tl, '#fb-cam', 0.3, 1.25, { foco: [300, 200], W: ${W}, H: ${H} });          // snap-zoom con 'snap' por defecto
    camPull(tl, '#fb-cam', 1.9, 1, { sfx: 'zoom-out' });                                    // segundo fromTo sobre el MISMO objetivo (immediateRender:false)
    tl.fromTo($('ok'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)', data: 'hero' }, 0.8);
    sfx(tl, 0.8, 'check', 0.5);
    sfx(tl, 0.8, 'chime-trim', 0.4);
    // frase tecleada: reloj de texto a 28 ms por caracter (36 teclas/s: se decima a <= 14/s)
    var txt = ${JSON.stringify(FRASE)}, tiempos = [], clk = { i: 0 };
    for (var i = 0; i < txt.length; i++) tiempos.push(i * 0.028);
    var T0 = 0.9;
    tl.to(clk, { i: txt.length, duration: txt.length * 0.028, ease: 'none', onUpdate: function () { $('k').textContent = txt.slice(0, Math.round(clk.i)); } }, T0);
    sfxType(tl, T0, tiempos, { texto: txt, enter: true });
    readMark(tl, T0 + txt.length * 0.028, 'Pasa lista en 6 segundos');
`));

// Cuadro C (5.2 - 8.0 s): sello, barrido de luz (sheen), trazo, check
writeFileSync(join(D, 'compositions/frames/c.html'), marco('fc', 2.8, '#fbefd2', `
    <div class="fc-t" id="fc-t">Cuadro C</div>
    <div class="fc-b" id="fc-st" style="left:60px;opacity:0;background:#b3261e"></div>
    <div class="fc-b" id="fc-sp" style="left:360px;opacity:0;background:#9a6408"></div>
    <svg style="position:absolute;left:60px;top:300px" width="400" height="120"><path id="fc-pa" d="M0 100 C 100 0, 200 200, 400 20" stroke="#0061fe" stroke-width="8" fill="none"/></svg>`, `
    var $ = function (n) { return document.getElementById('fc-' + n); };
    tl.fromTo($('st'), { opacity: 0, scale: 2 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'power4.out', data: 'hero' }, 0.5);
    sfx(tl, 0.5, 'stamp', 0.7);
    tl.fromTo($('sp'), { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)', data: 'hero' }, 1.0);
    sfx(tl, 1.0, 'sheen', 0.28);
    var L = $('pa').getTotalLength();
    tl.fromTo($('pa'), { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut', data: 'hero' }, 1.3);
    sfx(tl, 1.3, 'draw', 0.4);
    sfx(tl, 2.0, 'check', 0.5);
    tl.fromTo($('t'), { opacity: 0 }, { opacity: 1, duration: 0.2, data: 'hero' }, 2.0);
`));

const pie = (id, ini, dur, pista) => `  <div id="el-${id}" class="scene" data-composition-id="${id}" data-composition-src="compositions/frames/${id.slice(1)}.html" data-start="${ini}" data-duration="${dur}" data-track-index="${pista}"></div>`;
writeFileSync(join(D, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=${W}, height=${H}" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden;background:#000}#root{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#f7f5f2}.scene{position:absolute;inset:0;width:100%;height:100%}</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="8" data-width="${W}" data-height="${H}">
${pie('fa', 0, 3, 0)}
${pie('fb', 2.6, 3, 1)}
${pie('fc', 5.2, 2.8, 0)}

      <!-- sfx:start -->
      <!-- sfx:end -->
    </div>
<script>
window.__timelines = window.__timelines || {};
(function () {
    var tl = gsap.timeline({ paused: true });
    window.__timelines['main'] = tl;
${snippet}
    // transiciones (como las deja build-index): push-slide A->B y disolvencia B->C; el whoosh cae en el punto de maxima velocidad
    tl.to('#el-fa', { x: -${W}, duration: 0.5, ease: 'power3.inOut' }, 2.6);
    tl.fromTo('#el-fb', { x: ${W} }, { x: 0, duration: 0.5, ease: 'power3.inOut' }, 2.6);
    sfx(tl, 2.85, 'whoosh-m', 0.5);
    tl.to('#el-fb', { opacity: 0, duration: 0.4, ease: 'power2.inOut' }, 5.2);
    tl.fromTo('#el-fc', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.inOut' }, 5.2);
    sfx(tl, 5.4, 'swipe', 0.5);
    // caso ancla > t en el raiz: whoosh que llega a su pico a los 0.07 s del video (data-start 0 + data-media-start)
    sfx(tl, 0.07, 'whoosh-s', 0.5);
    tl.to({}, { duration: 8 }, 0);
})();
</script>
</body></html>
`);

const R = ['--root', D];
const nodeS = (s, ...a) => sh('node', [join(AQUI, s), ...R, ...a]);
paso('extract-events --cues', nodeS('extract-events.mjs', '--cues'));
paso('mount-sfx', nodeS('mount-sfx.mjs'));
paso('verify-sfx (biblioteca, etiquetas, montaje)', nodeS('verify-sfx.mjs'));

// ---- CONTROL NEGATIVO de sonidos obsoletos: un cue con un sonido marcado `deprecated` en CATALOG.json (sparkle-short) DEBE hacer fallar verify-sfx.mjs.
// Se reescribe una copia del manifiesto de cues (el de verdad se restaura) y se comprueba que el error nombra el obsoleto.
{
    const rutaCues = join(D, 'v2/sfx-cues.json');
    const original = readFileSync(rutaCues, 'utf8');
    const obj = JSON.parse(original);
    const sheen = obj.cues.find((c) => c.nombre === 'sheen');
    if (!sheen) { console.log('PRUEBA FALLIDA: el juguete no tiene el cue sheen'); process.exit(1); }
    sheen.nombre = 'sparkle-short';
    writeFileSync(rutaCues, JSON.stringify(obj, null, 1));
    const r = nodeS('verify-sfx.mjs', '--solo', 'etiquetas');
    writeFileSync(rutaCues, original);
    const detecta = r.status === 1 && /obsoleto/.test(r.stdout);
    console.log(`\n=== CONTROL (cue con sparkle-short, obsoleto): ${detecta ? 'OK, verify-sfx lo rechaza' : 'FALLO, verify-sfx NO lo rechazo'}`);
    if (!detecta) { console.log((r.stdout || '').trim().split('\n').slice(-12).join('\n')); console.log('PRUEBA FALLIDA'); process.exit(1); }
}
if (SIN_RENDER) { console.log('\n--sin-render: fin'); process.exit(0); }
mkdirSync(join(D, 'renders'), { recursive: true });
const rr = sh('npx', ['--yes', 'hyperframes@0.8.114', 'render', '--output', 'renders/toy.mp4'], { cwd: D });
paso('hyperframes render', rr);
paso('verify-sfx --video (correlacion de ataque, tolerancia 33.3 ms)', nodeS('verify-sfx.mjs', '--video', join(D, 'renders/toy.mp4')));

// ---- CONTROLES: el mismo render, pero el manifiesto declara un cue (ping-note5) desplazado respecto a su sonido real.
//   +-5 y +-20 ms (dentro de 1 fotograma): deben PASAR y el error medido debe ser el desplazamiento (precision < 1 ms: el verificador MIDE de verdad).
//   +40 y +-80 ms (fuera de 33.3 ms): DEBEN FALLAR (codigo 1).
const montado = JSON.parse(readFileSync(join(D, 'v2/sfx-mounted.json'), 'utf8'));
const objetivo = montado.cues.find((x) => x.sfx === 'ping-note5');
const resultados = [];
for (const [desp, debeFallar] of [[5, false], [-5, false], [20, false], [-20, false], [40, true], [80, true], [-80, true]]) {
    const malo = JSON.parse(JSON.stringify(montado));
    const c = malo.cues.find((x) => x.id === objetivo.id);
    c.tCue = Math.round((c.tCue + desp / 1000) * 1000) / 1000;
    const ruta = join(D, `v2/sfx-mounted-desp${desp}.json`);
    writeFileSync(ruta, JSON.stringify(malo, null, 1));
    const r = sh('python3', [join(AQUI, 'verify-sfx-sync.py'), ruta, join(D, 'renders/toy.mp4'), '--root', D, '--out', join(D, `v2/verify-desp${desp}.json`)]);
    const fila = JSON.parse(readFileSync(join(D, `v2/verify-desp${desp}.json`), 'utf8')).cues.find((x) => x.id === objetivo.id);
    const fallo = (fila.ok === false);
    // los demas cues no deben verse afectados
    const otros = JSON.parse(readFileSync(join(D, `v2/verify-desp${desp}.json`), 'utf8')).cues.filter((x) => x.id !== objetivo.id && !x.ok).length;
    const bien = debeFallar ? fallo && r.status === 1 : !fallo && Math.abs(fila.errorMs + desp) < 1.0;
    resultados.push({ desp, esperado: debeFallar ? 'FALLA' : 'PASA', obtenido: fallo ? 'FALLA' : 'PASA', errorMedidoMs: fila.errorMs, rho: fila.rho, ganancia: fila.ganancia, otrosFallos: otros, bien });
}
console.log('\n=== CONTROLES (cue declarado desplazado respecto a su sonido real)');
for (const r of resultados) console.log(`  desplazamiento ${String(r.desp).padStart(4)} ms: esperado ${r.esperado.padEnd(5)} obtenido ${r.obtenido.padEnd(5)} (error medido ${r.errorMedidoMs} ms, rho ${r.rho}, ganancia ${r.ganancia}; otros cues con fallo: ${r.otrosFallos}) ${r.bien ? 'OK' : 'MAL'}`);
if (resultados.some((r) => !r.bien)) { console.log('PRUEBA FALLIDA en los controles'); process.exit(1); }
console.log('\nPRUEBA COMPLETA: cues positivos OK, controles de +-5/20 ms medidos con precision < 1 ms y de +40/+-80 ms detectados como fallo');
