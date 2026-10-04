#!/usr/bin/env node
// frame-check.mjs - el "medidor" de un cuadro: itera sin renderizar el video completo.
//
// Uso:
//   node scripts/frame-check.mjs <frame_id>... [--json] [--duration N] [--out-overlap N] [--plan v2/plan.json] [--final] [--no-plan]
//
//   --json           salida JSON (un arreglo con un informe por cuadro) en vez del texto legible
//   --duration N     duracion del cuadro en s (si no, la del plan; si no hay plan, el data-duration de la raiz del cuadro)
//   --out-overlap N  solape de la transicion de salida (s); el final util del cuadro es duracion - N (si no, se lee del plan)
//   --plan RUTA      plan v2 (por omision v2/plan.json si existe; v2/plan.stub.json NO se lee solo)
//   --no-plan        ignora el plan aunque exista
//   --final          trata el cuadro como el ultimo del video (le permite una salida/fundido final)
//   --dir DIR        carpeta de los cuadros (por omision compositions/frames; sirve para borradores fuera del proyecto)
//   --rapido         salta el muestreo de pixeles (a): solo chequeos de timeline y fuente (para iterar muy deprisa)
//   Codigo de salida: 1 si algun cuadro tiene ERRORES; los AVISOS no fallan. 2 si el uso es incorrecto.
//
// Que mide y como leerlo
//   El medidor aloja UN cuadro aislado (scripts/lib/frame-host.mjs: Chrome headless, GSAP local, el cuadro dentro de #__escena a
//   1920x1080) y barre su timeline a 15 fps. Por eso NO ve las transiciones de index.html (el solape de entrada/salida entre cuadros
//   lo pone build-index.mjs): un cuadro que parece "vacio" al principio o al final puede estar cubierto por la transicion. Las
//   decisiones de tiempo (duracion, solape de salida, final util = duracion - solape) salen de v2/plan.json.
//   Calibracion de la energia (a): la captura cruda ve cambios subpixel que el codificador h264 suaviza, asi que la energia se
//   multiplica por FACTOR_VIDEO = 0.8 (calibrado contra renders/video.mp4: 94 % -> 96 % de acuerdo en "lento/no lento" por cada 0.1 s,
//   correlacion log 0.97). Umbrales: lento < 0.30, muerto >= 1.0 s.
//   Muestreo: t = 0, 1/15, ... mientras t < D (el ultimo cae a D - 1/15 si D es multiplo de 1/15). El fotograma t = D NO se muestrea:
//   cae fuera de la ventana del #root (el host lo oculta) y metia una energia espuria (2.6-9) en el ultimo intervalo de 0.1 s; un
//   ultimo intervalo de 0.1 s sin ninguna muestra no se cuenta (ni como lento ni como energia 0).
//   LIMITE de la metrica de energia: mide cambio de pixeles en gris. Un cuadro cuyo unico movimiento son cursores, anillos finos,
//   halos o trazos delgados sale "lento" (energia < 0.30) aunque tenga eventos GSAP cada 0.3 s; no es un fallo del cuadro, es que
//   esos eventos mueven pocos pixeles. Lee (a) junto con (b): si (b) cuenta eventos visibles y (a) dice lento, mira el cuadro.
//
// Chequeos:
//   (a) movimiento: energia por 0.1 s (muestreo del timeline a 15 fps, capturas 480x270 en gris; misma metrica y umbrales que
//       audit/ritmo/motion.py: lento < 0.30, muerto >= 1.0 s). Un tramo muerto (>= 1.0 s) es ERROR salvo la espera de lectura final (<= 1.5 s).
//   (b) eventos GSAP/s y la pausa mas larga sin un evento VISIBLE (cambio de magnitud perceptible y no una deriva). El tecleo es UN
//       tween lineal sobre un objeto JS (no cuenta por si solo): cada etiqueta sfx:key-* cuenta como un evento visible (cada tecla pinta
//       un caracter) y tapa la pausa de su instante.
//   (c) camara: tweens de escala/posicion/rotacion sobre el contenedor world/cam/stage/... con velocidad en %/s; avisa de derivas < 3 %/s,
//       cuenta los snaps (>= 6 % en <= 0.25 s) y la pausa mas larga sin movimiento de camara perceptible.
//   (d) sonido: etiquetas 'sfx:<nombre>@<vol>#<n>' (n unico por cuadro). Tres criterios de anclaje (los mismos que verify-sfx.mjs):
//         - normales: a <= 33.3 ms del INICIO de un tween;
//         - 'ventana' = ticks de contador (tick-N, sfxCount) y teclas (key-*, sfxType): caen dentro de un tween (el contador / el reloj
//           del tecleo), no en su inicio; valen si su instante esta en [inicio, fin] de ALGUN tween del cuadro (tolerancia 33.3 ms);
//           ERROR solo si no hay ningun tween activo en ese instante;
//         - whoosh: exentos del anclaje (marcan el punto de maxima velocidad); si no hay ningun tween activo es solo un AVISO.
//   (e) lectura: cada etiqueta 'read:<frase>' queda a >= min_lectura del plan (0.5 s si el plan no la marca) del final util del cuadro
//       (duracion - solape de salida). readMark() escribe 'read:<frase>#<n>' (el '#<n>' hace unica la etiqueta): se quita antes de
//       comparar la frase con la del plan (igual que extract-events.mjs).
//   (f) iconos: scripts/lucide.mjs --verify --strict (todo icono es Lucide real con data-lucide; los graficos llevan data-chart),
//       cajas < 28 px, avatares solo de assets/avatars.
//   (g) trampas: fromTo repetido sobre el mismo objetivo/propiedad sin immediateRender:false, repeat:-1, transiciones/animaciones CSS,
//       'exit' en cuadro no final (solo opacity -> 0 sobre #root, el contenedor world/cam o un elemento que cubra >= 80 % del lienzo;
//       los cursores, halos y carets decorativos que se apagan al final NO cuentan), transform CSS sobre elementos con transform GSAP, <audio> dentro del cuadro, estructura
//       <template>/id/registro del timeline, ids sin prefijo del cuadro.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearHost } from './lib/frame-host.mjs';
import { pngAGris } from './lib/png.mjs';
import { cargarPlan, linea } from './lib/plan.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const VAL = new Set(['--duration', '--out-overlap', '--plan', '--dir']);
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const tiene = (n) => args.includes(`--${n}`);
const ids = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VAL.has(args[i - 1])));
if (!ids.length || tiene('help')) {
    console.error('Uso: node scripts/frame-check.mjs <frame_id>... [--json] [--duration N] [--out-overlap N] [--plan v2/plan.json] [--final] [--no-plan] [--rapido] [--dir DIR]');
    process.exit(ids.length ? 0 : 2);
}

