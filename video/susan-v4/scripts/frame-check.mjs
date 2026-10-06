#!/usr/bin/env node
// frame-check.mjs - el "medidor" de UN cuadro de la v4: revisa movimiento, eventos, camara/pose 3D, sonido, lectura, iconos y trampas
// sin renderizar el video. Se corre sobre compositions/frames/<frame_id>.html antes de ensamblar (o despues: no toca index.html).
//
// Uso:
//   node scripts/frame-check.mjs <frame_id>... [--todos] [--json] [--duration N] [--final] [--rapido] [--file ruta.html] [--lectura-min 1.2]
//
//   <frame_id>     sNN-nombre (el basename de `src` en STORYBOARD.md); --todos revisa todos los cuadros del storyboard que existan
//   --duration N   duracion del cuadro (si no: la `duration` de su Frame en STORYBOARD.md; si no, el data-duration de su raiz)
//   --final        lo trata como el ultimo cuadro (permite salida y quietud final); por omision lo decide el storyboard
//   --rapido       salta el muestreo de pixeles (a): solo timeline, fuente y pose
//   --file RUTA    revisa un borrador fuera de compositions/frames (con un solo <frame_id>)
//   Codigo de salida: 1 si algun cuadro tiene ERRORES (los AVISOS no fallan); 2 si el uso es incorrecto.
//
// Como mide (cambios respecto a la v3):
//   - El cuadro se aloja con el RUNTIME REAL de la CLI fijada (0.8.134) en un proyecto temporal con solo ese cuadro en 0 s
//     (scripts/lib/runtime-host.mjs); el instante se busca con window.__player.renderSeek como snapshot/render. La v3 imitaba el 0.8.114.
//   - Tiempos y sonido salen de STORYBOARD.md (duration, transition_in, sfx_cues, vo_anchor), no de v2/plan.json.
//   - Los primeros `dur` s de un cuadro con transition_in quedan bajo la transicion entrante (transitions.mjs alarga el cuadro SALIENTE).
//
// Chequeos (doctrina: SINTESIS 14, 15, 18, 19, 21, 22; PLAYBOOK 3.1 y 4):
//   (a) movimiento  energia por 0.1 s (15 fps, 480 px de ancho, gris, x0.8 calibrado con h264 en la v3): quieto < 0.30, grande >= 2.0
//                   (umbral grande SIN calibrar en la v4: informativo). Tramo muerto >= 1.0 s = ERROR (salvo la quietud final del cuadro
//                   final, hasta 2.5 s). Reparto grande/micro/quieto contra el objetivo ~25-30 / ~50 / ~20-25 % (informativo).
//                   Primer movimiento visible > 0.2 s en un cuadro con corte = AVISO. >= 70 % de las entradas en el primer 25 % = AVISO
//                   (diapositiva).
//   (b) eventos     pausa mas larga sin un evento VISIBLE >= 1.5 s = AVISO.
//   (c) camara/pose movimientos del contenedor world/cam/stage/rig: deriva < 3 %/s en la SEGUNDA mitad = AVISO (sin respiracion ni deriva
//                   lenta). Pose 3D: |rotationX| > 8 o |rotationY| > 10 en un tween = ERROR; giro en el plano (rotation/rotationZ) en
//                   camara o en un elemento >= 20 % del lienzo = ERROR (en uno chico, AVISO); no plano (|rotX|,|rotY| > 0.5) en el ultimo
//                   fotograma, en t = 0 con transition_in cut o en una marca read: = ERROR.
//   (d) sonido      cada cue de `sfx_cues` del cuadro: golpe a <= 33.3 ms del inicio o final de un tween; whoosh sobre un tween (o dentro de
//                   la transicion entrante); tick dentro de un tween; nombre canonico del catalogo. Huerfano o nombre invalido = ERROR.
//                   Etiquetas `sfx:` en el timeline (contrato de la v3) = AVISO: en la v4 el sonido se declara en sfx_cues.
//   (e) lectura     cada `read:<frase>` (readMark) a >= --lectura-min (1.2 s) del final del cuadro = ERROR si no.
//   (f) iconos      scripts/lucide.mjs --verify --strict; iconos < 28 px = AVISO; icono de cursor/puntero = ERROR (sin cursor).
//   (g) trampas     estructura (<template>, raiz, timeline registrado y pausado), ids sin prefijo, <audio>/<video>, CSS transition/@keyframes,
//                   repeat:-1, Math.random/Date, fromTo repetido sin immediateRender:false, salida en cuadro no final, transform CSS sobre
//                   lo que anima GSAP, GSAP del CDN (= ERROR, frame.md 1), pesos >= 700 (AVISO), filter/opacity/overflow en ancestros de
//                   preserve-3d (AVISO: aplana el 3D), blur animado > 24 px (AVISO), sobreimpulsos back/elastic/bounce (contados; con
//                   --todos, > 2 en el video = ERROR).
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { DIR_SCRIPTS, opcion, raiz, rutas } from './lib/rutas.mjs';
import { leerStoryboard, parseSfxCues } from './lib/storyboard.mjs';
import { cargarCatalogo, resolverSonido } from './lib/sfx-lib.mjs';
import { crearHost } from './lib/runtime-host.mjs';
import { pngAGris } from './lib/png.mjs';

