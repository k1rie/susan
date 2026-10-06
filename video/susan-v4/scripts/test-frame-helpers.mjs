#!/usr/bin/env node
// Pruebas de las funciones de scripts/frame-helpers.snippet.js (v4) con un timeline simulado en `vm` (no necesita navegador):
// etiquetas read: unicas, encadenado del estado de camara con immediateRender:false, tope de escala 1.3, pose 3D con topes
// |rotationX| <= 8 y |rotationY| <= 10, camPlano a (0, 0) y ausencia de los helpers retirados (sfx, sfxType, sfxCount, camTilt).
// Uso: node scripts/test-frame-helpers.mjs        (sale con codigo 1 si algo falla)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'frame-helpers.snippet.js'), 'utf8');
const gsap = { set: () => {} };
const elemento = {};
const ctx = { window: {}, gsap, document: { querySelector: () => elemento } };
ctx.window.window = ctx.window;
vm.createContext(ctx);
vm.runInContext(`${src}\nthis.__api = { readMark, camInit, camSnap, camPush, camPull, camPan, camPose, camPlano, retirados: [typeof sfx, typeof sfxType, typeof sfxCount, typeof camTilt] };`, ctx);
const api = ctx.__api;
const nuevoTl = () => {
    const tl = { labels: {}, tweens: [] };
    tl.addLabel = (n, t) => { if (n in tl.labels) throw new Error('etiqueta repetida ' + n); tl.labels[n] = t; return tl; };
    tl.fromTo = (el, a, b, t) => { tl.tweens.push({ a, b, t }); return tl; };
    return tl;
};
let fallos = 0, pruebas = 0;
const ok = (cond, msg) => { pruebas++; if (!cond) { fallos++; console.log('FALLA: ' + msg); } };
const lanza = (fn) => { try { fn(); return false; } catch { return true; } };

// readMark
{
    const tl = nuevoTl();
    api.readMark(tl, 1.2, '20.8 %');
    api.readMark(tl, 2.4, '20.8 %');
    const k = Object.keys(tl.labels);
    ok(k.length === 2 && k.every((x) => /^read:20\.8 %#\d+$/.test(x)), `readMark: etiquetas unicas read:<frase>#n (${k.join(', ')})`);
}
// camara: estado encadenado, immediateRender:false y data:'hero'
{
    const tl = nuevoTl();
    delete elemento.__cam;
    api.camInit(elemento, 1, 0, 0);
    api.camPush(tl, elemento, 0.5, 1.2, {});
    api.camPan(tl, elemento, 1.5, -100, 0, {});
    api.camPull(tl, elemento, 2.2, null, {});
    const [a, b, c] = tl.tweens;
    ok(a.a.scale === 1 && a.b.scale === 1.2, 'camPush: de 1 a 1.2');
    ok(b.a.scale === 1.2 && b.a.x === 0 && b.b.x === -100, 'camPan: parte del estado del push y desplaza -100 px');
    ok(c.a.x === -100 && c.b.scale === 1, 'camPull: parte del pan y vuelve a 1');
    ok(tl.tweens.every((x) => x.b.immediateRender === false && x.b.data === 'hero'), 'camara: immediateRender:false y data:hero en todos');
    ok(lanza(() => api.camSnap(nuevoTl(), elemento, 3, 1.5, {})), 'camara: escala > 1.3 lanza un error');
}
// pose 3D
{
    const tl = nuevoTl();
    delete elemento.__pose;
    api.camPose(tl, elemento, 0.1, { rx: 6, ry: -10 }, {});
    api.camPlano(tl, elemento, 1.0);
    ok(tl.tweens[0].a.rotationX === 0 && tl.tweens[0].b.rotationX === 6 && tl.tweens[0].b.rotationY === -10, 'camPose: de (0,0) a (6,-10)');
    ok(tl.tweens[1].a.rotationY === -10 && tl.tweens[1].b.rotationX === 0 && tl.tweens[1].b.rotationY === 0, 'camPlano: vuelve a (0,0) desde la pose anterior');
    ok(tl.tweens.every((x) => x.b.immediateRender === false), 'pose: immediateRender:false');
    ok(lanza(() => api.camPose(nuevoTl(), elemento, 0, { rx: 9 }, {})), 'camPose: |rotationX| 9 > 8 lanza un error');
    ok(lanza(() => api.camPose(nuevoTl(), elemento, 0, { ry: -11 }, {})), 'camPose: |rotationY| 11 > 10 lanza un error');
    ok(!tl.tweens.some((x) => 'rotation' in x.b || 'rotationZ' in x.b), 'pose: nunca rotation/rotationZ (giro en el plano vetado)');
}
ok(api.retirados.every((x) => x === 'undefined'), `helpers retirados ausentes (sfx, sfxType, sfxCount, camTilt): ${api.retirados.join(', ')}`);
console.log(`${pruebas - fallos}/${pruebas} pruebas OK`);
process.exit(fallos ? 1 : 0);