// ---------- parametros de la metrica (los de audit/ritmo/motion.py) ----------
const FPS = 15;
const ANCHO_M = 480, ALTO_M = 270;
const UMBRAL_LENTO = 0.30;
// La captura cruda ve cambios minimos (subpixel) que el codificador h264 del video suaviza: calibrado contra renders/video.mp4
// (12 cuadros, 94 % -> 96 % de acuerdo en 'lento/no lento' por 0.1 s, correlacion log 0.97) la energia cruda se multiplica por 0.8.
const FACTOR_VIDEO = 0.8;
const MIN_TRAMO = 0.6;       // un tramo lento se lista desde 0.6 s
const MUERTO = 1.0;          // tramo muerto
const ESPERA_FINAL_MAX = 1.5; // espera de lectura final tolerada
const DERIVA_PCT_S = 3;      // < 3 %/s = camara imperceptible
const SNAP_PCT = 6, SNAP_DUR = 0.25;
const TOL_SFX = 1 / 30 + 1e-4;
const SFX_WHOOSH = /whoosh/i;
// sonidos 'de ventana': suenan DENTRO de un tween (tick de contador, tecla de tecleo), no en su inicio
const SFX_VENTANA = /^(tick-|key-|tecl|typing|type-)/i;
const EXIT_AREA_MIN = 0.8;   // [exit]: solo cuentan elementos que cubren >= 80 % del lienzo (ademas de #root y la camara)
const CAM_ID = /(^|-)(world|cam|camera|camara|cam-outer|cam-inner|camin|stage|drift|lockup|dolly|orbit)$/i;
const TRANSFORMS = new Set(['x', 'y', 'z', 'xPercent', 'yPercent', 'scale', 'scaleX', 'scaleY', 'rotation', 'rotationX', 'rotationY', 'rotationZ', 'skewX', 'skewY']);
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;

// ---------- plan ----------
let plan = null, lin = null;
if (!tiene('no-plan')) {
    const rutaPlan = flag('plan') ? resolve(flag('plan')) : join(RAIZ, 'v2/plan.json');
    if (flag('plan') || existsSync(rutaPlan)) {
        try { plan = cargarPlan(rutaPlan); lin = linea(plan); } catch (e) { console.error(`Plan ilegible: ${e.message}`); process.exit(2); }
    }
}

// ---------- recoleccion de tweens dentro de la pagina ----------
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
        return { key: clave(el), id: el.id || null, html: true, area: w * h, w, h, camara: el.hasAttribute('data-camera'), csstf: el.getAttribute('data-hf-csstf') };
    };
    const pendiente = (ease) => { // pendiente maxima (derivada) de la curva de ease
        if (!ease || typeof ease !== 'function') return 1;
        let max = 0, prev = ease(0);
        for (let i = 1; i <= 240; i++) { const v = ease(i / 240); max = Math.max(max, (v - prev) * 240); prev = v; }
        return max || 1;
    };
    const salida = [];
    const hijos = tl.getChildren(true, true, false);
    for (const tw of hijos) {
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
        const desde = v.startAt ? Object.keys(v.startAt).filter((k) => !CTRL.has(k)) : [];
        salida.push({
            t0, d: tw.duration(), tipo: typeof tw.targets !== 'function' ? 'call' : v.startAt ? 'fromTo' : v.runBackwards ? 'from' : tw.duration() === 0 ? 'set' : 'to',
            ease: typeof v.ease === 'string' ? v.ease : (v.ease && v.ease.name) || 'power1.out', pend: pendiente(tw._ease),
            inmediato: v.immediateRender, tieneStartAt: !!v.startAt || !!v.runBackwards, repeat: v.repeat ?? 0,
            objetivos, props, vars: claves2, desde, esAncla: objetivos.length === 1 && !objetivos[0].html && claves2.length === 0 && typeof tw.targets === 'function',
            fin: v.startAt ? null : null,
        });
    }
    const etiquetas = Object.keys(tl.labels || {}).map((k) => ({ nombre: k, t: tl.labels[k] }));
    return { tweens: salida, etiquetas };
}

// ---------- utilidades de analisis ----------
function normalizaProp(p) { return p === 'scaleX' || p === 'scaleY' ? 'scale' : p; }

function esVisible(tw) {
    // Devuelve la lista de propiedades "visibles" del tween: magnitud perceptible y no una deriva.
    if (tw.esAncla) return [];
    if (tw.tipo === 'call') return [];
    const d = Math.max(tw.d, 1e-3);
    const visibles = [];
    for (const pr of tw.props) {
        const p = pr.p;
        const c = pr.c;
        if (c === null || pr.s === null) { if (!['transform', 'css'].includes(p)) visibles.push(p); continue; }
        const m = Math.abs(c);
        const rate = m / d;
        let ok;
        if (p === 'opacity' || p === 'autoAlpha') ok = m >= 0.15 && rate >= 0.15;
        else if (p === 'x' || p === 'y' || p === 'z') ok = m >= 16 && rate >= 10;
        else if (p === 'xPercent' || p === 'yPercent') ok = m >= 2 && rate >= 5;
        else if (p === 'scaleX' || p === 'scaleY' || p === 'scale') ok = m >= 0.04 && rate >= 0.02;
        else if (/^rotation/.test(p) || /^skew/.test(p)) ok = m >= 2 && rate >= 2;
        else if (p === 'strokeDashoffset' || p === 'strokeDasharray') ok = m > 0.02;
        else if (p === 'innerText' || p === 'textContent' || p === 'innerHTML') ok = m > 0;
        else if (p === 'width' || p === 'height' || p === 'top' || p === 'left' || p === 'right' || p === 'bottom') ok = m >= 16 && rate >= 10;
        else ok = m > 1e-6;
        if (ok) visibles.push(p);
    }
    // Propiedades sin valores numericos resueltos (colores, filtros, clip-path, objetos JS con reloj): visibles si no hay mas informacion.
    if (!tw.props.length && tw.vars.length) visibles.push(...tw.vars);
    return [...new Set(visibles)];
}