const R = raiz();
const P = rutas(R);
const args = process.argv.slice(2);
const VAL = new Set(['--duration', '--file', '--root', '--lectura-min']);
const flag = (n) => opcion(args, `--${n}`);
const tiene = (n) => args.includes(`--${n}`);
let ids = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VAL.has(args[i - 1])));
const sb = existsSync(P.storyboard) ? leerStoryboard(readFileSync(P.storyboard, 'utf8')) : { frames: [], globals: {} };
if (tiene('todos')) ids = sb.frames.filter((f) => f.frameId && existsSync(join(P.cuadros, `${f.frameId}.html`))).map((f) => f.frameId);
if (!ids.length || tiene('help')) {
    console.error('Uso: node scripts/frame-check.mjs <frame_id>... [--todos] [--json] [--duration N] [--final] [--rapido] [--file ruta.html] [--lectura-min 1.2]');
    process.exit(ids.length ? 0 : 2);
}
const [ANCHO, ALTO] = (/^(\d+)x(\d+)$/.exec(sb.globals.format ?? '') ?? [0, 1920, 1080]).slice(1).map(Number);

// ---------- parametros ----------
const FPS = 15, ANCHO_M = 480;
const UMBRAL_LENTO = 0.30, UMBRAL_GRANDE = 2.0, FACTOR_VIDEO = 0.8;
const MIN_TRAMO = 0.6, MUERTO = 1.0, QUIETUD_FINAL_MAX = 2.5;
const DERIVA_PCT_S = 3, SNAP_PCT = 6, SNAP_DUR = 0.25;
const TOL = 1 / 30 + 1e-4;
const LECTURA = Number(flag('lectura-min') ?? 1.2);
const ROT_X_MAX = 8, ROT_Y_MAX = 10, PLANO = 0.5;
const EXIT_AREA_MIN = 0.8;
const CAM_ID = /(^|-)(world|cam|camera|camara|rig|stage|escenario|dolly|drift|lockup|objeto)$/i;
const TRANSFORMS = new Set(['x', 'y', 'z', 'xPercent', 'yPercent', 'scale', 'scaleX', 'scaleY', 'rotation', 'rotationX', 'rotationY', 'rotationZ', 'skewX', 'skewY']);
const SOBREIMPULSO = /^(back|elastic|bounce)/i;
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
const cat = existsSync(P.catalogo) ? cargarCatalogo(R) : null;

// ---------- recoleccion de tweens dentro de la pagina (tiempos LOCALES del cuadro) ----------
function recoger(idc) {
    const tl = window.__timelines[idc];
    const claves = new WeakMap();
    let n = 0;
    const clave = (el) => { if (el.id) return el.id; if (!claves.has(el)) claves.set(el, `~${el.tagName.toLowerCase()}#${++n}`); return claves.get(el); };
    const CTRL = new Set(['ease', 'duration', 'delay', 'stagger', 'startAt', 'onComplete', 'onStart', 'onUpdate', 'overwrite', 'immediateRender', 'lazy', 'data', 'id', 'paused', 'repeat', 'yoyo', 'repeatDelay', 'runBackwards', 'keyframes', 'callbackScope', 'onReverseComplete', 'onRepeat', 'inherit', 'parent', 'defaults', 'snap', 'modifiers', 'onUpdateParams', 'onCompleteParams', 'onStartParams']);
    const desc = (el) => {
        if (!el || el.nodeType !== 1) return { key: 'objeto-js', id: null, html: false, area: 0, camara: false };
        const w = el.offsetWidth || (el.getBoundingClientRect && el.getBoundingClientRect().width) || 0;
        const h = el.offsetHeight || (el.getBoundingClientRect && el.getBoundingClientRect().height) || 0;
        return { key: clave(el), id: el.id || null, html: true, area: w * h, camara: el.hasAttribute('data-camera') };
    };
    const pendiente = (ease) => {
        if (!ease || typeof ease !== 'function') return 1;
        let max = 0, prev = ease(0);
        for (let i = 1; i <= 240; i++) { const v = ease(i / 240); max = Math.max(max, (v - prev) * 240); prev = v; }
        return max || 1;
    };
    const salida = [];
    for (const tw of tl.getChildren(true, true, false)) {
        let t0 = tw.startTime(), p = tw.parent;
        while (p && p !== tl) { t0 += p.startTime(); p = p.parent; }
        const v = tw.vars || {};
        const objetivos = (typeof tw.targets === 'function' ? tw.targets() : []).map(desc);
        const props = [];
        const meter = (pt, target) => { if (!pt || typeof pt.p !== 'string') return; props.push({ p: pt.p, s: typeof pt.s === 'number' ? pt.s : null, c: typeof pt.c === 'number' ? pt.c : null, t: target ? desc(target).key : null }); };
        for (let pt = tw._pt; pt; pt = pt._next) {
            if (pt.p === 'css' && pt.d && pt.d._pt) { for (let q = pt.d._pt; q; q = q._next) if (q.p !== 'transform') meter(q, pt.t); }
            else if (pt.p !== 'snap' && pt.p !== 'css') meter(pt, pt.t && pt.t.nodeType === 1 ? pt.t : null);
        }
        const claves2 = Object.keys(v).filter((k) => !CTRL.has(k));
        const valores = {};
        for (const k of claves2) if (typeof v[k] === 'number' || typeof v[k] === 'string') valores[k] = v[k];
        const desde = {};
        for (const k of Object.keys(v.startAt || {})) if (!CTRL.has(k) && (typeof v.startAt[k] === 'number' || typeof v.startAt[k] === 'string')) desde[k] = v.startAt[k];
        const easeNombre = typeof v.ease === 'string' ? v.ease : (v.ease && v.ease.name) || 'power1.out';
        salida.push({
            t0, d: tw.duration(), tipo: typeof tw.targets !== 'function' ? 'call' : v.startAt ? 'fromTo' : v.runBackwards ? 'from' : tw.duration() === 0 ? 'set' : 'to',
            ease: easeNombre, pend: pendiente(tw._ease), inmediato: v.immediateRender, tieneStartAt: !!v.startAt || !!v.runBackwards, repeat: v.repeat ?? 0,
            objetivos, props, vars: claves2, valores, desde, claveDesde: Object.keys(desde),
            esAncla: objetivos.length === 1 && !objetivos[0].html && claves2.length === 0 && typeof tw.targets === 'function',
        });
    }
    const etiquetas = Object.keys(tl.labels || {}).map((k) => ({ nombre: k, t: tl.labels[k] }));
    return { tweens: salida, etiquetas };
}

