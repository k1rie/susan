#!/usr/bin/env node
// build-index.mjs - genera index.html COMPLETO a partir de v2/plan.json (idempotente: se puede regenerar siempre desde cero).
//
// Uso:
//   node scripts/build-index.mjs [--plan v2/plan.json] [--out index.html] [--check] [--reset-sfx] [--no-validate]
//
//   --plan RUTA     plan v2 (por omision v2/plan.json)
//   --out RUTA      archivo a escribir (por omision index.html del proyecto; en pruebas usa otra ruta)
//   --root DIR      proyecto del que se lee el bloque sfx existente y se comprueban los archivos (por omision este proyecto)
//   --check         valida el plan, genera el HTML en memoria, comprueba su coherencia y lo compara con --out; NO escribe
//   --reset-sfx     descarta el bloque <!-- sfx:start/end --> existente (por omision se conserva tal cual: lo reescribe scripts/mount-sfx.mjs)
//   --no-validate   no ejecuta la validacion del plan antes de generar (por omision un plan con errores no se escribe)
//
// Que escribe:
//   - cabecera, estilos y GSAP del indice (mismos que el v1; cada .scene lleva fondo solido para que nunca se vea el borde de un cuadro)
//   - <div id="root" data-composition-id="main" data-duration=total> y un <div class="scene" data-composition-src data-start data-duration
//     data-track-index> por cuadro, con inicio_i = inicio_(i-1) + duracion_(i-1) - dur_transicion_(i-1) y pistas alternas 0/1
//   - el timeline raiz con las transiciones del vocabulario v2 entre // <!-- transitions:start --> y // <!-- transitions:end -->
//   - un bloque <!-- sfx:start --> ... <!-- sfx:end --> (vacio si no existia; si existe se conserva) que rellena scripts/mount-sfx.mjs
//   - por cada transicion la etiqueta 'sfx:<nombre>@<vol>#<n>' (n = numero de transicion 1..N) en el instante de maxima velocidad
//     (inicio de la transicion + sfx.peak * dur; si dur = 0, el instante del corte)
//
// Vocabulario (todo con GSAP puro y solo transform/opacity/filter/clip-path sobre los envoltorios #el-<id>):
//   cut/match  corte seco (dur 0)         flash   corte seco con destello de 3 fotogramas
//   push       el entrante empuja (dir, dist, fade)           whip   barrida brusca con desenfoque y estela (dir)
//   zoom       in: el saliente crece y se difumina; out: se aleja      squeeze  compresion hacia la izquierda
//   iris       circulo desde 'origin'                          wipe     barrida con borde de acento
//   over       el entrante aparece ENCIMA de un saliente al 100 %
// Reglas que implementa: el saliente y el entrante tienen fondo solido; ninguna transicion baja la opacidad de los dos a la vez;
// el zoom nunca escala el entrante por debajo de 1; los fromTo del entrante usan immediateRender por omision (una sola vez por propiedad).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIPOS, cargarPlan, linea } from './lib/plan.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const VAL = ['--plan', '--out', '--root'];
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const tiene = (n) => args.includes(`--${n}`);
if (tiene('help')) { console.error('Uso: node scripts/build-index.mjs [--plan v2/plan.json] [--out index.html] [--root DIR] [--check] [--reset-sfx] [--no-validate]'); process.exit(0); }
for (const a of args) if (a.startsWith('--') && ![...VAL, '--check', '--reset-sfx', '--no-validate', '--help'].includes(a)) { console.error(`Opcion desconocida: ${a}`); process.exit(2); }

const RAIZ = resolve(flag('root') ?? join(AQUI, '..'));
const RUTA_PLAN = resolve(flag('plan') ?? join(AQUI, '../v2/plan.json'));
const SALIDA = resolve(flag('out') ?? join(RAIZ, 'index.html'));
const W = 1920, H = 1080;
const CREMA = '#f7f5f2', TINTA = '#1e1919', ACENTO = '#0061fe';
const r3 = (x) => Math.round(x * 1000) / 1000;
const num = (x) => String(r3(x));