function analizarCamara(tweens) {
    const mov = [];
    for (const tw of tweens) {
        const camaras = tw.objetivos.filter((o) => o.html && (CAM_ID.test(o.id || '') || o.camara));
        if (!camaras.length) continue;
        const porProp = {};
        for (const pr of tw.props) {
            if (!camaras.some((o) => o.key === pr.t) || pr.c === null) continue;
            const p = normalizaProp(pr.p);
            if (!TRANSFORMS.has(p) && !['scale'].includes(p)) continue;
            let pct;
            if (p === 'scale') pct = Math.abs(pr.c) * 100;
            else if (p === 'x') pct = (Math.abs(pr.c) / 1920) * 100;
            else if (p === 'y') pct = (Math.abs(pr.c) / 1080) * 100;
            else if (p === 'xPercent' || p === 'yPercent') pct = Math.abs(pr.c);
            else if (/^rotation/.test(p)) pct = Math.abs(pr.c) * 2; // 1 grado ~ 2 % del borde
            else continue;
            if (!porProp[p] || pct > porProp[p].pct) porProp[p] = { pct, c: pr.c, s: pr.s };
        }
        const props = Object.keys(porProp);
        if (!props.length) continue;
        const d = Math.max(tw.d, 1e-3);
        let pico = 0, media = 0, delta = 0;
        for (const p of props) { pico = Math.max(pico, (porProp[p].pct * tw.pend) / d); media = Math.max(media, porProp[p].pct / d); delta = Math.max(delta, porProp[p].pct); }
        mov.push({
            id: camaras.map((o) => o.id).join('+'), t0: r3(tw.t0), t1: r3(tw.t0 + tw.d), dur: r3(tw.d), ease: tw.ease,
            props: Object.fromEntries(props.map((p) => [p, { de: r3(porProp[p].s), delta: r3(porProp[p].c) }])),
            deltaPct: r1(delta), mediaPctS: r1(media), picoPctS: r1(pico), perceptible: pico >= DERIVA_PCT_S && delta >= 1,
            snap: delta >= SNAP_PCT && d <= SNAP_DUR + 1e-6,
        });
    }
    mov.sort((a, b) => a.t0 - b.t0);
    return mov;
}

function pausaMasLarga(intervalos, ini, fin) {
    const ord = [...intervalos].sort((a, b) => a[0] - b[0]);
    let cursor = ini, mejor = { dur: 0, de: ini, a: ini };
    for (const [a, b] of ord) {
        if (a > cursor && a - cursor > mejor.dur) mejor = { dur: a - cursor, de: cursor, a };
        cursor = Math.max(cursor, b);
    }
    if (fin > cursor && fin - cursor > mejor.dur) mejor = { dur: fin - cursor, de: cursor, a: fin };
    return { dur: r2(mejor.dur), de: r2(mejor.de), a: r2(mejor.a) };
}

function texto_(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ''); }

