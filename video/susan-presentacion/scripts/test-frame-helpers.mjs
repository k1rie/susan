#!/usr/bin/env node
// Pruebas de las funciones puras de scripts/frame-helpers.snippet.js (sfxType, sfxCount, readMark, camTo) con un timeline simulado:
// decimado <= 14 teclas/s, primera y ultima siempre suenan, sin repetir tecla seguida, acento en inicios de palabra, ticks <= 12/s con alturas
// crecientes y ultimo con acento, etiquetas unicas, y encadenado de estado de camara con immediateRender:false.
// Uso: node scripts/test-frame-helpers.mjs        (sale con codigo 1 si algo falla; no necesita navegador)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'frame-helpers.snippet.js'), 'utf8');
const power2out = (p) => 1 - (1 - p) ** 2;
const llamadas = [];
const gsap = { parseEase: (n) => (n === 'none' ? (p) => p : n === 'power2.out' ? power2out : (p) => 1 - (1 - p)), set: () => {} };
const elemento = {};
const ctx = { window: {}, gsap, document: { querySelector: () => elemento } };
ctx.window.window = ctx.window;
vm.createContext(ctx);
vm.runInContext(src + '\nthis.__api = { sfx, sfxType, sfxCount, readMark, camSnap, camPull, camPush, camPan, camTilt, camInit };', ctx);
const api = ctx.__api;
const nuevoTl = () => {
    const tl = { labels: {}, tweens: [] };
    tl.addLabel = (n, t) => { if (n in tl.labels) throw new Error('etiqueta repetida ' + n); tl.labels[n] = t; return tl; };
    tl.fromTo = (el, a, b, t) => { tl.tweens.push({ a, b, t }); return tl; };
    return tl;
};
let fallos = 0;
const ok = (cond, msg) => { if (!cond) { fallos++; console.log('FALLA: ' + msg); } };
const teclas = (tl) => Object.entries(tl.labels).filter(([k]) => /^sfx:key-\d@/.test(k)).map(([k, t]) => ({ n: Number(/key-(\d)/.exec(k)[1]), vol: Number(/@([\d.]+)#/.exec(k)[1]), t }));

// sfxType: varios ritmos (14 ms/car hasta 120 ms/car) y frases
for (const ms of [14, 20, 28, 36, 60, 120]) {
    for (const txt of ['Pasa lista en 6 segundos', 'Hola', 'a', 'El ausentismo se detecta antes de que sea tarde para actuar']) {
        const tl = nuevoTl();
        const ts = [...txt].map((_, i) => i * ms / 1000);
        const out = api.sfxType(tl, 1.5, ts, { texto: txt });
        const k = teclas(tl).sort((a, b) => a.t - b.t);
        const id = `${ms} ms/car "${txt.slice(0, 12)}"`;
        ok(k.length === out.length && k.length > 0, `${id}: sin teclas`);
        ok(Math.abs(k[0].t - (1.5 + ts[0])) < 1e-9, `${id}: la primera tecla no suena`);
        const ult = [...txt].map((c, i) => [c, i]).filter(([c]) => c !== ' ').pop()[1];
        ok(Math.abs(k.at(-1).t - (1.5 + ts[ult])) < 1e-9, `${id}: la ultima tecla no suena`);
        for (let i = 1; i < k.length; i++) ok(k[i].n !== k[i - 1].n, `${id}: tecla repetida seguida (${k[i].n})`);
        let max = 0;
        for (const a of k) max = Math.max(max, k.filter((b) => b.t >= a.t && b.t < a.t + 1).length);
        ok(max <= 14, `${id}: ${max} teclas en 1 s`);
        ok(k.every((x) => x.vol > 0 && x.vol <= 1), `${id}: volumen fuera de rango`);
    }
}
{   // enter y borrados
    const tl = nuevoTl();
    api.sfxType(tl, 0, [0, 0.1, 0.2], { texto: 'abc', enter: true, borrados: [0.5, 0.6] });
    const n = (r) => Object.keys(tl.labels).filter((k) => r.test(k)).length;
    ok(n(/^sfx:key-enter@/) === 1 && n(/^sfx:key-back@/) === 2, 'enter/borrados');
}
// sfxCount: contador 0->24 y 0->8400 con power2.out, 0.9 s
for (const [a, b, dur] of [[0, 24, 0.9], [0, 8400, 1.2], [0, 1, 0.5], [10, 3, 0.8], [0, 100, 2.0]]) {
    const tl = nuevoTl();
    const ts = api.sfxCount(tl, 2, 2 + dur, a, b, { ease: 'power2.out' });
    const ticks = Object.entries(tl.labels).filter(([k]) => /^sfx:tick-/.test(k)).map(([k, t]) => ({ h: Number(/tick-(\d)/.exec(k)[1]), t, vol: Number(/@([\d.]+)#/.exec(k)[1]) })).sort((x, y) => x.t - y.t);
    const id = `contador ${a}->${b} en ${dur} s`;
    ok(ticks.length === ts.length && ticks.length >= 1, `${id}: ticks ${ticks.length}`);
    let max = 0;
    for (const x of ticks) max = Math.max(max, ticks.filter((y) => y.t >= x.t && y.t < x.t + 1).length);
    ok(max <= 12, `${id}: ${max} ticks en 1 s`);
    ok(ticks.every((x, i) => i === 0 || x.h >= ticks[i - 1].h), `${id}: alturas no crecientes`);
    ok(ticks.at(-1).h === 4, `${id}: el ultimo no es tick-4`);
    ok(ticks.every((x) => x.t >= 2 - 1e-9 && x.t <= 2 + dur + 1e-9), `${id}: tick fuera del intervalo`);
    if (ticks.length >= 3) ok(ticks.at(-1).vol > ticks.at(-2).vol - 1e-9, `${id}: el ultimo no lleva acento`);
}
// etiquetas unicas y readMark
{
    const tl = nuevoTl();
    api.sfx(tl, 1, 'pop-1', 0.5); api.sfx(tl, 1, 'pop-1', 0.5); api.readMark(tl, 2, 'frase'); api.readMark(tl, 3, 'frase');
    ok(Object.keys(tl.labels).length === 4, 'etiquetas repetidas se sobrescriben');
    ok(Object.keys(tl.labels).filter((k) => /^read:frase#\d+$/.test(k)).length === 2, 'formato read:');
}
// camara: encadenado de estado e immediateRender:false
{
    const tl = nuevoTl();
    api.camInit(elemento, 1, 0, 0);
    api.camSnap(tl, elemento, 1, 1.5, { foco: [480, 270], W: 960, H: 540 });
    api.camPull(tl, elemento, 2, 1, { sfx: 'zoom-out' });
    api.camPush(tl, elemento, 3, 1.2);
    api.camPan(tl, elemento, 4, 100, 0);
    api.camTilt(tl, elemento, 5, 3);
    ok(tl.tweens.length === 5 && tl.tweens.every((w) => w.b.immediateRender === false && w.b.data === 'hero'), 'immediateRender:false y data hero en todos los tweens');
    ok(tl.tweens[1].a.scale === 1.5 && tl.tweens[1].b.scale === 1, 'camPull parte de la escala donde dejo camSnap');
    ok(tl.tweens[3].a.x === tl.tweens[2].b.x && tl.tweens[3].b.x === tl.tweens[2].b.x + 100, 'camPan relativo al estado');
    ok(tl.tweens[4].a.rotation === 0 && tl.tweens[4].b.rotation === 3, 'camTilt');
    ok(Object.keys(tl.labels).some((k) => k.startsWith('sfx:snap@')) && Object.keys(tl.labels).some((k) => k.startsWith('sfx:zoom-out@')), 'camSnap emite snap y camPull zoom-out');
}
console.log(fallos ? `${fallos} FALLOS` : 'frame-helpers: todas las pruebas OK');
process.exit(fallos ? 1 : 0);