// Rotaciones 3D/plano de todos los elementos del cuadro en el instante actual (los que GSAP toco: tienen _gsap).
function poses(idc) {
    const raizEl = document.querySelector(`[data-composition-id="${idc}"]`);
    const out = [];
    for (const el of (raizEl || document).querySelectorAll('*')) {
        if (!el._gsap) continue;
        const rx = Number(window.gsap.getProperty(el, 'rotationX')) || 0, ry = Number(window.gsap.getProperty(el, 'rotationY')) || 0, rz = Number(window.gsap.getProperty(el, 'rotation')) || 0;
        if (Math.abs(rx) > 1e-3 || Math.abs(ry) > 1e-3 || Math.abs(rz) > 1e-3) out.push({ id: el.id || el.className || el.tagName, rx, ry, rz });
    }
    return out;
}

function normalizaProp(p) { return p === 'scaleX' || p === 'scaleY' ? 'scale' : p; }

function esVisible(tw) {
    if (tw.esAncla || tw.tipo === 'call') return [];
    const d = Math.max(tw.d, 1e-3), visibles = [];
    for (const pr of tw.props) {
        const p = pr.p, c = pr.c;
        if (c === null || pr.s === null) { if (!['transform', 'css'].includes(p)) visibles.push(p); continue; }
        const m = Math.abs(c), rate = m / d;
        let ok;
        if (p === 'opacity' || p === 'autoAlpha') ok = m >= 0.15 && rate >= 0.15;
        else if (p === 'x' || p === 'y' || p === 'z') ok = m >= 16 && rate >= 10;
        else if (p === 'xPercent' || p === 'yPercent') ok = m >= 2 && rate >= 5;
        else if (p === 'scaleX' || p === 'scaleY' || p === 'scale') ok = m >= 0.04 && rate >= 0.02;
        else if (/^rotation/.test(p) || /^skew/.test(p)) ok = m >= 2 && rate >= 2;
        else if (p === 'strokeDashoffset' || p === 'strokeDasharray') ok = m > 0.02;
        else ok = m > 1e-6;
        if (ok) visibles.push(p);
    }
    if (!tw.props.length && tw.vars.length) visibles.push(...tw.vars);
    return [...new Set(visibles)];
}

function analizarCamara(tweens, W, H) {
    const mov = [];
    for (const tw of tweens) {
        const camaras = tw.objetivos.filter((o) => o.html && (CAM_ID.test(o.id || '') || o.camara));
        if (!camaras.length) continue;
        const porProp = {};
        for (const pr of tw.props) {
            if (!camaras.some((o) => o.key === pr.t) || pr.c === null) continue;
            const p = normalizaProp(pr.p);
            let pct;
            if (p === 'scale') pct = Math.abs(pr.c) * 100;
            else if (p === 'x') pct = (Math.abs(pr.c) / W) * 100;
            else if (p === 'y') pct = (Math.abs(pr.c) / H) * 100;
            else if (p === 'xPercent' || p === 'yPercent') pct = Math.abs(pr.c);
            else if (/^rotation/.test(p)) pct = Math.abs(pr.c) * 2;
            else continue;
            if (!porProp[p] || pct > porProp[p].pct) porProp[p] = { pct, c: pr.c, s: pr.s };
        }
        const props = Object.keys(porProp);
        if (!props.length) continue;
        const d = Math.max(tw.d, 1e-3);
        let pico = 0, delta = 0;
        for (const p of props) { pico = Math.max(pico, (porProp[p].pct * tw.pend) / d); delta = Math.max(delta, porProp[p].pct); }
        mov.push({ id: camaras.map((o) => o.id).join('+'), t0: r3(tw.t0), t1: r3(tw.t0 + tw.d), deltaPct: r1(delta), picoPctS: r1(pico), perceptible: pico >= DERIVA_PCT_S && delta >= 1, snap: delta >= SNAP_PCT && d <= SNAP_DUR + 1e-6 });
    }
    return mov.sort((a, b) => a.t0 - b.t0);
}

function pausaMasLarga(intervalos, ini, fin) {
    const ord = [...intervalos].sort((a, b) => a[0] - b[0]);
    let cursor = ini, mejor = { dur: 0, de: ini, a: ini };
    for (const [a, b] of ord) { if (a > cursor && a - cursor > mejor.dur) mejor = { dur: a - cursor, de: cursor, a }; cursor = Math.max(cursor, b); }
    if (fin > cursor && fin - cursor > mejor.dur) mejor = { dur: fin - cursor, de: cursor, a: fin };
    return { dur: r2(mejor.dur), de: r2(mejor.de), a: r2(mejor.a) };
}
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

