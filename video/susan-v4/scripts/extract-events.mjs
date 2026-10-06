#!/usr/bin/env node
// extract-events.mjs - vuelca TODOS los tweens GSAP del video con su tiempo ABSOLUTO a datos/eventos.json (lo usa verify-sfx.mjs
// para comprobar que cada cue de `sfx_cues` cae en un evento visual real).
//
// Metodo (en vivo, no por regex): index.html compilado con bundleToSingleHtml de la CLI fijada (0.8.134) y abierto en Chrome con el
// runtime real (scripts/lib/runtime-host.mjs). Para cada cuadro se recorre su timeline (getChildren con tweens anidados) y:
//     t absoluto = data-start del envoltorio el-<frame_id> en index.html + t local dentro del timeline del cuadro.
// Cambio respecto a la v3: en la 0.8.114 el runtime anidaba el timeline de cada cuadro dentro de `main` (y se sumaban los startTime
// hasta `main`); en la 0.8.134 los timelines de cuadro NO cuelgan de `main`: el runtime los posiciona en (t - data-start). Por eso el
// script COMPRUEBA esa regla con el propio runtime (renderSeek a mitad de cada cuadro y lectura de tl.time()) y falla si no se cumple.
// Las transiciones (tweens de `main` sobre los envoltorios #el-*, las inyecta transitions.mjs) salen con cuadro 'main'.
// Tambien recoge las etiquetas `read:<frase>` (readMark de frame-helpers.snippet.js) y cualquier `sfx:` heredada, con su t absoluto.
//
// Uso: node scripts/extract-events.mjs [--root <proyecto>] [--out datos/eventos.json]
// Sale con codigo 1 si no puede abrir el indice o si la comprobacion de tiempos falla.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLI_VERSION, opcion, raiz, rutas } from './lib/rutas.mjs';
import { leerIndice } from './lib/indice.mjs';
import { crearHost } from './lib/runtime-host.mjs';

const R = raiz();
const P = rutas(R);
const SALIDA = resolve(R, opcion(process.argv, '--out', P.eventos));

// Huella del material que determina los tweens (indice + archivos de cuadro): verify-sfx regenera eventos.json si cambia.
export function huellaProyecto(raizP) {
    const h = createHash('sha1');
    const idx = readFileSync(join(raizP, 'index.html'), 'utf8');
    h.update(idx.replace(/[ \t]*<!-- (sfx|voz):start[^>]*-->[\s\S]*?<!-- \1:end -->\n?/g, ''));   // el sonido no cambia los tweens
    for (const c of leerIndice(idx).cuadros) { const f = join(raizP, c.src ?? ''); if (c.src && existsSync(f)) h.update(readFileSync(f)); }
    return h.digest('hex').slice(0, 16);
}