// ---------- plan ----------
let plan;
try { plan = cargarPlan(RUTA_PLAN); } catch (e) { console.error(e.message); process.exit(2); }
if (!tiene('no-validate')) {
    const v = spawnSync('node', [join(AQUI, 'validate-plan.mjs'), RUTA_PLAN], { encoding: 'utf8' });
    if (v.status !== 0) {
        console.error(v.stdout.trim());
        console.error('\nEl plan no es valido: no se genera el indice (usa --no-validate para forzarlo bajo tu responsabilidad).');
        process.exit(1);
    }
}
const L = linea(plan);
const trans = plan.transitions ?? [];
if (trans.length !== L.cuadros.length - 1) { console.error(`El plan debe tener ${L.cuadros.length - 1} transiciones (tiene ${trans.length}).`); process.exit(1); }

// ---------- curvas: pico real de velocidad de un ease (para avisar si sfx.peak no coincide) ----------
let gsapNode = null;
// El package.json del proyecto es "type":"module": un require() del UMD de GSAP lo trata como ESM y devuelve un espacio de nombres
// vacio (parseEase indefinido), con lo que el aviso de pico nunca se emitia. Se evalua como CommonJS con un 'module' propio.
try {
    const modulo = { exports: {} };
    new Function('module', 'exports', readFileSync(join(AQUI, 'lib/vendor/gsap.min.js'), 'utf8')).call(modulo.exports, modulo, modulo.exports);
    gsapNode = modulo.exports.gsap ?? null;
} catch { /* sin aviso de pico */ }
function picoDeEase(nombre) {
    if (!gsapNode) return null;
    const f = gsapNode.parseEase(nombre);
    if (typeof f !== 'function') return null;
    let mx = -1, at = 0, prev = f(0);
    for (let i = 1; i <= 400; i++) { const v = f(i / 400); const s = (v - prev) * 400; if (s > mx) { mx = s; at = i / 400; } prev = v; }
    return at;
}

// ---------- generadores de transicion ----------
const EASE_POR_TIPO = { push: 'power3.inOut', whip: 'expo.inOut', zoom: 'power3.in', squeeze: 'power3.inOut', iris: 'power2.inOut', wipe: 'power3.inOut', over: 'power2.out' };
const VEC = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }; // sentido en que viaja el contenido (el saliente se va hacia ahi)