// ---------- revision de un cuadro ----------
async function revisar(host, id) {
    const E = [], A = [], N = [];
    const err = (cod, msg) => E.push({ cod, msg });
    const avi = (cod, msg) => A.push({ cod, msg });
    const info = { id };
    const f = sb.frames.find((x) => x.frameId === id) ?? null;
    const idx = f ? sb.frames.indexOf(f) : -1;
    const esFinal = tiene('final') || (f ? idx === sb.frames.length - 1 : false);
    const entrada = f?.transicion?.dur ?? 0;
    const archivo = flag('file') && ids.length === 1 ? resolve(flag('file')) : null;
    const D = flag('duration') ? Number(flag('duration')) : f?.duracion ?? null;
    let c;
    try { c = await host.abrirCuadro(id, { archivo, duracion: D, ancho: ANCHO, alto: ALTO }); } catch (e) { return { id, errores: [{ cod: 'carga', msg: e.message }], avisos: [], notas: [], info }; }
    try {
        const { meta } = c;
        const texto = meta.texto;
        const m = /<template[^>]*>([\s\S]*)<\/template>\s*$/i.exec(texto.trim());
        const dentro = m ? m[1] : texto;
        const scripts = [...dentro.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
        const js = scripts.map((x) => x[2]).join('\n');
        const contenido = dentro.replace(/<script\b[\s\S]*?<\/script>/gi, '');
        const Dc = meta.duracion;
        info.duracion = Dc; info.entrada = entrada; info.final = esFinal; info.timeline = r2(meta.duracionTimeline ?? 0);
        if (!f) avi('storyboard', `${id} no aparece como src de ningun Frame en STORYBOARD.md: se usa la duracion de su raiz (${Dc} s) y no se revisan sfx_cues`);

        // ---- (g) estructura y fuente ----
        if (!m) err('estructura', 'el archivo no esta envuelto en <template>...</template>');
        if (/<(html|head|body)\b/i.test(dentro)) err('estructura', 'el cuadro no debe llevar <html>/<head>/<body> (solo <template>)');
        if (!new RegExp(`data-composition-id="${id}"`).test(texto)) err('estructura', `falta la raiz con data-composition-id="${id}"`);
        if (!new RegExp(`__timelines\\[\\s*['"]${id}['"]\\s*\\]`).test(texto)) err('estructura', `el script no registra window.__timelines["${id}"]`);
        if (!meta.registrado) err('estructura', `window.__timelines["${id}"] no existe con el runtime (claves: ${meta.claves.join(', ') || 'ninguna'})`);
        else if (!meta.pausado) err('estructura', 'el timeline del cuadro debe crearse con { paused: true }');
        if (`${meta.raizAncho}x${meta.raizAlto}` !== `${ANCHO}x${ALTO}`) avi('estructura', `la raiz declara ${meta.raizAncho}x${meta.raizAlto} y el storyboard ${ANCHO}x${ALTO}`);
        for (const e of c.errores) err('carga', e);
        if (!c.listo) avi('carga', 'el runtime no llego a window.__renderReady (las capturas pueden no ser fieles)');
        if (!meta.registrado) return { id, errores: E, avisos: A, notas: N, info };
        if (meta.raizDuracion && f?.duracion && meta.raizDuracion < f.duracion - 0.011) err('estructura', `data-duration de la raiz (${meta.raizDuracion} s) es menor que la duration del storyboard (${f.duracion} s)`);
        if (meta.duracionTimeline > Dc + 0.1) avi('estructura', `el timeline dura ${r2(meta.duracionTimeline)} s, mas que el cuadro (${Dc} s): lo que pase despues no se ve`);
        const idsC = [...contenido.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
        const dup = idsC.filter((x, i) => idsC.indexOf(x) !== i);
        if (dup.length) err('estructura', `ids repetidos: ${[...new Set(dup)].join(', ')}`);
        const sinPrefijo = idsC.filter((x) => x !== 'root' && !x.startsWith(`${id}-`));
        if (sinPrefijo.length) avi('estructura', `ids sin el prefijo "${id}-" (chocan entre cuadros): ${sinPrefijo.slice(0, 6).join(', ')}${sinPrefijo.length > 6 ? '...' : ''}`);
        if (/<audio\b/i.test(contenido)) err('audio', 'hay un <audio> dentro del cuadro: el sonido se monta en index.html desde sfx_cues (mount-sfx.mjs)');
        if (/<video\b/i.test(contenido) && !/data-frame-video="approved"/.test(contenido)) err('video', 'hay un <video> sin data-frame-video="approved" (assemble-index se detiene)');
        if (scripts.some((x) => /\bsrc="https?:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\/[^"]*gsap/i.test(x[1]))) err('gsap-cdn', 'GSAP desde el CDN (403 en esta maquina): usa <script src="assets/vendor/gsap.min.js"></script> (frame.md 1)');
        const estilos = [...dentro.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((x) => sinComentarios(x[1])).join('\n');
        if (/(^|[;{\s])transition\s*:\s*(?!none\b)[^;}]+/i.test(estilos) || /transition-(property|duration|delay|timing-function)\s*:/i.test(estilos)) err('css-transition', 'transiciones CSS: no son buscables en el tiempo; anima con GSAP');
        if (/@keyframes/i.test(estilos) || /(^|[;{\s])animation(-name)?\s*:\s*(?!none\b)[^;}]+/i.test(estilos)) err('css-animation', 'animaciones CSS (@keyframes/animation): anima con GSAP');
        if (/font-weight\s*:\s*(7|8|9)00\b|font-weight\s*:\s*bold/i.test(estilos + contenido)) avi('peso', 'pesos >= 700: la v4 usa <= 600 (SINTESIS 11)');
        if (/repeat\s*:\s*-1/.test(js)) err('repeat', 'repeat: -1 (timeline infinito)');
        if (/\.animate\(|requestAnimationFrame|setInterval|setTimeout/.test(js)) avi('determinismo', 'animate()/requestAnimationFrame/setInterval/setTimeout no avanzan al buscar un instante');
        if (/Math\.random|Date\.now|new Date\(|performance\.now/.test(js)) err('determinismo', 'Math.random/Date/performance.now: el render debe ser determinista');

        // ---- (f) iconos ----
        const lu = spawnSync('node', [join(DIR_SCRIPTS, 'lucide.mjs'), '--verify', meta.fuente, '--strict'], { encoding: 'utf8' });
        const lineasLu = (lu.stdout || '').split('\n').filter(Boolean);
        const sinData = lineasLu.filter((l) => /SIN data-lucide/.test(l)), malos = lineasLu.filter((l) => /NO existe|NO coincide/.test(l));
        if (sinData.length) err('icono-no-lucide', `${sinData.length} svg 24x24 sin data-lucide (no son Lucide verificado); genera cada icono con scripts/lucide.mjs o marca los graficos con data-chart`);
        for (const l of malos) err('icono-no-lucide', l.trim());
        const cursores = [...texto.matchAll(/(data-lucide="|assets\/icons\/)((mouse-pointer|pointer|hand|cursor|grab|move)[\w-]*)/g)].map((x) => x[2]);
        if (cursores.length) err('cursor', `icono de cursor/puntero (${[...new Set(cursores)].join(', ')}): la v4 va SIN cursor (BRIEF); cuenta el toque con la UI`);
        const refs = [...new Set([...texto.matchAll(/assets\/[\w./-]+\.(?:svg|png|jpe?g|webp|gif|woff2?|ttf|mp3|mp4|js)/g)].map((x) => x[0]))];
        const faltan = refs.filter((r) => !existsSync(join(R, r)));
        if (faltan.length) err('recurso', `recursos que no existen: ${faltan.join(', ')}`);
        const cajas = await c.page.evaluate((idc) => {
            const raizEl = document.querySelector(`[data-composition-id="${idc}"]`) || document;
            const out = [];
            for (const sv of raizEl.querySelectorAll('svg')) {
                if (sv.hasAttribute('data-chart') || sv.closest('[data-chart]')) continue;
                const r = sv.getBoundingClientRect();
                out.push({ lucide: sv.getAttribute('data-lucide'), w: r.width, vb24: /^0 0 24 24$/.test(sv.getAttribute('viewBox') || '') });
            }
            return out;
        }, id);
        const chicos = cajas.filter((x) => (x.lucide || x.vb24) && x.w > 0 && x.w < 28);
        if (chicos.length) avi('icono-chico', `${chicos.length} icono(s) < 28 px en pantalla: ${[...new Set(chicos.map((x) => `${x.lucide || 'svg24'} ${Math.round(x.w)}px`))].slice(0, 6).join(', ')}`);

        // ---- trampas en la pagina: transform CSS en lo que anima GSAP; ancestros que aplanan el 3D ----
        const css = await c.page.evaluate((idc) => {
            const raizEl = document.querySelector(`[data-composition-id="${idc}"]`) || document;
            const reglas = [];
            for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (r.selectorText && r.style && (r.style.transform || r.style.translate || r.style.rotate || r.style.scale)) reglas.push({ sel: r.selectorText, tf: r.style.transform || r.style.translate || r.style.rotate || r.style.scale }); } catch (e) { /* hoja ajena */ } }
            const conTf = {};
            for (const el of raizEl.querySelectorAll('*')) {
                const r = reglas.find((x) => { try { return el.matches(x.sel); } catch (e) { return false; } });
                if (r && el.id) conTf[el.id] = r.tf;
            }
            const aplanan = [];
            for (const el of raizEl.querySelectorAll('*')) {
                if (getComputedStyle(el).transformStyle !== 'preserve-3d') continue;
                for (let p = el.parentElement; p && p !== raizEl.parentElement; p = p.parentElement) {
                    const cs = getComputedStyle(p);
                    const motivo = cs.filter !== 'none' ? `filter ${cs.filter}` : Number(cs.opacity) < 1 ? `opacity ${cs.opacity}` : cs.overflow !== 'visible' && p.id !== 'root' && p !== raizEl ? `overflow ${cs.overflow}` : null;
                    if (motivo) { aplanan.push(`${el.id || el.className} <- ${p.id || p.className}: ${motivo}`); break; }
                }
            }
            return { conTf, aplanan };
        }, id);
        for (const a of css.aplanan.slice(0, 4)) avi('3d-aplanado', `preserve-3d bajo un ancestro con ${a} (el 3D se aplana; SINTESIS 21)`);

        // ---- muestreo: barrido hacia delante a 15 fps ----
        const rapido = tiene('rapido');
        let previo = null;
        const diffs = [];
        const escala = ANCHO_M / ANCHO;
        const t0m = Date.now();
        if (!rapido) {
            for (let k = 0; k / FPS < Dc - 1e-6; k++) {
                const t = k / FPS;
                const g = pngAGris(await c.captura(t, { escala }));
                if (previo) { let s = 0; for (let i = 0; i < g.gris.length; i++) s += Math.abs(g.gris[i] - previo[i]); diffs.push([t, s / g.gris.length]); }
                previo = g.gris;
            }
        }
        info.msMuestreo = Date.now() - t0m;
        const crudo = await c.page.evaluate(recoger, id);
        const tweens = crudo.tweens.filter((t) => t.t0 < Dc + 1e-6);

        // ---- (a) movimiento ----
        if (!rapido && diffs.length) {
            const nb = Math.ceil(Dc * 10);
            const suma = new Float64Array(nb), cnt = new Float64Array(nb);
            for (const [t, e] of diffs) { const k = Math.min(Math.floor((t - 1e-6) * 10), nb - 1); suma[k] += e; cnt[k]++; }
            let nbM = nb;
            while (nbM > 1 && !cnt[nbM - 1]) nbM--;
            const e = Array.from(suma.subarray(0, nbM), (s, i) => (cnt[i] ? (FACTOR_VIDEO * s) / cnt[i] : 0));
            const tramos = [];
            for (let i = 0; i < e.length;) { if (e[i] < UMBRAL_LENTO) { let j = i; while (j < e.length && e[j] < UMBRAL_LENTO) j++; tramos.push([i / 10, j / 10]); i = j; } else i++; }
            const lentos = tramos.map(([a, b]) => ({ t0: r1(a), t1: r1(b), dur: r1(b - a), muerto: b - a >= MUERTO - 1e-9 })).filter((x) => x.dur >= MIN_TRAMO - 1e-9);
            const grande = e.filter((x) => x >= UMBRAL_GRANDE).length, quieto = e.filter((x) => x < UMBRAL_LENTO).length;
            const pct = (n) => Math.round((100 * n) / e.length);
            const primero = e.findIndex((x) => x >= UMBRAL_LENTO);
            info.movimiento = { grandePct: pct(grande), microPct: pct(e.length - grande - quieto), quietoPct: pct(quieto), primerMovimientoS: primero >= 0 ? r1(primero / 10) : null, tramosLentos: lentos, energia: e.map(r2) };
            for (const x of lentos.filter((y) => y.muerto)) {
                const finalTolerado = esFinal && x.t1 >= Dc - 0.15 && x.dur <= QUIETUD_FINAL_MAX + 1e-9;
                const txt = `tramo muerto ${x.t0.toFixed(1)}-${x.t1.toFixed(1)} s (${x.dur.toFixed(1)} s): nada se mueve lo bastante (SINTESIS 18: sin colas muertas >= 1.0 s)`;
                if (finalTolerado) avi('movimiento', `${txt}; quietud final del cuadro de cierre (tolerada hasta ${QUIETUD_FINAL_MAX} s)`); else err('movimiento', txt);
            }
            N.push(`(a) movimiento grande ${info.movimiento.grandePct} % · micro ${info.movimiento.microPct} % · quieto ${info.movimiento.quietoPct} % (objetivo ~25-30 / ~50 / ~20-25; umbral grande ${UMBRAL_GRANDE} sin calibrar)`);
            if (!entrada && primero >= 0 && primero / 10 > 0.2 + 1e-9) avi('movimiento', `el primer movimiento visible llega a ${r1(primero / 10)} s (SINTESIS 18: <= 0.2 s)`);
        }

        // ---- (b) eventos ----
        const reales = tweens.filter((t) => !t.esAncla && t.tipo !== 'call');
        const visibles = reales.map((t) => ({ t, v: esVisible(t) })).filter((x) => x.v.length);
        const hueco = pausaMasLarga(visibles.map((x) => [x.t.t0, Math.min(Dc, x.t.t0 + Math.min(x.t.d, 2.5))]), 0, Dc);
        info.eventos = { tweens: reales.length, visibles: visibles.length, pausaMaxS: hueco.dur, pausaDe: hueco.de, pausaA: hueco.a };
        if (hueco.dur >= 1.5) avi('eventos', `la pausa mas larga sin un evento visible dura ${hueco.dur} s (${hueco.de}-${hueco.a} s)`);
        const entradas = visibles.filter((x) => x.v.includes('opacity') || x.t.tieneStartAt);
        if (entradas.length >= 4) {
            const tempranas = entradas.filter((x) => x.t.t0 <= Dc * 0.25).length;
            if (tempranas / entradas.length >= 0.7) avi('diapositiva', `${tempranas} de ${entradas.length} entradas caen en el primer 25 % del cuadro (SINTESIS 18: revelado secuencial al ritmo de la voz)`);
        }

        // ---- (c) camara y pose 3D ----
        const cam = analizarCamara(tweens, ANCHO, ALTO);
        info.camara = { movimientos: cam.length, perceptibles: cam.filter((x) => x.perceptible).length, snaps: cam.filter((x) => x.snap).length };
        for (const x of cam.filter((y) => !y.perceptible && y.t1 > Dc / 2)) avi('deriva', `deriva lenta de camara en ${x.id} ${x.t0}-${x.t1} s (pico ${x.picoPctS} %/s) en la segunda mitad: SINTESIS 18 pide quietud o vibracion finita, no deriva`);
        const rotMal = [];
        for (const tw of tweens) {
            for (const [k, lim] of [['rotationX', ROT_X_MAX], ['rotationY', ROT_Y_MAX]]) {
                for (const v of [tw.valores[k], tw.desde[k]]) if (typeof v === 'number' && Math.abs(v) > lim + 1e-9) rotMal.push(`${tw.objetivos[0]?.key ?? '?'} ${k} ${v} @${r2(tw.t0)} s (tope ${lim})`);
            }
            for (const k of ['rotation', 'rotationZ', 'rotate']) {
                const v = [tw.valores[k], tw.desde[k]].find((x) => x !== undefined && Number(x) !== 0);
                if (v === undefined) continue;
                const o = tw.objetivos[0];
                const grande = o && (CAM_ID.test(o.id || '') || o.camara || o.area >= 0.2 * ANCHO * ALTO);
                (grande ? err : avi)('giro-plano', `${o?.key ?? '?'} gira en el plano (${k} ${v}) @${r2(tw.t0)} s: SINTESIS 14 prohibe rotationZ en camara y tarjetas`);
            }
        }
        for (const x of [...new Set(rotMal)]) err('pose-3d', `inclinacion fuera de tope: ${x} (|rotationX| <= 8, |rotationY| <= 10)`);
        const revisarPlano = async (t, motivo) => {
            await c.ir(t);
            const p = (await c.page.evaluate(poses, id)).filter((x) => Math.abs(x.rx) > PLANO || Math.abs(x.ry) > PLANO);
            if (p.length) err('pose-plana', `no esta plano ${motivo} (t=${r2(t)} s): ${p.slice(0, 3).map((x) => `${x.id} rotX ${r2(x.rx)} rotY ${r2(x.ry)}`).join('; ')} (SINTESIS 14)`);
        };
        await revisarPlano(Math.max(0, Dc - 1 / 30), 'en el ultimo fotograma (borde de cuadro / handoff)');
        if (!entrada && idx > 0) await revisarPlano(0, 'en el primer fotograma tras un corte (handoff)');

        // ---- (d) sonido: sfx_cues del storyboard contra los tweens del cuadro ----
        const sonido = [];
        if (f?.sfxCuesCrudo != null) {
            const { cues, errores: eSint } = parseSfxCues(f.sfxCuesCrudo);
            for (const e of eSint) err('sfx-sintaxis', e);
            for (const q of cues) {
                const r = cat ? resolverSonido(cat, q.nombre) : { entrada: null };
                if (r.error) { err('sfx-nombre', `${q.texto}: ${r.error}`); continue; }
                const categoria = r.entrada?.categoria ?? '';
                if (q.t > Dc + 1e-9) { err('sfx-fuera', `${q.texto}: pasa de la duracion del cuadro (${Dc} s)`); continue; }
                const utiles = reales.filter((t) => t.props.length || t.vars.length);
                let ok, como;
                if (categoria === 'whoosh') {
                    ok = utiles.some((t) => q.t >= t.t0 - 0.066 && q.t <= t.t0 + t.d + 0.066 && t.d > 0) || q.t <= entrada + 0.066;
                    como = 'sobre un movimiento';
                } else if (categoria === 'tick' || categoria === 'key') {
                    ok = utiles.some((t) => q.t >= t.t0 - TOL && q.t <= t.t0 + t.d + TOL);
                    como = 'dentro de un tween';
                } else {
                    ok = utiles.some((t) => Math.abs(t.t0 - q.t) <= TOL || Math.abs(t.t0 + t.d - q.t) <= TOL) || (idx > 0 && !entrada && q.t <= TOL);
                    como = 'en el inicio o final de un tween';
                }
                sonido.push({ cue: q.texto, ok });
                if (!ok) {
                    const cerca = utiles.flatMap((t) => [t.t0, t.t0 + t.d]).reduce((m, x) => (Math.abs(x - q.t) < Math.abs(m - q.t) ? x : m), Infinity);
                    err('sfx-huerfano', `"${q.texto}" no cae ${como} (${Number.isFinite(cerca) ? `el mas cercano: ${r3(cerca)} s, ${Math.round((q.t - cerca) * 1000)} ms` : 'sin tweens'}); corrige sfx_cues o el cuadro`);
                }
            }
        } else if (f) avi('sfx', 'el Frame no tiene "- sfx_cues:" (escribe "none" si es a proposito)');
        const etiqSfx = crudo.etiquetas.filter((e) => e.nombre.startsWith('sfx:'));
        if (etiqSfx.length) avi('sfx-etiquetas', `${etiqSfx.length} etiquetas sfx: en el timeline (contrato de la v3): en la v4 el sonido se declara en sfx_cues de STORYBOARD.md`);
        info.sonido = { cues: sonido.length, huerfanos: sonido.filter((x) => !x.ok).length };

        // ---- (e) lectura y anclas de voz ----
        const lecturas = crudo.etiquetas.filter((e) => e.nombre.startsWith('read:'));
        for (const l of lecturas) {
            const frase = l.nombre.slice(5).replace(/#\d+$/, '');
            const resto = r3(Dc - l.t);
            if (resto < LECTURA - 1e-9) err('lectura', `"${frase}" queda completa en ${r3(l.t)} s y el cuadro acaba en ${Dc} s: ${resto} s de lectura (minimo ${LECTURA} s)`);
            await revisarPlano(l.t, `en la lectura "${frase}"`);
        }
        info.lectura = lecturas.length;
        for (const a of (f?.voAnchorCrudo ?? '').split(/[;·]/).map((x) => /@\s*(\d+(?:\.\d+)?)/.exec(x)?.[1]).filter(Boolean).map(Number)) {
            if (a < entrada - 1e-9) avi('voz', `vo_anchor a ${a} s cae dentro de la transicion entrante (${entrada} s): SINTESIS 4`);
        }

        // ---- (g) trampas dinamicas ----
        const grupos = new Map();
        for (const tw of tweens) {
            if (!tw.tieneStartAt || tw.inmediato === false) continue;
            const props = new Set([...tw.vars, ...tw.claveDesde].map(normalizaProp));
            for (const o of tw.objetivos) if (o.html) for (const p of props) { const k = `${o.key}|${p}`; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(tw); }
        }
        const repetidos = [...grupos.entries()].filter(([, g]) => g.length >= 2).map(([k, g]) => `${k.replace(`${id}-`, '').replace('|', '.')} (${g.map((x) => r2(x.t0)).join(', ')} s)`);
        if (repetidos.length) err('fromTo-repetido', `${repetidos.length} propiedad(es) con fromTo repetido sin immediateRender:false (el "desde" del ultimo se aplica al crear el timeline): ${repetidos.slice(0, 5).join('; ')}`);
        for (const tw of tweens) if (tw.repeat === -1) err('repeat', `tween con repeat:-1 en ${r2(tw.t0)} s`);
        const choque = new Map();
        for (const tw of tweens) for (const o of tw.objetivos) {
            if (!o.html || !o.id || !css.conTf[o.id]) continue;
            const ps = [...tw.vars, ...tw.claveDesde].filter((p) => TRANSFORMS.has(p));
            if (ps.length) choque.set(o.id, { tf: css.conTf[o.id], ps: [...new Set([...(choque.get(o.id)?.ps ?? []), ...ps])] });
        }
        for (const [k, v] of choque) err('transform-css', `${k} tiene transform en el CSS (${String(v.tf).slice(0, 40)}) y GSAP anima ${v.ps.join('/')}: quita el transform del CSS (centra con inset/flex o xPercent/yPercent)`);
        for (const tw of tweens) {
            const blur = [tw.valores.filter, tw.desde.filter].map((x) => /blur\(\s*([\d.]+)px/.exec(String(x ?? ''))?.[1]).filter(Boolean).map(Number);
            if (blur.some((b) => b > 24)) avi('blur', `${tw.objetivos[0]?.key ?? '?'} anima un blur de ${Math.max(...blur)} px @${r2(tw.t0)} s (> 24 px, SINTESIS 21: usa una placa pre-desenfocada)`);
        }
        const sobre = tweens.filter((t) => SOBREIMPULSO.test(t.ease));
        info.sobreimpulsos = sobre.length;
        if (sobre.length) N.push(`(g) ${sobre.length} sobreimpulso(s) (${[...new Set(sobre.map((t) => t.ease))].join(', ')}): SINTESIS 18 admite como mucho 2 en todo el video`);
        if (!esFinal) {
            for (const tw of tweens) {
                if (tw.t0 + tw.d < Dc - 0.5 || tw.t0 < Dc - 1.2) continue;
                const op = tw.props.find((p) => p.p === 'opacity' && p.s !== null && p.c !== null && p.s + p.c <= 0.05 && p.c < -0.3);
                if (!op) continue;
                const o = tw.objetivos.find((x) => x.key === op.t);
                if (!o || !o.html) continue;
                if (o.area >= EXIT_AREA_MIN * ANCHO * ALTO || o.id === 'root' || CAM_ID.test(o.id || '')) err('exit', `salida (opacity -> 0) de ${o.key} en ${r2(tw.t0)}-${r2(tw.t0 + tw.d)} s en un cuadro que no es el final: la transicion es la salida`);
            }
        }
        info.tweens = tweens.length;
    } catch (e) {
        E.push({ cod: 'excepcion', msg: e.stack || String(e) });
    } finally {
        await c.cerrar();
    }
    return { id, errores: E, avisos: A, notas: N, info };
}

// ---------- salida ----------
const host = await crearHost(R);
const informes = [];
try { for (const id of ids) informes.push(await revisar(host, id)); } finally { await host.cerrar(); }
const totalSobre = informes.reduce((s, r) => s + (r.info.sobreimpulsos ?? 0), 0);
if (tiene('todos') && totalSobre > 2) informes.push({ id: '(video)', errores: [{ cod: 'sobreimpulsos', msg: `${totalSobre} sobreimpulsos back/elastic/bounce en el video (SINTESIS 18: maximo 2)` }], avisos: [], notas: [], info: {} });
const hayError = informes.some((i) => i.errores.length);
if (tiene('json')) console.log(JSON.stringify(informes, null, 1));
else {
    for (const r of informes) {
        const i = r.info;
        console.log(`\n== ${r.id}  duracion ${i.duracion ?? '?'} s${i.entrada ? `, entrada ${i.entrada} s bajo la transicion` : ''}${i.final ? ' (cuadro final)' : ''}  [${r.errores.length} error(es), ${r.avisos.length} aviso(s)]`);
        for (const n of r.notas) console.log(`  ${n}`);
        if (i.movimiento) console.log(`  (a) primer movimiento ${i.movimiento.primerMovimientoS ?? '-'} s; tramos lentos: ${i.movimiento.tramosLentos.map((x) => `${x.t0.toFixed(1)}-${x.t1.toFixed(1)}${x.muerto ? '*' : ''}`).join(' ') || 'ninguno'}`);
        if (i.eventos) console.log(`  (b) eventos: ${i.eventos.tweens} tweens, ${i.eventos.visibles} visibles; pausa mas larga sin evento visible ${i.eventos.pausaMaxS} s (${i.eventos.pausaDe}-${i.eventos.pausaA} s)`);
        if (i.camara) console.log(`  (c) camara: ${i.camara.movimientos} tween(s), ${i.camara.perceptibles} perceptible(s), ${i.camara.snaps} snap(s)`);
        if (i.sonido) console.log(`  (d) sonido: ${i.sonido.cues} cue(s) de sfx_cues, ${i.sonido.huerfanos} huerfano(s)`);
        if (i.lectura != null) console.log(`  (e) lectura: ${i.lectura} marca(s) read:`);
        for (const e of r.errores) console.log(`  ERROR [${e.cod}] ${e.msg}`);
        for (const a of r.avisos) console.log(`  AVISO [${a.cod}] ${a.msg}`);
        if (!r.errores.length && !r.avisos.length) console.log('  OK sin hallazgos');
    }
    console.log(`\n${informes.length} cuadro(s): ${informes.reduce((s, r) => s + r.errores.length, 0)} error(es), ${informes.reduce((s, r) => s + r.avisos.length, 0)} aviso(s)${hayError ? '  -> FALLA' : '  -> ok'}`);
}
process.exit(hayError ? 1 : 0);
