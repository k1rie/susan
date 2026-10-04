#!/usr/bin/env node
// Vuelca TODOS los tweens GSAP de cada cuadro con su tiempo ABSOLUTO (no el local del cuadro) a audit/sonido/events.json.
//
// Método (en vivo, no por regex):
//   1. Se importa `bundleToSingleHtml` del compilador de la CLI de HyperFrames 0.8.114 (el mismo que usan `check`/`snapshot`/`render`):
//      devuelve el index.html con los 12 cuadros inlineados y el runtime inyectado.
//   2. Se sirve ese HTML por HTTP local (+ los archivos del proyecto) y se abre en Chrome headless (puppeteer-core).
//   3. El runtime anida el timeline de cada cuadro dentro de window.__timelines.main en su data-start; se recorre cada timeline con
//      gsap `getChildren(true, true, false)` (tweens anidados, incluidos los que genera un `stagger`) y se suman los `startTime()` de los padres hasta el timeline `main`
//      (globalTime() no sirve: incluye +0.02 s del reloj global de gsap). Se comprueba que coincida con data-start del envoltorio + startTime local.
//   Las "animaciones por reloj" (texto tecleado, contadores) son tweens de un objeto JS con setter: salen como objetivo "{objeto JS}"
//   y propiedad `t`/`v`; sus instantes internos (cada tecla) NO son tweens: se extraen aparte con --teclas (parseo de las tablas K1/K2 del cuadro).
//
// MODO --cues (contrato de sincronia v2, audit/sonido/REPORT.md 7): ademas lee TODAS las etiquetas 'sfx:<nombre>@<vol>#<n>' y 'read:<frase>' de los
//   timelines de cada cuadro (y las que la transicion deja en el timeline raiz `main` de index.html) y escribe v2/sfx-cues.json con tiempos ABSOLUTOS
//   (cadena de startTime() de los timelines anidados, igual que los tweens) + la lista de tweens (inicio/fin, hero) que usa verify-sfx.mjs.
//   Un tween es 'hero' si lleva `data: 'hero'` en sus vars (las funciones cam* de scripts/frame-helpers.snippet.js lo ponen solas).
//
// Uso: node scripts/extract-events.mjs [--events] [--out audit/sonido/events.json]    (por defecto: eventos; --events lo hace explicito)
//      node scripts/extract-events.mjs --cues [--cues-out v2/sfx-cues.json]           (solo cues; combinable con --events)
//      --root <proyecto>   proyecto a analizar (por defecto: el que contiene scripts/)
// Sale con codigo 1 si una etiqueta sfx:/read: esta mal formada.
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const argRaiz = process.argv.indexOf('--root');
const RAIZ = argRaiz > 0 ? resolve(process.argv[argRaiz + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argSalida = process.argv.indexOf('--out');
const MODO_CUES = process.argv.includes('--cues');
const MODO_EVENTOS = process.argv.includes('--events') || !MODO_CUES;
const SALIDA = argSalida > 0 ? resolve(process.argv[argSalida + 1]) : join(RAIZ, 'audit/sonido/events.json');
const argCues = process.argv.indexOf('--cues-out');
const SALIDA_CUES = argCues > 0 ? resolve(process.argv[argCues + 1]) : join(RAIZ, 'v2/sfx-cues.json');
const HOME = process.env.HOME;
const r3 = (x) => Math.round(x * 1000) / 1000;

// --- localizar la CLI de hyperframes y puppeteer-core en la caché de npx ---
function buscar(patron) {
    const base = join(HOME, '.npm/_npx');
    for (const d of readdirSync(base)) {
        const p = patron(join(base, d, 'node_modules'));
        if (p && existsSync(p)) return p;
    }
    return null;
}
const distHf = buscar((nm) => {
    const dist = join(nm, 'hyperframes/dist');
    if (!existsSync(dist)) return null;
    return dist;
});
if (!distHf) throw new Error('No se encontró hyperframes en ~/.npm/_npx (ejecuta una vez `npx hyperframes@0.8.114 --version`).');
const compilador = readdirSync(distHf).find((f) => /^compiler-.*\.js$/.test(f));
const puppeteer = createRequire(import.meta.url)(buscar((nm) => join(nm, 'puppeteer-core')));
const chromeBase = join(HOME, '.cache/hyperframes/chrome');
const exe = execSync(`find ${chromeBase} -type f -name chrome-headless-shell | head -1`).toString().trim();

const { bundleToSingleHtml } = await import(pathToFileURL(join(distHf, compilador)).href);
const html = await bundleToSingleHtml(RAIZ);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };
const srv = createServer((req, res) => {
    const u = decodeURIComponent((req.url || '/').split('?')[0]);
    if (u === '/' || u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return; }
    const f = join(RAIZ, u);
    if (existsSync(f) && statSync(f).isFile()) { res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' }); res.end(readFileSync(f)); }
    else { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;

const browser = await puppeteer.launch({ executablePath: exe, headless: 'shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const pg = await browser.newPage();
await pg.setViewport({ width: 1920, height: 1080 });
await pg.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
await new Promise((r) => setTimeout(r, 2500));

const datos = await pg.evaluate(() => {
    const CTRL = new Set(['ease', 'duration', 'delay', 'stagger', 'startAt', 'onComplete', 'onStart', 'onUpdate', 'overwrite', 'immediateRender', 'lazy', 'data', 'id',
        'paused', 'repeat', 'yoyo', 'repeatDelay', 'runBackwards', 'keyframes', 'callbackScope', 'onReverseComplete', 'onRepeat', 'inherit', 'parent', 'defaults', 'scrollTrigger']);
    const num = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
    const limpio = (o) => {
        const r = {};
        for (const k of Object.keys(o || {})) {
            if (CTRL.has(k)) continue;
            const v = o[k];
            r[k] = typeof v === 'function' ? '{fn}' : typeof v === 'object' && v !== null ? '{obj}' : num(v);
        }
        return r;
    };
    const descObj = (t) => {
        if (t && t.nodeType === 1) {
            const comp = t.closest('[data-composition-id]');
            const propio = Array.from(t.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
            const texto = (propio || t.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
            return { id: t.id || null, clase: (t.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.') || null, tag: t.tagName.toLowerCase(), texto: texto || null, cuadro: comp ? comp.getAttribute('data-composition-id') : null };
        }
        return { id: null, clase: null, tag: 'objeto-JS', texto: null, cuadro: null };
    };
    const tls = window.__timelines || {};
    const cuadros = Object.keys(tls).filter((k) => k !== 'main');
    // data-start de cada envoltorio en la raíz
    const inicios = {};
    for (const el of document.querySelectorAll('#root > [data-composition-id], [data-composition-src]')) {
        const id = el.getAttribute('data-composition-id');
        if (id && id !== 'main') inicios[id] = { start: Number(el.getAttribute('data-start')), duration: Number(el.getAttribute('data-duration')) };
    }
    const eventos = [];
    const recorre = (nombre, tl, base) => {
        const hijos = tl.getChildren(true, true, false);
        for (const tw of hijos) {
            // Tiempo relativo al timeline raíz "main": se suman los startTime() de los padres hasta llegar a main. NO se usa globalTime():
            // éste incluye el desfase con que el timeline pausado de main se añadió al reloj global de gsap (+0.02 s en esta carga).
            let t0 = tw.startTime(), p = tw.parent, dur;
            while (p && p !== tls.main) { t0 += p.startTime(); p = p.parent; }
            if (p !== tls.main) t0 = base + tw.startTime();
            dur = tw.duration();
            const v = tw.vars || {};
            const tg = typeof tw.targets === 'function' ? tw.targets() : [];
            const esSet = dur === 0 && !(tw.vars && tw.vars.startAt);
            const tipo = typeof tw.targets !== 'function' ? 'call' : tw.vars && tw.vars.startAt ? 'fromTo' : tw.vars && tw.vars.runBackwards ? 'from' : esSet ? 'set' : 'to';
            const ease = typeof v.ease === 'function' ? (v.ease.name || 'fn') : v.ease || (tw._ease && tw._ease.name) || 'power1.out';
            eventos.push({
                cuadro: nombre,
                tipo,
                inicioAbsoluto: Math.round(t0 * 1000) / 1000,
                finAbsoluto: Math.round((t0 + dur * (1 + (v.repeat > 0 ? v.repeat : 0))) * 1000) / 1000,
                duracion: Math.round(dur * 1000) / 1000,
                inicioLocal: Math.round((t0 - base) * 1000) / 1000,
                objetivos: tg.slice(0, 6).map(descObj),
                nObjetivos: tg.length,
                propiedades: limpio(v),
                desde: v.startAt ? limpio(v.startAt) : undefined,
                ease: String(ease),
                stagger: v.stagger !== undefined ? (typeof v.stagger === 'object' ? JSON.stringify(v.stagger) : String(v.stagger)) : undefined,
                repeat: v.repeat || undefined,
                anidado: tw.data === 'nested' || undefined,
                hero: tw.data === 'hero' || (v && v.data === 'hero') || undefined,
            });
        }
    };
    for (const c of cuadros) recorre(c, tls[c], inicios[c] ? inicios[c].start : 0);
    // transiciones: tweens de main sobre los envoltorios #el-*
    const principal = tls.main.getChildren(false, true, false);
    for (const tw of principal) {
        const tg = tw.targets();
        const v = tw.vars || {};
        eventos.push({
            cuadro: 'main', tipo: tw.vars && tw.vars.startAt ? 'fromTo' : 'to', inicioAbsoluto: Math.round(tw.startTime() * 1000) / 1000, finAbsoluto: Math.round((tw.startTime() + tw.duration()) * 1000) / 1000,
            duracion: Math.round(tw.duration() * 1000) / 1000, inicioLocal: Math.round(tw.startTime() * 1000) / 1000, objetivos: tg.slice(0, 3).map(descObj), nObjetivos: tg.length,
            propiedades: limpio(v), desde: v.startAt ? limpio(v.startAt) : undefined, ease: String(typeof v.ease === 'function' ? 'fn' : v.ease || 'power1.out'),
        });
    }
    // etiquetas sfx:/read: de cada timeline (cuadros, timelines anidados y el raiz `main`) con su tiempo absoluto
    const absInicio = (x, base) => { let t0 = x.startTime(), p = x.parent; while (p && p !== tls.main) { t0 += p.startTime(); p = p.parent; } return p === tls.main ? t0 : base; };
    const etiquetas = [];
    const recogeEtiquetas = (cuadro, tl, base) => {
        const t0 = tl === tls.main ? 0 : absInicio(tl, base);
        for (const [lab, t] of Object.entries(tl.labels || {})) if (/^(sfx:|read:)/.test(lab)) etiquetas.push({ cuadro, etiqueta: lab, tLocal: t, t: t0 + t });
        // timelines anidados (no los de otros cuadros, que ya se recorren aparte: sus etiquetas saldrian duplicadas bajo `main`)
        for (const h of tl.getChildren(false, false, true)) if (typeof h.getChildren === 'function' && h.labels && !cuadros.some((c) => tls[c] === h)) recogeEtiquetas(cuadro, h, base);
    };
    for (const c of cuadros) recogeEtiquetas(c, tls[c], inicios[c] ? inicios[c].start : 0);
    recogeEtiquetas('main', tls.main, 0);
    const rootEl = document.querySelector('#root');
    const duracionTotal = Number(rootEl && rootEl.getAttribute('data-duration')) || tls.main.duration();
    const audios = Array.from(document.querySelectorAll('audio')).map((a) => ({ id: a.id, src: a.getAttribute('src'), start: a.getAttribute('data-start'), dur: a.getAttribute('data-duration'), vol: a.getAttribute('data-volume'), track: a.getAttribute('data-track-index') }));
    return { cuadros: inicios, duracionesTimeline: Object.fromEntries(cuadros.map((c) => [c, tls[c].duration()])), eventos, nAudios: audios.length, etiquetas, duracionTotal };
});

await browser.close();
srv.close();

datos.eventos.sort((a, b) => a.inicioAbsoluto - b.inicioAbsoluto || a.finAbsoluto - b.finAbsoluto);
// comprobación (c): el inicio absoluto de los tweens de cada cuadro = data-start del envoltorio + inicio local
const desv = datos.eventos.filter((e) => e.cuadro !== 'main' && datos.cuadros[e.cuadro] && Math.abs(e.inicioAbsoluto - (datos.cuadros[e.cuadro].start + e.inicioLocal)) > 0.002);
const porCuadro = {};
for (const e of datos.eventos) porCuadro[e.cuadro] = (porCuadro[e.cuadro] || 0) + 1;
if (MODO_EVENTOS) {
    mkdirSync(dirname(SALIDA), { recursive: true });
    writeFileSync(SALIDA, JSON.stringify({ metodo: 'bundleToSingleHtml + Chrome headless + gsap getChildren + startTime acumulado', generado: new Date().toISOString(), cuadros: datos.cuadros, duracionesTimeline: datos.duracionesTimeline, eventos: datos.eventos }, null, 1) + '\n');
    console.log(`events.json: ${datos.eventos.length} tweens (${Object.entries(porCuadro).map(([k, v]) => `${k}:${v}`).join(' ')}); incoherencias abs/local: ${desv.length}`);
}

if (MODO_CUES) {
    const errores = [];
    const cues = [], lecturas = [];
    const q = (x) => Math.round(x * 1e6) / 1e6;
    for (const e of datos.etiquetas) {
        if (e.etiqueta.startsWith('sfx:')) {
            const m = /^sfx:([\w.-]+)@([\d.]*)#(\d+)$/.exec(e.etiqueta);
            if (!m) { errores.push(`etiqueta sfx mal formada en ${e.cuadro}: "${e.etiqueta}" (formato sfx:<nombre>@<vol>#<n>; usa sfx(tl, t, nombre, vol))`); continue; }
            const vol = m[2] === '' ? null : Number(m[2]);
            if (vol !== null && !(vol > 0 && vol <= 1)) errores.push(`volumen fuera de (0,1] en ${e.cuadro}: "${e.etiqueta}"`);
            cues.push({ cuadro: e.cuadro, nombre: m[1], vol, n: Number(m[3]), tLocal: q(e.tLocal), t: q(e.t) });
        } else {
            lecturas.push({ cuadro: e.cuadro, frase: e.etiqueta.slice(5).replace(/#\d+$/, ''), tLocal: q(e.tLocal), t: q(e.t) });
        }
    }
    cues.sort((a, b) => a.t - b.t || a.n - b.n);
    const orden = {};
    for (const c of cues) { orden[c.cuadro] = (orden[c.cuadro] || 0) + 1; c.id = `${c.cuadro}-${orden[c.cuadro]}`; }
    lecturas.sort((a, b) => a.t - b.t);
    const tweens = datos.eventos.map((e) => ({
        cuadro: e.cuadro, t0: e.inicioAbsoluto, t1: e.finAbsoluto, tipo: e.tipo, hero: e.hero || undefined,
        obj: e.objetivos[0] ? (e.objetivos[0].id || e.objetivos[0].clase || e.objetivos[0].tag) : null,
    }));
    mkdirSync(dirname(SALIDA_CUES), { recursive: true });
    writeFileSync(SALIDA_CUES, JSON.stringify({ generado: new Date().toISOString(), proyecto: RAIZ, duracion: datos.duracionTotal, cuadros: datos.cuadros, cues, lecturas, tweens }, null, 1) + '\n');
    console.log(`sfx-cues.json: ${cues.length} cues sfx, ${lecturas.length} marcas read, ${tweens.length} tweens (${tweens.filter((t) => t.hero).length} hero) -> ${SALIDA_CUES}`);
    if (errores.length) { console.error('ERRORES:\n  ' + errores.join('\n  ')); process.exit(1); }
}