function generar(t, i, ctx) {
    // ctx: { A, B, T, idA, idB } -> { lineas, overlays (html), notas }
    const { A, B, T } = ctx;
    const dur = Number(t.dur) || 0;
    const ease = t.ease || EASE_POR_TIPO[t.type] || 'power3.inOut';
    const lineas = [], overlays = [], notas = [];
    const at = (x) => num(T + x);
    switch (t.type) {
        case 'cut':
        case 'match':
            notas.push(t.type === 'match' ? 'corte con handoff (el elemento conserva posicion/escala)' : 'corte seco');
            break;
        case 'flash': {
            const tinta = /tinta|ink|oscur|dark/i.test(t.note || '');
            const id = `tx-flash-${i + 1}`;
            overlays.push(`<div id="${id}" class="tx-overlay" style="z-index:900;background:${tinta ? TINTA : '#fffdf8'};opacity:0"></div>`);
            // sube en 1 fotograma ANTES del corte (sobre el saliente), el entrante aparece bajo el destello y este decae en el resto de 'dur'
            lineas.push(`tl.fromTo("#${id}", { opacity: 0 }, { opacity: 0.92, duration: 0.034, ease: "none", immediateRender: false }, ${at(-0.034)});`);
            lineas.push(`tl.to("#${id}", { opacity: 0, duration: ${num(Math.max(dur, 0.07))}, ease: "power2.out" }, ${at(0)});`);
            notas.push(`destello ${tinta ? 'tinta' : 'crema'} sobre el corte`);
            break;
        }
        case 'push': {
            const [vx, vy] = VEC[t.dir];
            const dist = t.dist ?? 1;
            const dxB = vx ? W : 0, dyB = vy ? H : 0;
            // el entrante recorre todo el cuadro; el saliente solo 'dist' (parallax); el entrante siempre lo cubre
            lineas.push(`tl.fromTo(${B}, { x: ${-vx * dxB}, y: ${-vy * dyB} }, { x: 0, y: 0, duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
            lineas.push(`tl.to(${A}, { x: ${num(vx * W * dist)}, y: ${num(vy * H * dist)}, ${t.fade ? 'opacity: 0.35, ' : ''}duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
            notas.push(`push ${t.dir}, el saliente recorre ${Math.round(dist * 100)} %${t.fade ? ' y se atenua a 0.35' : ''}`);
            break;
        }
        case 'whip': {
            const [vx, vy] = VEC[t.dir];
            const blur = 20;
            const eje = vx !== 0 ? 'scaleX' : 'scaleY';
            const estira = 1.12; // estiramiento a lo largo del movimiento: simula el desenfoque direccional (el blur de CSS es isotropico)
            lineas.push(`tl.fromTo(${B}, { x: ${-vx * W}, y: ${-vy * H}, ${eje}: ${estira}, filter: "blur(${blur}px)" }, { x: 0, y: 0, ${eje}: 1, filter: "blur(0px)", duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
            lineas.push(`tl.to(${A}, { x: ${vx * W}, y: ${vy * H}, ${eje}: ${estira}, filter: "blur(${blur}px)", duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
            // estela: lineas de velocidad que cruzan mas rapido que las escenas
            const id = `tx-estela-${i + 1}`;
            const horiz = vx !== 0;
            const sentido = horiz ? vx : vy;
            const lineasEst = [];
            const posiciones = [8, 19, 31, 43, 52, 63, 74, 86];
            posiciones.forEach((p, k) => {
                const largo = 38 + ((k * 17) % 30); // % del cuadro
                const grosor = 4 + (k % 3) * 3;
                const alfa = (0.55 + (k % 3) * 0.12).toFixed(2);
                const color = k % 4 === 3 ? `rgba(255,255,255,${alfa})` : k % 2 ? `rgba(0,97,254,${(alfa * 0.55).toFixed(2)})` : `rgba(30,25,25,${(alfa * 0.6).toFixed(2)})`;
                const grad = horiz
                    ? `linear-gradient(${sentido > 0 ? 270 : 90}deg, ${color}, rgba(255,255,255,0))`
                    : `linear-gradient(${sentido > 0 ? 0 : 180}deg, ${color}, rgba(255,255,255,0))`;
                const pos = horiz
                    ? `top:${p}%;left:${(k * 13) % 40}%;width:${largo}%;height:${grosor}px`
                    : `left:${p}%;top:${(k * 13) % 40}%;height:${largo}%;width:${grosor}px`;
                lineasEst.push(`<i style="position:absolute;${pos};background:${grad};border-radius:3px"></i>`);
            });
            overlays.push(`<div id="${id}" class="tx-overlay" style="z-index:800;opacity:0">${lineasEst.join('')}</div>`);
            lineas.push(`tl.fromTo("#${id}", { x: ${-vx * W * 0.9}, y: ${-vy * H * 0.9}, opacity: 0 }, { x: ${vx * W * 0.9}, y: ${vy * H * 0.9}, opacity: 0.9, duration: ${num(dur)}, ease: "power2.inOut" }, ${at(0)});`);
            lineas.push(`tl.to("#${id}", { opacity: 0, duration: ${num(Math.min(0.12, dur * 0.4))}, ease: "power1.in" }, ${at(dur * 0.62)});`);
            notas.push(`whip ${t.dir}: blur ${blur}px + estiramiento x${estira} en los dos cuadros + estela de ${posiciones.length} lineas`);
            break;
        }
        case 'zoom': {
            if (t.dir === 'in') {
                // el saliente CRECE hacia el espectador (acelera) y se difumina; el entrante entra 1.15 -> 1 con fundido en la segunda mitad,
                // SOBRE el saliente, que sigue opaco: nunca bajan los dos a la vez y el entrante nunca baja de escala 1
                lineas.push(`tl.to(${A}, { scale: 2, duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
                lineas.push(`tl.to(${A}, { filter: "blur(16px)", duration: ${num(dur * 0.8)}, ease: "power2.in" }, ${at(0)});`);
                lineas.push(`tl.fromTo(${B}, { scale: 1.15, opacity: 0 }, { scale: 1, opacity: 1, duration: ${num(dur * 0.5)}, ease: "power2.out" }, ${at(dur * 0.5)});`);
                notas.push('zoom in: saliente x2 con blur 16px (acelera); entrante 1.15 -> 1 con fundido en la 2a mitad (nunca < 1)');
            } else {
                // el saliente se aleja (encoge y se apaga) sobre el entrante, que esta DEBAJO y ya es opaco: no hay lavado
                // la opacidad NO comparte el ease de la escala: con power2.out el saliente llegaba a 0.25 de opacidad a mitad del zoom y, como el entrante
                // solo trae su icono (no escribe nada antes de 0.35 s), la pantalla quedaba casi en blanco (std 3.5 de gris a 37.13 s). Con power2.in el
                // saliente sigue legible casi todo el alejamiento y se apaga justo al terminar, cuando entra el texto del entrante.
                lineas.push(`tl.to(${A}, { scale: 0.78, filter: "blur(10px)", duration: ${num(dur)}, ease: "${t.ease || 'power2.in'}" }, ${at(0)});`);
                lineas.push(`tl.to(${A}, { opacity: 0, duration: ${num(dur)}, ease: "power2.in" }, ${at(0)});`);
                lineas.push(`tl.fromTo(${B}, { scale: 1.1 }, { scale: 1, duration: ${num(dur)}, ease: "power3.out" }, ${at(0)});`);
                notas.push('zoom out: saliente x0.78 se apaga sobre un entrante opaco 1.1 -> 1 (z-index inferior)');
            }
            break;
        }
        case 'squeeze': {
            lineas.push(`tl.to(${A}, { scaleX: 0, transformOrigin: "0% 50%", duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
            lineas.push(`tl.fromTo(${B}, { scaleX: 0, transformOrigin: "100% 50%" }, { scaleX: 1, transformOrigin: "100% 50%", duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
            notas.push('squeeze: scaleX complementarios (1-p y p), sin huecos');
            break;
        }
        case 'iris': {
            const [ox, oy] = t.origin;
            const R = Math.ceil(Math.hypot(Math.max(ox * W, W - ox * W), Math.max(oy * H, H - oy * H)) * 1.03);
            const pos = `${num(ox * 100)}% ${num(oy * 100)}%`;
            lineas.push(`tl.fromTo(${B}, { clipPath: "circle(0px at ${pos})" }, { clipPath: "circle(${R}px at ${pos})", duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
            lineas.push(`tl.to(${A}, { scale: 1.05, duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
            notas.push(`iris desde (${num(ox)}, ${num(oy)}), radio final ${R}px`);
            break;
        }
        case 'wipe': {
            const [vx, vy] = VEC[t.dir];
            // el borde de revelado entra por el lado opuesto al sentido del contenido; inset(top right bottom left)
            // todas las medidas en % (GSAP interpola numero a numero y respeta la unidad del texto final: mezclar px y % rompe el recorte)
            const ini = vx > 0 ? 'inset(0% 100% 0% 0%)' : vx < 0 ? 'inset(0% 0% 0% 100%)' : vy > 0 ? 'inset(0% 0% 100% 0%)' : 'inset(100% 0% 0% 0%)';
            lineas.push(`tl.fromTo(${B}, { clipPath: "${ini}" }, { clipPath: "inset(0% 0% 0% 0%)", duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
            const id = `tx-borde-${i + 1}`;
            const horiz = vx !== 0;
            const G = 14, E = 150, K = G + E; // grosor de la barra de acento y largo de su estela sobre el cuadro ya revelado
            const c1 = 'rgba(0,97,254,0.22)', c0 = 'rgba(0,97,254,0)';
            let caja, barra, desde, hasta;
            if (horiz) {
                // contenido hacia la izquierda: el borde viaja de derecha a izquierda (borde = x); hacia la derecha: de izquierda a derecha (borde = x + K)
                caja = `left:0;top:0;width:${K}px;height:${H}px`;
                barra = vx < 0
                    ? `<i style="position:absolute;top:0;bottom:0;left:0;width:${G}px;background:${ACENTO}"></i><i style="position:absolute;top:0;bottom:0;left:${G}px;width:${E}px;background:linear-gradient(90deg,${c1},${c0})"></i>`
                    : `<i style="position:absolute;top:0;bottom:0;right:0;width:${G}px;background:${ACENTO}"></i><i style="position:absolute;top:0;bottom:0;right:${G}px;width:${E}px;background:linear-gradient(270deg,${c1},${c0})"></i>`;
                desde = vx < 0 ? W : -K;
                hasta = vx < 0 ? 0 : W - K;
            } else {
                caja = `left:0;top:0;width:${W}px;height:${K}px`;
                barra = vy < 0
                    ? `<i style="position:absolute;left:0;right:0;top:0;height:${G}px;background:${ACENTO}"></i><i style="position:absolute;left:0;right:0;top:${G}px;height:${E}px;background:linear-gradient(180deg,${c1},${c0})"></i>`
                    : `<i style="position:absolute;left:0;right:0;bottom:0;height:${G}px;background:${ACENTO}"></i><i style="position:absolute;left:0;right:0;bottom:${G}px;height:${E}px;background:linear-gradient(0deg,${c1},${c0})"></i>`;
                desde = vy < 0 ? H : -K;
                hasta = vy < 0 ? 0 : H - K;
            }
            overlays.push(`<div id="${id}" class="tx-overlay" style="z-index:800;${caja};opacity:0">${barra}</div>`);
            const eje = horiz ? 'x' : 'y';
            // el borde usa el MISMO ease y duracion que el recorte, asi acompana exactamente el limite del cuadro entrante
            lineas.push(`tl.fromTo("#${id}", { ${eje}: ${desde}, opacity: 1 }, { ${eje}: ${hasta}, duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
            lineas.push(`tl.to("#${id}", { opacity: 0, duration: ${num(Math.min(0.08, dur * 0.2))}, ease: "power1.in" }, ${at(dur - Math.min(0.08, dur * 0.2))});`);
            notas.push(`wipe ${t.dir} con borde de acento (${G}px + estela ${E}px)`);
            break;
        }
        case 'over': {
            lineas.push(`tl.fromTo(${B}, { opacity: 0, scale: 1.03 }, { opacity: 1, scale: 1, duration: ${num(dur)}, ease: "${ease}" }, ${at(0)});`);
            notas.push('over: el saliente se mantiene al 100 % y el entrante se funde encima (nunca bajan los dos)');
            break;
        }
        default:
            throw new Error(`Tipo de transicion no soportado: ${t.type}`);
    }
    return { lineas, overlays, notas };
}

// ---------- ensamblado ----------
function construir() {
    // z-index: creciente; el entrante de un 'zoom out' va DEBAJO del saliente
    const z = [];
    L.cuadros.forEach((c, i) => {
        if (i === 0) z.push(10);
        else z.push(trans[i - 1].type === 'zoom' && trans[i - 1].dir === 'out' ? z[i - 1] - 5 : z[i - 1] + 10);
    });
    const escenas = L.cuadros.map((c, i) => `      <div
        id="el-${c.id}"
        class="scene"
        data-composition-id="${c.id}"
        data-composition-src="compositions/frames/${c.id}.html"
        data-start="${num(c.inicio)}"
        data-duration="${num(c.duracion)}"
        data-track-index="${i % 2}"
        style="z-index:${z[i]}"
      ></div>`);
    const overlays = [], lineasTl = [], avisos = [];
    trans.forEach((t, i) => {
        const cb = L.cuadros[i + 1];
        const T = cb.inicio; // el entrante empieza en 'T'; el saliente termina en T + dur
        const g = generar(t, i, { A: `"#el-${t.from}"`, B: `"#el-${t.to}"`, T });
        overlays.push(...g.overlays);
        const dur = Number(t.dur) || 0;
        const nom = t.sfx?.name;
        const instante = T + (t.sfx?.peak ?? 0) * dur;
        lineasTl.push(`        // ${i + 1}. ${t.from} -> ${t.to}: ${t.type}${t.dir ? ' ' + t.dir : ''} dur ${num(dur)} s @ ${num(T)} s${t.note ? ' (' + t.note.replace(/\s+/g, ' ') + ')' : ''}; ${g.notas.join('; ')}`);
        for (const l of g.lineas) lineasTl.push(`        ${l}`);
        if (nom) {
            lineasTl.push(`        tl.addLabel("sfx:${nom}@${num(t.sfx.vol)}#${i + 1}", ${num(instante)});`);
            if (dur > 0 && gsapNode) {
                // el zoom tambien usa el ease real del plan (power2.out pica al inicio, power3.in al final): el modelo fijo 0.7/0.5 dejaba pasar un zoom-out a 88 ms
                const pico = t.type === 'flash' ? 0 : picoDeEase(t.ease || EASE_POR_TIPO[t.type] || 'power3.inOut');
                if (pico != null && Math.abs(pico - t.sfx.peak) >= 0.2) avisos.push(`transicion ${i + 1} (${t.type}): sfx.peak ${t.sfx.peak} pero el pico de velocidad de su curva esta en ${pico.toFixed(2)} de dur`);
            }
        }
        lineasTl.push('');
    });

    // bloque sfx existente
    let bloqueSfx = '      <!-- sfx:start (generado por scripts/mount-sfx.mjs; sin voz ni música) -->\n      <!-- sfx:end -->';
    if (!tiene('reset-sfx')) {
        const previo = existsSync(join(RAIZ, 'index.html')) ? readFileSync(join(RAIZ, 'index.html'), 'utf8') : '';
        const m = /[ \t]*<!-- sfx:start[^>]*-->[\s\S]*?<!-- sfx:end -->/.exec(previo);
        // si se escribe en otro archivo se conserva el del archivo de salida cuando exista
        const previoSalida = existsSync(SALIDA) ? readFileSync(SALIDA, 'utf8') : '';
        const ms = /[ \t]*<!-- sfx:start[^>]*-->[\s\S]*?<!-- sfx:end -->/.exec(previoSalida);
        const elegido = ms ?? m;
        if (elegido) bloqueSfx = elegido[0].replace(/^[ \t]*/, '      ');
    }

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js" integrity="sha384-sG0Hv1tP1lZCk9KQmrIbY/XNwi+OY84GQqhMscbnsoBFqAz8KNCil1kvfL3Hbbk2" crossorigin="anonymous"></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: #000;
      }
      #root {
        position: relative;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: ${CREMA};
      }
      /* Cada cuadro lleva fondo solido: durante una transicion nunca se ve el borde del otro ni el lienzo de atras */
      .scene {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: ${CREMA};
      }
      /* Capas de efecto de las transiciones (destello, estela, borde del wipe): sobre todos los cuadros, sin eventos */
      .tx-overlay {
        position: absolute;
        left: 0;
        top: 0;
        width: 1920px;
        height: 1080px;
        pointer-events: none;
        overflow: visible;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${num(L.total)}"
      data-width="1920"
      data-height="1080"
    >
${escenas.join('\n\n')}

${overlays.length ? '      <!-- tx-overlays (generados por scripts/build-index.mjs) -->\n' + overlays.map((o) => '      ' + o).join('\n') + '\n\n' : ''}
${bloqueSfx}
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
      (function () {
        var tl = window.__timelines["main"];
        // <!-- transitions:start (generado por scripts/build-index.mjs desde ${'v2/plan.json'}; no editar a mano) -->
${lineasTl.join('\n')}
        // <!-- transitions:end -->
        tl.to({}, { duration: ${num(L.total)} }, 0); // ancla de todo el video: main.duration() == total (duracion maestra de Studio)
      })();
    </script>
  </body>
</html>
`;
    return { html, avisos, z };
}

const { html, avisos, z } = construir();

// ---------- coherencia (siempre) ----------
const problemas = [];
const idsEl = [...html.matchAll(/id="el-([^"]+)"/g)].map((m) => m[1]);
if (idsEl.length !== L.cuadros.length) problemas.push(`se esperaban ${L.cuadros.length} escenas y hay ${idsEl.length}`);
if (new Set(idsEl).size !== idsEl.length) problemas.push('ids de escena repetidos');
if (!/<!-- sfx:start[^>]*-->[\s\S]*<!-- sfx:end -->/.test(html)) problemas.push('falta el bloque sfx');
if (!html.includes('// <!-- transitions:start') || !html.includes('// <!-- transitions:end -->')) problemas.push('faltan los marcadores de transiciones');
if (!/\n    <\/div>\n\n    <script>/.test(html)) problemas.push('el cierre del #root debe ir como "\\n    </div>\\n\\n    <script>" (lo necesita mount-sfx.mjs)');
const ultimo = L.cuadros.at(-1);
if (Math.abs(ultimo.fin - L.total) > 0.001) problemas.push(`el ultimo cuadro termina en ${ultimo.fin} s y el total es ${L.total} s`);
L.cuadros.forEach((c, i) => { if (i > 0 && c.inicio < L.cuadros[i - 1].inicio) problemas.push(`el cuadro ${c.id} empieza antes que el anterior`); });
for (const t of trans) if (!TIPOS.includes(t.type)) problemas.push(`tipo ${t.type} fuera del vocabulario`);
for (const f of L.cuadros) if (!existsSync(join(RAIZ, 'compositions/frames', `${f.id}.html`))) avisos.push(`aun no existe compositions/frames/${f.id}.html`);

if (tiene('check')) {
    const actual = existsSync(SALIDA) ? readFileSync(SALIDA, 'utf8') : null;
    console.log(`Plan ${RUTA_PLAN}: ${L.cuadros.length} cuadros, ${num(L.total)} s, ${trans.length} transiciones (${[...new Set(trans.map((t) => t.type))].join(', ')})`);
    for (const a of avisos) console.log(`  AVISO ${a}`);
    for (const p of problemas) console.log(`  ERROR ${p}`);
    console.log(actual === null ? `  ${SALIDA} no existe todavia` : actual === html ? `  ${SALIDA} esta al dia` : `  ${SALIDA} esta DESACTUALIZADO respecto al plan (regenera con: node scripts/build-index.mjs)`);
    console.log(problemas.length ? 'FALLA' : 'OK: el indice se puede generar sin errores');
    process.exit(problemas.length ? 1 : 0);
}
if (problemas.length) { for (const p of problemas) console.error(`ERROR ${p}`); process.exit(1); }
writeFileSync(SALIDA, html);
for (const a of avisos) console.log(`AVISO ${a}`);
console.log(`index escrito: ${SALIDA}  (${L.cuadros.length} cuadros, ${num(L.total)} s, ${trans.length} transiciones; z-index ${z.join(',')})`);