async function main() {
    const indice = leerIndice(readFileSync(P.index, 'utf8'));
    if (!indice.cuadros.length) throw new Error(`${P.index} no tiene envoltorios el-<frame_id> con data-composition-src (corre assemble-index.mjs)`);
    const inicios = Object.fromEntries(indice.cuadros.map((c) => [c.id, { start: c.start, duration: c.duration }]));
    const host = await crearHost(R);
    let datos, errores;
    try {
        const v = await host.abrirIndice();
        errores = v.errores;
        if (!v.listo) errores.push('el runtime no llego a window.__renderReady');
        datos = await v.page.evaluate((inicios) => {
            const CTRL = new Set(['ease', 'duration', 'delay', 'stagger', 'startAt', 'onComplete', 'onStart', 'onUpdate', 'overwrite', 'immediateRender', 'lazy', 'data', 'id',
                'paused', 'repeat', 'yoyo', 'repeatDelay', 'runBackwards', 'keyframes', 'callbackScope', 'onReverseComplete', 'onRepeat', 'inherit', 'parent', 'defaults', 'scrollTrigger']);
            const r3 = (x) => Math.round(x * 1000) / 1000;
            const num = (v) => (typeof v === 'number' ? r3(v) : v);
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
            const main = tls.main;
            const cuadros = Object.keys(tls).filter((k) => k !== 'main');
            const eventos = [], etiquetas = [];
            // t local de un hijo dentro del timeline `raizTl`: suma de startTime() hasta llegar a el
            const local = (x, raizTl) => { let t = x.startTime(), p = x.parent; while (p && p !== raizTl) { t += p.startTime(); p = p.parent; } return t; };
            const fila = (cuadro, tw, t0, base) => {
                const v = tw.vars || {};
                const tg = typeof tw.targets === 'function' ? tw.targets() : [];
                const dur = tw.duration();
                const esSet = dur === 0 && !v.startAt;
                return {
                    cuadro, tipo: typeof tw.targets !== 'function' ? 'call' : v.startAt ? 'fromTo' : v.runBackwards ? 'from' : esSet ? 'set' : 'to',
                    inicioAbsoluto: r3(base + t0), finAbsoluto: r3(base + t0 + dur * (1 + (v.repeat > 0 ? v.repeat : 0))), duracion: r3(dur), inicioLocal: r3(t0),
                    objetivos: tg.slice(0, 6).map(descObj), nObjetivos: tg.length, propiedades: limpio(v), desde: v.startAt ? limpio(v.startAt) : undefined,
                    ease: String(typeof v.ease === 'function' ? (v.ease.name || 'fn') : v.ease || 'power1.out'),
                    stagger: v.stagger !== undefined ? (typeof v.stagger === 'object' ? JSON.stringify(v.stagger) : String(v.stagger)) : undefined,
                    repeat: v.repeat || undefined, hero: v.data === 'hero' || tw.data === 'hero' || undefined,
                };
            };
            const recogeEtiquetas = (cuadro, tl, raizTl, base) => {
                const t0 = tl === raizTl ? 0 : local(tl, raizTl);
                for (const [lab, t] of Object.entries(tl.labels || {})) if (/^(sfx:|read:)/.test(lab)) etiquetas.push({ cuadro, etiqueta: lab, tLocal: r3(t0 + t), t: r3(base + t0 + t) });
                for (const h of tl.getChildren(false, false, true)) if (typeof h.getChildren === 'function') recogeEtiquetas(cuadro, h, raizTl, base);
            };
            const sinInicio = [];
            for (const c of cuadros) {
                const tl = tls[c];
                if (!inicios[c]) { sinInicio.push(c); continue; }
                const base = inicios[c].start;
                for (const tw of tl.getChildren(true, true, false)) eventos.push(fila(c, tw, local(tw, tl), base));
                recogeEtiquetas(c, tl, tl, base);
            }
            if (main) {
                for (const tw of main.getChildren(true, true, false)) eventos.push(fila('main', tw, local(tw, main), 0));
                recogeEtiquetas('main', main, main, 0);
            }
            return { cuadros, eventos, etiquetas, sinInicio, duracionMain: main ? main.duration() : null };
        }, inicios);
        // Comprobacion con el runtime: a mitad de cada cuadro, el timeline del cuadro debe estar en (t - data-start).
        const comprobacion = [];
        for (const c of indice.cuadros) {
            const local = Math.min(1, c.duration / 2);
            await v.ir(c.start + local);
            const t = await v.page.evaluate((id) => { const tl = (window.__timelines || {})[id]; return tl ? tl.time() : null; }, c.id);
            comprobacion.push({ cuadro: c.id, esperado: local, leido: t, ok: t !== null && Math.abs(t - local) <= 0.002 });
        }
        datos.comprobacion = comprobacion;
        await v.cerrar();
    } finally {
        await host.cerrar();
    }
    const malos = datos.comprobacion.filter((x) => !x.ok);
    for (const m of malos) errores.push(`el runtime no posiciona ${m.cuadro} en data-start + t local (esperado ${m.esperado}, leido ${m.leido})`);
    for (const c of datos.sinInicio) errores.push(`window.__timelines["${c}"] no tiene envoltorio el-${c} en index.html`);
    datos.eventos.sort((a, b) => a.inicioAbsoluto - b.inicioAbsoluto || a.finAbsoluto - b.finAbsoluto);
    datos.etiquetas.sort((a, b) => a.t - b.t);
    const salida = {
        metodo: `bundleToSingleHtml (hyperframes@${CLI_VERSION}) + Chrome con el runtime real; t absoluto = data-start del cuadro + t local`,
        generado: new Date().toISOString(), proyecto: R, huella: huellaProyecto(R), duracion: indice.duracion,
        cuadros: inicios, comprobacion: datos.comprobacion, eventos: datos.eventos, etiquetas: datos.etiquetas,
    };
    mkdirSync(dirname(SALIDA), { recursive: true });
    writeFileSync(SALIDA, JSON.stringify(salida, null, 1) + '\n');
    const porCuadro = {};
    for (const e of datos.eventos) porCuadro[e.cuadro] = (porCuadro[e.cuadro] || 0) + 1;
    console.log(`eventos.json: ${datos.eventos.length} tweens (${Object.entries(porCuadro).map(([k, n]) => `${k}:${n}`).join(' ')}), ${datos.etiquetas.length} etiquetas; comprobacion de tiempos ${datos.comprobacion.length - malos.length}/${datos.comprobacion.length} -> ${SALIDA}`);
    if (errores.length) { console.error('ERRORES:\n  ' + errores.join('\n  ')); process.exit(1); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    main().catch((e) => { console.error(`extract-events: ${e.stack || e}`); process.exit(1); });
}