// ---------- revision de un cuadro ----------
async function revisar(host, id) {
    const E = [], A = [];
    const err = (cod, msg) => E.push({ cod, msg });
    const avi = (cod, msg) => A.push({ cod, msg });
    const info = { id };
    const cp = lin?.cuadros.find((c) => c.id === id) ?? null;
    let c;
    try { c = await host.abrir(id, { archivo: flag('dir') ? join(resolve(flag('dir')), `${id}.html`) : undefined }); } catch (e) { return { id, errores: [{ cod: 'carga', msg: e.message }], avisos: [], info }; }
    try {
        const { texto, meta, troceado } = c;

        // ---- (g) estructura ----
        if (!troceado.tieneTemplate) err('estructura', 'el archivo no esta envuelto en <template>...</template>');
        if (/<(html|head|body)\b/i.test(troceado.original)) err('estructura', 'el cuadro no debe llevar <html>/<head>/<body> (solo <template>)');
        if (!new RegExp(`data-composition-id="${id}"`).test(texto)) err('estructura', `falta un elemento raiz con data-composition-id="${id}"`);
        if (!/data-width="1920"/.test(texto) || !/data-height="1080"/.test(texto)) avi('estructura', 'la raiz deberia declarar data-width="1920" y data-height="1080"');
        if (!new RegExp(`__timelines\\[\\s*['"]${id}['"]\\s*\\]`).test(texto)) err('estructura', `el script no registra window.__timelines["${id}"]`);
        if (!meta.registrado) { err('estructura', `window.__timelines["${id}"] no existe al terminar de cargar (claves: ${meta.claves.join(', ') || 'ninguna'})`); }
        else if (!meta.pausado) err('estructura', 'el timeline del cuadro debe crearse con { paused: true }');
        if (meta.raizDuracion == null) err('estructura', 'la raiz del cuadro no tiene data-duration');
        for (const e of c.errores) err('carga', e);
        if (!meta.registrado) return { id, errores: E, avisos: A, info };

        // duraciones
        const D = flag('duration') ? Number(flag('duration')) : cp ? cp.duracion : meta.raizDuracion ?? meta.duracionTimeline;
        const solapeSalida = flag('out-overlap') ? Number(flag('out-overlap')) : cp ? cp.solapeSalida : 0;
        const esFinal = tiene('final') || (cp ? cp.esFinal : false);
        const utilFin = r3(D - solapeSalida);
        info.duracion = D; info.solapeSalida = solapeSalida; info.utilFin = utilFin; info.final = esFinal; info.timeline = r2(meta.duracionTimeline);
        if (cp && meta.raizDuracion != null && Math.abs(meta.raizDuracion - cp.duracion) > 0.011) err('estructura', `data-duration de la raiz (${meta.raizDuracion} s) no coincide con la duracion del plan (${cp.duracion} s)`);
        if (meta.duracionTimeline > D + 0.1) avi('estructura', `el timeline dura ${r2(meta.duracionTimeline)} s, mas que el cuadro (${D} s): lo que pase despues no se ve`);
        if (meta.duracionTimeline < utilFin - 1.5) avi('estructura', `el timeline termina en ${r2(meta.duracionTimeline)} s y el final util es ${utilFin} s: ${r1(utilFin - meta.duracionTimeline)} s finales sin ninguna animacion`);
        const ids_ = [...troceado.contenido.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
        const dup = ids_.filter((x, i) => ids_.indexOf(x) !== i);
        if (dup.length) err('estructura', `ids repetidos dentro del cuadro: ${[...new Set(dup)].join(', ')}`);
        const sinPrefijo = ids_.filter((x) => x !== 'root' && !x.startsWith(`${id}-`));
        if (sinPrefijo.length) avi('estructura', `ids sin el prefijo "${id}-" (chocan entre cuadros porque todos viven en el mismo documento): ${sinPrefijo.slice(0, 6).join(', ')}${sinPrefijo.length > 6 ? '...' : ''}`);

        // ---- (g) trampas de fuente ----
        if (/<audio\b/i.test(troceado.contenido)) err('audio', 'hay un <audio> dentro del cuadro: el sonido se monta solo en index.html (scripts/mount-sfx.mjs)');
        if (/<video\b/i.test(troceado.contenido)) avi('video', 'hay un <video> dentro del cuadro: debe ser determinista y estar muteado');
        const estilos = [...troceado.contenido.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => texto_(m[1])).join('\n');
        if (/(^|[;{\s])transition\s*:\s*(?!none\b)[^;}]+/i.test(estilos) || /transition-(property|duration|delay|timing-function)\s*:/i.test(estilos)) err('css-transition', 'transiciones CSS (transition): no son buscables en el tiempo; anima con GSAP');
        if (/@keyframes/i.test(estilos) || /(^|[;{\s])animation(-name)?\s*:\s*(?!none\b)[^;}]+/i.test(estilos)) err('css-animation', 'animaciones CSS (@keyframes/animation): no son buscables en el tiempo; anima con GSAP');
        if (/\sstyle="[^"]*transition\s*:/i.test(troceado.contenido)) err('css-transition', 'transition en un atributo style');
        const js = troceado.scripts.join('\n');
        if (/repeat\s*:\s*-1/.test(js)) err('repeat', 'repeat: -1 en el script (el timeline se vuelve infinito; usa un numero finito de repeticiones)');
        if (/\.animate\(|requestAnimationFrame|setInterval|setTimeout/.test(js)) avi('determinismo', 'el script usa animate()/requestAnimationFrame/setInterval/setTimeout: no avanzan al buscar un instante');
        if (/Math\.random|Date\.now|new Date\(/.test(js)) avi('determinismo', 'el script usa Math.random/Date: el render debe ser determinista');

        // ---- (f) iconos y avatares ----
        const lu = spawnSync('node', [join(RAIZ, 'scripts/lucide.mjs'), '--verify', c.ruta, '--strict'], { encoding: 'utf8' });
        const lineasLu = (lu.stdout || '').split('\n').filter(Boolean);
        info.iconos = { lucideSalida: lineasLu.at(-1) ?? '' };
        const sinData = lineasLu.filter((l) => /SIN data-lucide/.test(l));
        const malos = lineasLu.filter((l) => /NO existe|NO coincide/.test(l));
        if (sinData.length) err('icono-no-lucide', `${sinData.length} svg 24x24 sin data-lucide (no son Lucide verificado): ${sinData.slice(0, 3).map((l) => l.split(/\s{2}/)[0]).join(', ')}${sinData.length > 3 ? '...' : ''}. Genera cada icono con scripts/lucide.mjs <nombre> o marca los graficos con data-chart`);
        for (const l of malos) err('icono-no-lucide', l.trim());
        if (lu.status && !sinData.length && !malos.length && lu.status !== 1) err('icono', `lucide.mjs --verify fallo: ${(lu.stderr || '').trim()}`);
        const cajas = await c.page.evaluate(() => {
            const out = [];
            for (const sv of document.querySelectorAll('#__escena svg')) {
                if (sv.hasAttribute('data-chart') || sv.closest('[data-chart]')) continue;
                const cs = getComputedStyle(sv);
                let w = parseFloat(cs.width), h = parseFloat(cs.height);
                if (!(w > 0)) w = parseFloat(sv.getAttribute('width')) || 0;
                if (!(h > 0)) h = parseFloat(sv.getAttribute('height')) || 0;
                const vb = sv.getAttribute('viewBox') || '';
                out.push({ lucide: sv.getAttribute('data-lucide'), id: sv.id || (sv.parentElement && sv.parentElement.id) || '', w, h, vb24: /^0 0 24 24$/.test(vb) });
            }
            return out;
        });
        const chicos = cajas.filter((x) => (x.lucide || x.vb24) && x.w > 0 && x.w < 28);
        if (chicos.length) avi('icono-chico', `${chicos.length} icono(s) con caja < 28 px (poco legibles a 1080p): ${[...new Set(chicos.map((x) => `${x.lucide || 'svg24'} ${Math.round(x.w)}px`))].slice(0, 6).join(', ')}`);
        const sinMarcar = cajas.filter((x) => !x.lucide && !x.vb24 && x.w > 0 && x.w < 48);
        if (sinMarcar.length) avi('svg-chico', `${sinMarcar.length} svg pequeno(s) sin data-lucide ni data-chart: si es un icono, usa Lucide; si es un grafico, marca data-chart (${sinMarcar.slice(0, 3).map((x) => x.id || '?').join(', ')})`);
        info.iconos.n = cajas.filter((x) => x.lucide).length;
        info.iconos.sinLucide24 = sinData.length;
        // recursos
        const refs = [...new Set([...texto.matchAll(/assets\/[\w./-]+\.(?:svg|png|jpe?g|webp|gif|woff2?|ttf|mp3|mp4)/g)].map((m) => m[0]))];
        const faltan = refs.filter((r) => !existsSync(join(RAIZ, r)));
        if (faltan.length) err('recurso', `recursos que no existen: ${faltan.join(', ')}`);
        const refAvatar = refs.filter((r) => r.startsWith('assets/avatars/'));
        const hayAvatarSinImagen = /class="[^"]*avatar[^"]*"/i.test(troceado.contenido) && !refAvatar.length && !/data:image/.test(troceado.contenido);
        if (hayAvatarSinImagen) avi('avatar', 'hay elementos "avatar" que no usan archivos de assets/avatars (usa los 24 avatares CC0 del proyecto)');
        info.avatares = refAvatar;
        for (const x of troceado.contenido.matchAll(/(?:src|href)="((?:https?:)?\/\/[^"]+)"/g)) avi('recurso-externo', `recurso externo (no determinista, sin red en el render): ${x[1].slice(0, 80)}`);

        // ---- estado inicial (antes de buscar ningun instante): lo que ven los primeros fotogramas del render ----
        const inicial = await c.page.evaluate((idc) => {
            const tl = window.__timelines[idc];
            const CTRL = new Set(['ease', 'duration', 'delay', 'stagger', 'startAt', 'onComplete', 'onStart', 'onUpdate', 'overwrite', 'immediateRender', 'lazy', 'data', 'id', 'paused', 'repeat', 'yoyo', 'repeatDelay', 'runBackwards', 'keyframes', 'parent', 'snap']);
            const norm = (p) => (p === 'scaleX' || p === 'scaleY' ? 'scale' : p);
            const out = [], vistos = new Set();
            const ordenados = tl.getChildren(true, true, false).filter((t) => t.vars && t.vars.startAt && t.vars.immediateRender !== false).sort((a, b) => a.startTime() - b.startTime());
            for (const tw of ordenados) {
                const props = new Set([...Object.keys(tw.vars), ...Object.keys(tw.vars.startAt)].filter((k) => !CTRL.has(k)).map(norm));
                for (const el of tw.targets()) {
                    if (!el || el.nodeType !== 1 || !el.id) continue;
                    for (const p of props) {
                        const k = el.id + '|' + p;
                        if (vistos.has(k)) continue;
                        vistos.add(k);
                        let v0 = null, esp = null;
                        try { const x = window.gsap.getProperty(el, p); v0 = typeof x === 'number' ? x : parseFloat(x); if (!Number.isFinite(v0)) v0 = null; } catch (e) { v0 = null; }
                        const sa = tw.vars.startAt[p] ?? tw.vars.startAt[p === 'scale' ? 'scaleX' : p];
                        esp = typeof sa === 'number' ? sa : null;
                        out.push({ key: el.id, p, v0, esperado: esp });
                    }
                }
            }
            return out;
        }, id);

        // ---- muestreo: barrido hacia delante (inicializa los tweens y mide el movimiento) ----
        // solo t < D (el ultimo muestreo cae a D - 1/FPS cuando D es multiplo de 1/15): el fotograma t = D queda fuera de la ventana del
        // #root (el host lo oculta) y metia una energia espuria (2.6-9) en el ultimo intervalo de 0.1 s
        const rapido = tiene('rapido');
        let previo = null;
        const diffs = []; // [t, energia]
        const t0m = Date.now();
        for (let k = 0; k / FPS < D - 1e-6; k++) {
            const t = k / FPS;
            if (rapido) { await c.ir(t); continue; }
            const buf = await c.captura(t, { escala: ANCHO_M / 1920 });
            const g = pngAGris(buf);
            if (previo) {
                let s = 0;
                for (let i = 0; i < g.gris.length; i++) s += Math.abs(g.gris[i] - previo[i]);
                diffs.push([t, s / g.gris.length]);
            }
            previo = g.gris;
        }
        await c.ir(Math.min(Math.max(meta.duracionTimeline, D), D + 30)); // inicializa tweens que arrancan despues de D
        info.msMuestreo = Date.now() - t0m;

        // ---- recoger tweens ----
        // Grupos de fromTo candidatos (se calculan en Node y se confirman en la pagina)
        const crudo = await c.page.evaluate(recoger, id);
        const tweens = crudo.tweens;
        const grupos = new Map();
        for (const tw of tweens) {
            if (!tw.tieneStartAt || tw.inmediato === false) continue;
            const props = new Set([...tw.vars, ...tw.desde].map(normalizaProp));
            for (const o of tw.objetivos) if (o.html) for (const p of props) { const k = `${o.key}|${p}`; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(tw); }
        }
        // ---- (a) movimiento ----
        if (!rapido) {
            const nb = Math.ceil(D * 10);
            const suma = new Float64Array(nb), cnt = new Float64Array(nb);
            for (const [t, e] of diffs) { const k = Math.min(Math.floor((t - 1e-6) * 10), nb - 1); suma[k] += e; cnt[k]++; }
            // un ultimo intervalo sin muestras (D no multiplo de 0.1 s) no se cuenta: no es un tramo "lento", es un tramo no medido
            let nbMedido = nb;
            while (nbMedido > 1 && !cnt[nbMedido - 1]) nbMedido--;
            const e = Array.from(suma.subarray(0, nbMedido), (s, i) => (cnt[i] ? (FACTOR_VIDEO * s) / cnt[i] : 0));
            const tramos = [];
            const nm = e.length;
            for (let i = 0; i < nm;) {
                if (e[i] < UMBRAL_LENTO) { let j = i; while (j < nm && e[j] < UMBRAL_LENTO) j++; tramos.push([i / 10, j / 10]); i = j; } else i++;
            }
            const lentos = tramos.map(([a, b]) => ({ t0: r1(a), t1: r1(b), dur: r1(b - a), muerto: b - a >= MUERTO - 1e-9, energiaMedia: r2(e.slice(Math.round(a * 10), Math.round(b * 10)).reduce((x, y) => x + y, 0) / Math.max(1, Math.round((b - a) * 10))) }))
                .filter((x) => x.dur >= MIN_TRAMO - 1e-9);
            const lentoS = lentos.reduce((s, x) => s + x.dur, 0);
            const muertos = lentos.filter((x) => x.muerto);
            const ord = [...e].sort((a, b) => a - b);
            info.movimiento = {
                umbralLento: UMBRAL_LENTO, media: r2(e.reduce((s, x) => s + x, 0) / nm), mediana: r2(ord[Math.floor(nm / 2)]),
                lentoS: r1(lentoS), lentoPct: Math.round((100 * lentoS) / D), muertoS: r1(muertos.reduce((s, x) => s + x.dur, 0)), tramosLentos: lentos,
                energia: e.map((x) => r2(x)),
            };
            for (const m of muertos) {
                const esperaFinal = m.t1 >= utilFin - 0.15 && m.dur <= ESPERA_FINAL_MAX + 1e-9;
                const txt = `tramo muerto ${m.t0.toFixed(1)}-${m.t1.toFixed(1)} s (${m.dur.toFixed(1)} s con energia ${m.energiaMedia}): nada se mueve lo bastante`;
                if (esperaFinal) avi('movimiento', `${txt} (espera de lectura final, tolerada hasta ${ESPERA_FINAL_MAX} s)`);
                else err('movimiento', txt);
            }
            if (lentos.length && !muertos.length) avi('movimiento', `${r1(lentoS)} s lentos (${info.movimiento.lentoPct} %): ${lentos.map((x) => `${x.t0.toFixed(1)}-${x.t1.toFixed(1)}`).join(', ')}`);
            else if (info.movimiento.lentoPct >= 30) avi('movimiento', `${info.movimiento.lentoPct} % del cuadro esta bajo el umbral de movimiento`);
        }

        // ---- (b) eventos ----
        const reales = tweens.filter((t) => !t.esAncla && t.tipo !== 'call' && t.t0 < D + 1e-6);
        const visibles = reales.map((t) => ({ t, v: esVisible(t) })).filter((x) => x.v.length);
        const starts = new Set(visibles.map((x) => Math.round(x.t.t0 / 0.05)));
        // el tecleo es UN tween lineal sobre un objeto JS: cada etiqueta sfx:key-* (una por caracter pintado) es un evento visible
        const teclasT = crudo.etiquetas.filter((e) => /^sfx:key-/.test(e.nombre) && e.t < D + 1e-6).map((e) => e.t);
        for (const t of teclasT) starts.add(Math.round(t / 0.05));
        const huecos = pausaMasLarga([...visibles.map((x) => [x.t.t0, Math.min(D, x.t.t0 + Math.min(x.t.d, 2.5))]), ...teclasT.map((t) => [t, t + 0.2])], 0, utilFin);
        info.eventos = { tweens: reales.length, porSegundo: r1(reales.length / D), visibles: visibles.length, teclas: teclasT.length, instantesVisibles: starts.size, visiblesPorSegundo: r1(starts.size / D), pausaMaxS: huecos.dur, pausaDe: huecos.de, pausaA: huecos.a };
        if (huecos.dur >= 1.5) avi('eventos', `la pausa mas larga sin un evento visible dura ${huecos.dur} s (${huecos.de}-${huecos.a} s)`);
        if (starts.size / D < 2) avi('eventos', `solo ${r1(starts.size / D)} eventos visibles por segundo (meta >= 2/s)`);

        // ---- (c) camara ----
        const cam = analizarCamara(tweens);
        const perceptibles = cam.filter((m) => m.perceptible);
        const hCam = pausaMasLarga(perceptibles.map((m) => [m.t0, m.t1]), 0, utilFin);
        info.camara = { movimientos: cam, perceptibles: perceptibles.length, snaps: cam.filter((m) => m.snap).length, pausaMaxS: hCam.dur, pausaDe: hCam.de, pausaA: hCam.a };
        for (const m of cam.filter((x) => !x.perceptible)) avi('camara', `deriva de camara imperceptible en ${m.id} ${m.t0}-${m.t1} s: pico ${m.picoPctS} %/s (< ${DERIVA_PCT_S} %/s), delta ${m.deltaPct} %`);
        if (!cam.length) avi('camara', 'el cuadro no tiene ningun movimiento de camara (no hay tweens sobre un contenedor world/cam/stage...)');
        else if (!perceptibles.length) avi('camara', 'ningun movimiento de camara es perceptible (todos < 3 %/s)');
        else if (hCam.dur >= 3.0) avi('camara', `${hCam.dur} s seguidos sin movimiento de camara perceptible (${hCam.de}-${hCam.a} s)`);

        // ---- (d) sonido ----
        const sfx = [];
        const vistos = new Set();
        const starts2 = tweens.map((t) => t.t0);
        for (const e of crudo.etiquetas) {
            if (!e.nombre.startsWith('sfx:')) continue;
            const m = /^sfx:([\w.-]+)@(\d*\.?\d+)#(\d+)$/.exec(e.nombre);
            if (!m) { err('sfx-etiqueta', `etiqueta "${e.nombre}" no cumple sfx:<nombre>@<vol>#<n>`); continue; }
            if (vistos.has(m[3])) err('sfx-etiqueta', `numero #${m[3]} repetido en el cuadro (cada etiqueta sfx lleva un <n> unico)`);
            vistos.add(m[3]);
            if (Number(m[2]) > 1) avi('sfx-etiqueta', `volumen ${m[2]} > 1 en ${e.nombre}`);
            let mejor = Infinity;
            for (const s of starts2) mejor = Math.min(mejor, Math.abs(s - e.t));
            // 'ventana' (ticks de contador y teclas): el instante cae DENTRO de un tween, no en su inicio (mismo criterio que
            // verify-sfx.mjs); basta con que haya un tween activo (tolerancia 33.3 ms). Los whoosh no se anclan al inicio.
            const ventana = SFX_VENTANA.test(m[1]);
            const whoosh = SFX_WHOOSH.test(m[1]);
            const margen = whoosh ? 0.066 : TOL_SFX; // verify-sfx.mjs da 2 fotogramas a los whoosh
            const enTween = tweens.some((t) => t.tipo !== 'call' && e.t >= t.t0 - margen && e.t <= t.t0 + t.d + margen);
            const exento = ventana || whoosh;
            const ok = ventana ? enTween : whoosh || mejor <= TOL_SFX;
            sfx.push({ etiqueta: e.nombre, t: r3(e.t), nombre: m[1], dtMs: Number.isFinite(mejor) ? Math.round(mejor * 1000) : null, exento, ok });
            if (ventana && !ok) err('sfx-huerfano', `${e.nombre} en ${r3(e.t)} s no cae dentro de ningun tween del cuadro (los ticks y teclas deben sonar dentro del tween del contador / del tecleo)`);
            else if (whoosh && !enTween) avi('sfx-whoosh', `${e.nombre} en ${r3(e.t)} s no cae dentro de ningun tween del cuadro (un whoosh debe acompanar un movimiento visible)`);
            else if (!ok) err('sfx-huerfano', `${e.nombre} en ${r3(e.t)} s esta a ${Number.isFinite(mejor) ? Math.round(mejor * 1000) : '?'} ms del inicio de un tween (maximo 33.3 ms): el sonido no se corresponde con ningun evento visual`);
            if (e.t > D + 1e-6) err('sfx-fuera', `${e.nombre} (${r3(e.t)} s) cae despues del final del cuadro (${D} s)`);
        }
        info.sonido = { etiquetas: sfx.length, huerfanas: sfx.filter((s) => !s.ok).length, detalle: sfx };

        // ---- (e) lectura ----
        const planMarcas = (plan?.frames.find((f) => f.id === id)?.read_marks) ?? [];
        const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const lecturas = [];
        for (const e of crudo.etiquetas) {
            if (!e.nombre.startsWith('read:')) continue;
            const frase = e.nombre.slice(5).replace(/#\d+$/, ''); // readMark() agrega '#<n>' para que la etiqueta sea unica
            const pm = planMarcas.find((m) => norm(m.frase) === norm(frase));
            const minL = pm?.min_lectura ?? 0.5;
            const resto = r3(utilFin - e.t);
            const ok = resto >= minL - 1e-9;
            lecturas.push({ frase, t: r3(e.t), restoHastaFinUtil: resto, minLectura: minL, ok });
            if (!ok) err('lectura', `"${frase}" queda completa en ${r3(e.t)} s y el final util es ${utilFin} s: solo ${resto} s de lectura (minimo ${minL} s)`);
        }
        for (const m of planMarcas) if (!lecturas.some((l) => norm(l.frase) === norm(m.frase))) avi('lectura', `el plan marca "${m.frase}" pero el cuadro no tiene la etiqueta read:${m.frase}`);
        info.lectura = lecturas;
        if (!lecturas.length && !planMarcas.length) avi('lectura', 'el cuadro no declara ninguna etiqueta read:<frase> (frases clave sin tiempo de lectura verificable)');

        // ---- (g) trampas dinamicas ----
        {
            const filas = [];
            for (const [k, grupo] of grupos) {
                if (grupo.length < 2) continue;
                const [key, p] = k.split('|');
                const ord = [...grupo].sort((a, b) => a.t0 - b.t0);
                const ini = inicial.find((x) => x.key === key && x.p === p);
                const conf = ini && ini.esperado !== null && ini.v0 !== null && Math.abs(ini.v0 - ini.esperado) > 1e-3 ? ` [confirmado: vale ${r3(ini.v0)} antes de empezar y deberia valer ${r3(ini.esperado)}]` : '';
                filas.push({ objetivo: key, prop: p, inicios: ord.map((g) => r2(g.t0)), valorInicial: ini?.v0 ?? null, esperado: ini?.esperado ?? null, confirmado: !!conf });
                if (filas.length <= 6) info._ejemplosFromTo = (info._ejemplosFromTo ?? []).concat(`${key.replace(`${id}-`, '')}.${p} (${ord.map((g) => r2(g.t0)).join(', ')} s)${conf}`);
            }
            info.fromToRepetidos = filas;
            if (filas.length) {
                const conf = filas.filter((f) => f.confirmado).length;
                err('fromTo-repetido', `${filas.length} propiedad(es) con fromTo repetido sin immediateRender:false (${conf} confirmada(s) con el valor visible antes de empezar): el "desde" del ultimo fromTo se aplica al crear el timeline y el objeto aparece en ese estado antes de que arranque su primer tween (bug del cuadro 6 v1: entraba a escala 1.6). Ej.: ${info._ejemplosFromTo.join('; ')}. Pon immediateRender:false en todos menos el primero`);
            }
            delete info._ejemplosFromTo;
        }
        for (const tw of tweens) if (tw.repeat === -1) err('repeat', `tween con repeat:-1 en ${r2(tw.t0)} s`);
        // transform CSS + GSAP
        const choque = new Map();
        for (const tw of tweens) for (const o of tw.objetivos) {
            if (!o.html || !o.csstf) continue;
            const ps = [...tw.vars, ...tw.desde].filter((p) => TRANSFORMS.has(p));
            if (ps.length) choque.set(o.key, { tf: o.csstf, ps: [...new Set([...(choque.get(o.key)?.ps ?? []), ...ps])] });
        }
        for (const [k, v] of choque) err('transform-css', `${k} tiene transform CSS (${v.tf.slice(0, 40)}) y GSAP anima ${v.ps.join('/')} sobre el: GSAP lo mezcla o lo pisa. Quita el transform del CSS (centra con left/top/margen o con xPercent/yPercent de GSAP)`);
        // exit en cuadro no final: solo cuenta apagar el cuadro entero (#root, el contenedor world/cam) o un elemento que cubra >= 80 %
        // del lienzo. Los cursores, halos, anillos y carets decorativos que se apagan al final no son una salida del cuadro.
        if (!esFinal) {
            for (const tw of tweens) {
                if (tw.t0 + tw.d < utilFin - 0.5 || tw.t0 + tw.d > D + 1e-6 || tw.t0 < utilFin - 1.2) continue;
                const op = tw.props.find((p) => p.p === 'opacity' && p.s !== null && p.c !== null && p.s + p.c <= 0.05 && p.c < -0.3);
                if (!op) continue;
                const objeto = tw.objetivos.find((o) => o.key === op.t);
                if (!objeto || !objeto.html) continue;
                const cubre = objeto.area >= EXIT_AREA_MIN * 1920 * 1080;
                const contenedor = objeto.id === 'root' || CAM_ID.test(objeto.id || '') || objeto.camara;
                if (!cubre && !contenedor) continue;
                const txt = `salida (opacity -> 0) de ${objeto.key} en ${r2(tw.t0)}-${r2(tw.t0 + tw.d)} s en un cuadro que no es el final: la transicion de index.html es la que saca el cuadro`;
                if (objeto.area >= 0.3 * 1920 * 1080) err('exit', txt);
                else avi('exit', `${objeto.key} (contenedor de camara) se apaga (opacity -> 0) en ${r2(tw.t0)}-${r2(tw.t0 + tw.d)} s cerca del final del cuadro: confirma que no es una salida del cuadro`);
            }
        }
        info.tweens = { total: tweens.length, fromTo: tweens.filter((t) => t.tipo === 'fromTo').length };
    } catch (e) {
        E.push({ cod: 'excepcion', msg: e.stack || String(e) });
    } finally {
        await c.cerrar();
    }
    return { id, errores: E, avisos: A, info };
}

// ---------- salida ----------
const host = await crearHost(RAIZ);
const informes = [];
try {
    for (const id of ids) informes.push(await revisar(host, id));
} finally {
    await host.cerrar();
}
const hayError = informes.some((i) => i.errores.length);
if (tiene('json')) {
    console.log(JSON.stringify(informes, null, 1));
} else {
    for (const r of informes) {
        const i = r.info;
        console.log(`\n== ${r.id}  duracion ${i.duracion ?? '?'} s, solape de salida ${i.solapeSalida ?? 0} s, final util ${i.utilFin ?? '?'} s${i.final ? ' (cuadro final)' : ''}  [${r.errores.length} error(es), ${r.avisos.length} aviso(s)]`);
        if (i.movimiento) console.log(`  (a) movimiento: lento ${i.movimiento.lentoS} s (${i.movimiento.lentoPct} %), muerto ${i.movimiento.muertoS} s; energia media ${i.movimiento.media}, mediana ${i.movimiento.mediana}${i.movimiento.tramosLentos.length ? `; tramos: ${i.movimiento.tramosLentos.map((x) => `${x.t0.toFixed(1)}-${x.t1.toFixed(1)}${x.muerto ? '*' : ''}`).join(' ')}` : ''}`);
        if (i.eventos) console.log(`  (b) eventos: ${i.eventos.tweens} tweens (${i.eventos.porSegundo}/s), ${i.eventos.instantesVisibles} instantes visibles (${i.eventos.visiblesPorSegundo}/s); pausa mas larga sin evento visible ${i.eventos.pausaMaxS} s (${i.eventos.pausaDe}-${i.eventos.pausaA} s)`);
        if (i.camara) console.log(`  (c) camara: ${i.camara.movimientos.length} tween(s), ${i.camara.perceptibles} perceptible(s), ${i.camara.snaps} snap(s); mas larga sin camara ${i.camara.pausaMaxS} s${i.camara.movimientos.length ? '; ' + i.camara.movimientos.map((m) => `${m.t0}-${m.t1}s ${m.id.replace(`${r.id}-`, '')} ${m.deltaPct}% pico ${m.picoPctS}%/s`).join(' | ') : ''}`);
        if (i.sonido) console.log(`  (d) sonido: ${i.sonido.etiquetas} etiqueta(s) sfx:, ${i.sonido.huerfanas} huerfana(s)`);
        if (i.lectura) console.log(`  (e) lectura: ${i.lectura.length} marca(s) read:${i.lectura.length ? ' ' + i.lectura.map((l) => `"${l.frase}"@${l.t}s (+${l.restoHastaFinUtil}s)`).join(', ') : ''}`);
        if (i.iconos) console.log(`  (f) iconos: ${i.iconos.n} con data-lucide, ${i.iconos.sinLucide24} svg 24x24 sin data-lucide; avatares: ${i.avatares?.length ? i.avatares.map((a) => a.split('/').pop()).join(', ') : 'ninguno'}`);
        if (i.tweens) console.log(`  (g) tweens: ${i.tweens.total} (${i.tweens.fromTo} fromTo)`);
        for (const e of r.errores) console.log(`  ERROR [${e.cod}] ${e.msg}`);
        for (const a of r.avisos) console.log(`  AVISO [${a.cod}] ${a.msg}`);
        if (!r.errores.length && !r.avisos.length) console.log('  OK sin hallazgos');
    }
    console.log(`\n${informes.length} cuadro(s): ${informes.reduce((s, r) => s + r.errores.length, 0)} error(es), ${informes.reduce((s, r) => s + r.avisos.length, 0)} aviso(s)${hayError ? '  -> FALLA' : '  -> ok'}`);
}
process.exit(hayError ? 1 : 0);
