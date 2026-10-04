#!/usr/bin/env node
// lucide.mjs - iconos REALES de Lucide listos para pegar en un cuadro del video (SVG en linea).
//
// Lee los datos del icono del mismo paquete que usa la app (web/node_modules/lucide-react, dist/esm/icons/*.mjs, __iconData)
// o, si se pide, de 'lucide-static' (icons/*.svg). Sin dependencias: solo node >= 18.
//
//   node scripts/lucide.mjs <nombre> [opciones]          imprime el <svg>
//   node scripts/lucide.mjs timer --size 72 --stroke 1.5 --class "ic-hero" --id "02-timer" --draw
//   node scripts/lucide.mjs users --tile azul --size 64  imprime el icono dentro de un "tile" redondeado (estilo StatCard)
//
// Opciones del icono
//   --size N        ancho y alto en px (24 por defecto). Legibilidad a 1920x1080: >= 32 en interfaz, 72-200 en heroes.
//   --stroke N      grosor del trazo en unidades del viewBox 24 (1.75 por defecto; la app usa 1.5-1.75).
//   --class "a b"   atributo class del <svg>.
//   --id X          atributo id del <svg>.
//   --color C       color de trazo (currentColor por defecto; un hex o var(--x) tambien sirve).
//   --fill C        relleno (none por defecto; p. ej. --fill "#fff" para estrellas/sparkle rellenos).
//   --draw          prepara cada trazo (path/line/circle/rect/...) para animar su DIBUJADO con GSAP. Emite en cada elemento
//                     pathLength="100" stroke-dasharray="100 200" stroke-dashoffset="<D>"   (D = 105..195, ver abajo)
//                   y el icono NACE OCULTO (offset D = nada visible): sin animacion no se ve; si el icono es estatico, no pases --draw.
//                   RECETA GSAP (probada en Chrome headless 0.1/0.3/0.5/0.7/0.9 del progreso con power1.inOut: el trazo crece de forma progresiva):
//                     tl.fromTo(svg.querySelectorAll('*'), { strokeDashoffset: 105 }, { strokeDashoffset: 0, duration: .6, ease: 'power1.inOut', stagger: .08 }, t);
//                   Reglas de la receta:
//                     1. Valores ENTEROS (105 -> 0). GSAP redondea los valores 'px' de strokeDashoffset a enteros (autoRound): con
//                        pathLength="1" y offsets 1.05 -> 0 el trazo saltaba de golpe. Con pathLength="100" cada entero es un 1 % del trazo.
//                        Alternativa si necesitas decimales: { strokeDashoffset: 105.5 }, { strokeDashoffset: 0, autoRound: false }.
//                     2. Con stroke-linecap round, el casquete (stroke/2, en unidades del viewBox) asoma como un PUNTO antes de empezar si el
//                        offset de partida es solo 105 y el trazo es corto (una palomita mide ~17 unidades: su casquete son ~9 % del trazo).
//                        Por eso --draw calcula D por elemento (100 + casquete + margen, tope 195) y lo deja en stroke-dashoffset. La forma
//                        robusta lee ese valor (sirve igual para trazos largos y cortos; offsets enteros porque D ya sale entero):
//                          tl.fromTo(els, { strokeDashoffset: function (i, el) { return +el.getAttribute('stroke-dashoffset'); } },
//                                         { strokeDashoffset: 0, duration: .6, ease: 'power1.inOut', stagger: .08 }, t);
//                        Si cambias el grosor despues (--stroke o CSS), vuelve a generar con el --stroke final.
//                     3. Con 'immediateRender: false' si el mismo elemento tiene mas de un fromTo (regla del medidor frame-check).
//                     4. Los puntos (lineas de largo ~0, como el de 'circle-alert') no se preparan: se quedan como estan, visibles.
//                   La geometria no cambia: --verify/--identify/--strict ignoran pathLength y stroke-dash* (el hash solo cuenta tag + d/cx/cy/r/...).
//   --no-data       no agrega data-lucide="<nombre>" (SIN el, el verificador no podra revisar ese svg).
//   --title T       agrega <title> (accesibilidad; por defecto aria-hidden="true").
//   --tile TONO     envuelve en un tile: azul | verde | dorado | rosa | violeta | neutro | tinta  (color de fondo + color del icono)
//   --tile-size N   lado del tile en px (por defecto size * 1.75)
//   --multiline     un hijo por linea (por defecto una sola linea)
//
// Utilidades
//   --list [texto]         lista los nombres de Lucide (filtra por subcadena)
//   --info <nombre>        nombre canonico, alias, version y hash del contenido
//   --check n1 n2 ...      comprueba que cada nombre exista (sale con 1 si alguno no existe)
//   --assets [dir] n1 ...  escribe <dir>/<nombre>.svg (por defecto assets/icons) y actualiza manifest.json
//   --manifest [dir]       regenera manifest.json a partir de los .svg que ya hay en <dir>
//   --verify f1.html ...   revisa cada <svg data-lucide="x"> de esos archivos contra Lucide real (geometria); exit 1 si difiere.
//                          Con --strict tambien marca como error los <svg viewBox="0 0 24 24"> sin data-lucide.
//   --identify f1.html ... para cada <svg viewBox="0 0 24 24"> (con o sin data-lucide) dice a que icono de Lucide equivale (o el mas parecido
//                          y por que no coincide). Sirve para auditar cuadros ya escritos.
//   --src static:<dir>     usa lucide-static (<dir>/icons/*.svg) en vez de lucide-react.  LUCIDE_DIR=<dir> cambia el paquete react.
//   --version              version de Lucide en uso

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PROYECTO = path.resolve(AQUI, '..');
const POR_DEFECTO = path.resolve(PROYECTO, '../../web/node_modules/lucide-react');
const REACT_DIR = process.env.LUCIDE_DIR || POR_DEFECTO;

// ---------- argumentos ----------
const BOOL = new Set(['draw', 'no-data', 'multiline', 'strict', 'version', 'help']);
const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
        const k = a.slice(2);
        if (BOOL.has(k)) flags[k] = true;
        else if (['list', 'assets', 'manifest', 'info', 'check', 'verify', 'identify'].includes(k)) {
            flags[k] = true;
            flags._modo = k;
            // el resto de posicionales (hasta el siguiente --flag) pertenecen a la utilidad
        } else flags[k] = argv[++i];
    } else pos.push(a);
}

// ---------- fuente de datos ----------
let FUENTE = 'react';
let STATIC_DIR = null;
if (flags.src && String(flags.src).startsWith('static:')) {
    FUENTE = 'static';
    STATIC_DIR = path.resolve(String(flags.src).slice(7));
}

function leerVersion() {
    const base = FUENTE === 'static' ? STATIC_DIR : REACT_DIR;
    try {
        return JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8')).version;
    } catch {
        return 'desconocida';
    }
}
const VERSION = leerVersion();

let _alias = null;
function aliasMap() {
    if (_alias) return _alias;
    _alias = {};
    if (FUENTE !== 'react') return _alias;
    try {
        const t = fs.readFileSync(path.join(REACT_DIR, 'dist/esm/dynamicIconImports.mjs'), 'utf8');
        for (const m of t.matchAll(/"([a-z0-9-]+)":\s*\(\)\s*=>\s*import\('\.\/icons\/([a-z0-9-]+)\.mjs'\)/g)) {
            if (m[1] !== m[2]) _alias[m[1]] = m[2];
        }
    } catch { /* sin alias */ }
    return _alias;
}

function archivoDe(nombre) {
    return FUENTE === 'static' ? path.join(STATIC_DIR, 'icons', nombre + '.svg') : path.join(REACT_DIR, 'dist/esm/icons', nombre + '.mjs');
}

// Devuelve { nombre (canonico), pedido, nodos: [{tag, attrs}] } o null.
function cargarIcono(pedido) {
    let nombre = pedido;
    if (!fs.existsSync(archivoDe(nombre))) {
        const al = aliasMap()[pedido];
        if (al && fs.existsSync(archivoDe(al))) nombre = al;
        else return null;
    }
    let txt = fs.readFileSync(archivoDe(nombre), 'utf8');
    // Los alias (check-circle, clock-4...) son archivos de una linea: export { default } from './nombre-canonico.mjs'
    const redir = FUENTE === 'react' && !txt.includes('__iconData =') && txt.match(/from '\.\/([a-z0-9-]+)\.mjs'/);
    if (redir) {
        nombre = redir[1];
        txt = fs.readFileSync(archivoDe(nombre), 'utf8');
    }
    let nodos;
    if (FUENTE === 'static') {
        nodos = parsearHijosSvg(txt.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, ''));
    } else {
        const m = txt.match(/const __iconData = (\{[\s\S]*?\n\});/);
        if (!m) return null;
        // El archivo es de un paquete local de confianza; se evalua solo el literal del objeto.
        const d = new Function('return (' + m[1] + ')')();
        nodos = d.node.map(([tag, attrs]) => {
            const a = { ...attrs };
            delete a.key;
            return { tag, attrs: a };
        });
    }
    return { nombre, pedido, nodos };
}

function parsearHijosSvg(inner) {
    const out = [];
    for (const k of inner.matchAll(/<(\w+)\b([^>]*?)\/?>/g)) {
        if (k[1] === 'title' || k[1] === 'desc' || k[1] === 'g' || k[1] === 'defs') continue;
        const attrs = {};
        for (const x of k[2].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[x[1]] = x[2];
        out.push({ tag: k[1], attrs });
    }
    return out;
}

// ---------- hash canonico ----------
// Solo cuenta la GEOMETRIA (tag + atributos de forma), no el estilo (class, id, pathLength, fill, stroke...), asi un icono con --draw,
// otro grosor o otro color sigue siendo "el mismo icono" y uno con el path de una version vieja no lo es.
const GEOM = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'points'];
function canon(nodos) {
    const filas = nodos.map(({ tag, attrs }) => {
        const o = {};
        for (const k of GEOM) if (attrs[k] !== undefined) o[k] = String(attrs[k]).replace(/\s+/g, ' ').trim();
        return tag + ':' + JSON.stringify(o);
    });
    return filas.join('\n');
}
function hashNodos(nodos) {
    return crypto.createHash('sha256').update(canon(nodos)).digest('hex').slice(0, 16);
}
// Dos nodos son el mismo trazo si coinciden en geometria, sin importar el orden (algunas versiones reordenan).
function mismoContenido(a, b) {
    const f = (n) => canon(n).split('\n').sort().join('\n');
    return f(a) === f(b);
}

// ---------- generacion del SVG ----------
const TONOS = {
    azul: ['#e6eefc', '#0061fe'],
    verde: ['#e3f4ea', '#1f7a47'],
    dorado: ['#fbefd2', '#9a6408'],
    rosa: ['#fbe4e1', '#b3261e'],
    violeta: ['#eee9f7', '#6f4fb3'],
    neutro: ['#f0ede8', '#6f6a65'],
    tinta: ['#1e1919', '#ffffff'],
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// ---------- longitud de cada trazo (para calcular el offset de partida del dibujado) ----------
// Estimacion en unidades del viewBox 24: basta con ~1 % de error (solo sirve para dimensionar el casquete redondo).
const num = (v, d = 0) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
function perimetroElipse(a, b) { return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); } // Ramanujan I

function longitudPath(d) {
    const T = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, total = 0, previo = '';
    const nx = () => Number(T[i++]);
    const bandera = () => { // las banderas del arco pueden venir pegadas ("0 01-1 1"): se leen de a un caracter
        const t = T[i];
        if (t.length > 1 && /^[01]/.test(t)) { T[i] = t.slice(1); return Number(t[0]); }
        i++;
        return Number(t);
    };
    const seg = (x2, y2) => { total += Math.hypot(x2 - x, y2 - y); x = x2; y = y2; };
    const cubica = (x1, y1, x2, y2, x3, y3) => {
        let px = x, py = y;
        for (let k = 1; k <= 24; k++) {
            const u = k / 24, v = 1 - u;
            const qx = v * v * v * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3;
            const qy = v * v * v * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3;
            total += Math.hypot(qx - px, qy - py); px = qx; py = qy;
        }
        cx = 2 * x3 - x2; cy = 2 * y3 - y2; x = x3; y = y3;
    };
    const cuadratica = (x1, y1, x2, y2) => {
        let px = x, py = y;
        for (let k = 1; k <= 24; k++) {
            const u = k / 24, v = 1 - u;
            const qx = v * v * x + 2 * v * u * x1 + u * u * x2, qy = v * v * y + 2 * v * u * y1 + u * u * y2;
            total += Math.hypot(qx - px, qy - py); px = qx; py = qy;
        }
        cx = 2 * x2 - x1; cy = 2 * y2 - y1; x = x2; y = y2;
    };
    const arco = (rx, ry, rot, fa, fs, x2, y2) => { // conversion endpoint -> centro (SVG 1.1 F.6.5) y muestreo
        if (rx === 0 || ry === 0 || (x === x2 && y === y2)) { seg(x2, y2); return; }
        rx = Math.abs(rx); ry = Math.abs(ry);
        const f = (rot * Math.PI) / 180, c = Math.cos(f), s = Math.sin(f);
        const dx = (x - x2) / 2, dy = (y - y2) / 2;
        const x1p = c * dx + s * dy, y1p = -s * dx + c * dy;
        const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
        if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
        const num_ = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
        const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
        const co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num_ / den));
        const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
        const ccx = c * cxp - s * cyp + (x + x2) / 2, ccy = s * cxp + c * cyp + (y + y2) / 2;
        const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
        let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
        if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
        let px = x, py = y;
        for (let k = 1; k <= 48; k++) {
            const a = t1 + (dt * k) / 48;
            const qx = ccx + c * rx * Math.cos(a) - s * ry * Math.sin(a), qy = ccy + s * rx * Math.cos(a) + c * ry * Math.sin(a);
            total += Math.hypot(qx - px, qy - py); px = qx; py = qy;
        }
        x = x2; y = y2;
    };
    while (i < T.length) {
        if (/^[A-Za-z]$/.test(T[i])) cmd = T[i++];
        const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
        if (C === 'Z') { seg(sx, sy); previo = 'Z'; continue; }
        if (C === 'M') { x = ox + nx(); y = oy + nx(); sx = x; sy = y; cmd = rel ? 'l' : 'L'; previo = 'M'; continue; }
        if (C === 'L') seg(ox + nx(), oy + nx());
        else if (C === 'H') seg((rel ? x : 0) + nx(), y);
        else if (C === 'V') seg(x, (rel ? y : 0) + nx());
        else if (C === 'C') { const a = ox + nx(), b = oy + nx(), c2 = ox + nx(), d2 = oy + nx(), e = ox + nx(), f = oy + nx(); cubica(a, b, c2, d2, e, f); }
        else if (C === 'S') { const rf = previo === 'C' || previo === 'S'; const c2 = ox + nx(), d2 = oy + nx(), e = ox + nx(), f = oy + nx(); cubica(rf ? cx : x, rf ? cy : y, c2, d2, e, f); }
        else if (C === 'Q') { const a = ox + nx(), b = oy + nx(), e = ox + nx(), f = oy + nx(); cuadratica(a, b, e, f); }
        else if (C === 'T') { const rf = previo === 'Q' || previo === 'T'; const e = ox + nx(), f = oy + nx(); cuadratica(rf ? cx : x, rf ? cy : y, e, f); }
        else if (C === 'A') { const rx = nx(), ry = nx(), rot = nx(), fa = bandera(), fs = bandera(); arco(rx, ry, rot, fa, fs, ox + nx(), oy + nx()); }
        else break;
        previo = C;
    }
    return total;
}

function longitudNodo({ tag, attrs: a }) {
    if (tag === 'path') return longitudPath(a.d || '');
    if (tag === 'line') return Math.hypot(num(a.x2) - num(a.x1), num(a.y2) - num(a.y1));
    if (tag === 'circle') return 2 * Math.PI * num(a.r);
    if (tag === 'ellipse') return perimetroElipse(num(a.rx), num(a.ry));
    if (tag === 'rect') {
        const w = num(a.width), h = num(a.height);
        let rx = num(a.rx, num(a.ry)), ry = num(a.ry, rx);
        rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
        return 2 * (w - 2 * rx) + 2 * (h - 2 * ry) + (rx && ry ? perimetroElipse(rx, ry) : 0);
    }
    if (tag === 'polyline' || tag === 'polygon') {
        const p = (a.points || '').trim().split(/[\s,]+/).map(Number);
        let t = 0;
        for (let k = 2; k + 1 < p.length; k += 2) t += Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]);
        if (tag === 'polygon' && p.length >= 4) t += Math.hypot(p[0] - p[p.length - 2], p[1] - p[p.length - 1]);
        return t;
    }
    return 0;
}

// Offset de partida del dibujado: 100 (trazo) + casquete redondo (stroke/2 en unidades del trazo normalizado a 100) + margen, entero,
// entre 105 y 195 (el hueco del dasharray es 200, asi el siguiente "guion" del patron nunca entra en el trazo).
function offsetDibujo(nodo, stroke) {
    const L = longitudNodo(nodo);
    if (!(L >= 0.5)) return null; // puntos: no se preparan
    return Math.min(195, Math.max(105, Math.ceil(100 + ((stroke / 2) * 100) / L + 3)));
}

function nodoAStr(n, draw, stroke) {
    const attrs = Object.entries(n.attrs).map(([k, v]) => `${k}="${esc(v)}"`);
    if (draw) {
        const off = offsetDibujo(n, stroke);
        if (off !== null) attrs.push('pathLength="100"', 'stroke-dasharray="100 200"', `stroke-dashoffset="${off}"`);
    }
    return `<${n.tag} ${attrs.join(' ')}/>`.replace(' />', '/>');
}

function generarSvg(ic, o = {}) {
    const size = o.size ?? 24;
    const stroke = o.stroke ?? 1.75;
    const attrs = [
        'xmlns="http://www.w3.org/2000/svg"',
        `width="${size}"`,
        `height="${size}"`,
        'viewBox="0 0 24 24"',
        `fill="${esc(o.fill ?? 'none')}"`,
        `stroke="${esc(o.color ?? 'currentColor')}"`,
        `stroke-width="${stroke}"`,
        'stroke-linecap="round"',
        'stroke-linejoin="round"',
    ];
    if (!o.noData) attrs.push(`data-lucide="${ic.nombre}"`);
    if (o.id) attrs.push(`id="${esc(o.id)}"`);
    if (o.class) attrs.push(`class="${esc(o.class)}"`);
    if (!o.title) attrs.push('aria-hidden="true"');
    else attrs.push('role="img"');
    const sep = o.multiline ? '\n    ' : '';
    const hijos = ic.nodos.map((n) => nodoAStr(n, o.draw, stroke)).join(sep);
    const title = o.title ? `<title>${esc(o.title)}</title>` : '';
    const svg = o.multiline ? `<svg ${attrs.join(' ')}>\n    ${title}${hijos}\n</svg>` : `<svg ${attrs.join(' ')}>${title}${hijos}</svg>`;
    if (!o.tile) return svg;
    const [bg, fg] = TONOS[o.tile] || TONOS.neutro;
    const t = o.tileSize ?? Math.round(size * 1.75);
    const r = Math.round(t * 0.28);
    return `<span class="ic-tile" style="display:inline-grid;place-items:center;width:${t}px;height:${t}px;border-radius:${r}px;background:${bg};color:${fg};flex:none">${svg}</span>`;
}

function opcionesDeFlags() {
    return {
        size: flags.size !== undefined ? Number(flags.size) : undefined,
        stroke: flags.stroke !== undefined ? Number(flags.stroke) : undefined,
        class: flags.class,
        id: flags.id,
        color: flags.color,
        fill: flags.fill,
        draw: !!flags.draw,
        noData: !!flags['no-data'],
        title: flags.title,
        tile: flags.tile,
        tileSize: flags['tile-size'] !== undefined ? Number(flags['tile-size']) : undefined,
        multiline: !!flags.multiline,
    };
}

function fallo(msg, codigo = 1) {
    console.error(msg);
    process.exit(codigo);
}

function sugerir(nombre) {
    const todos = listarNombres();
    return todos.filter((n) => n.includes(nombre) || nombre.includes(n)).slice(0, 6);
}

function listarNombres() {
    const base = FUENTE === 'static' ? path.join(STATIC_DIR, 'icons') : path.join(REACT_DIR, 'dist/esm/icons');
    const ext = FUENTE === 'static' ? '.svg' : '.mjs';
    return fs
        .readdirSync(base)
        .filter((f) => f.endsWith(ext))
        .map((f) => f.slice(0, -ext.length))
        .sort();
}

// Nombres canonicos (sin los archivos-alias de una linea); es lo que muestra --list.
function listarCanonicos() {
    if (FUENTE === 'static') return listarNombres();
    const base = path.join(REACT_DIR, 'dist/esm/icons');
    return listarNombres().filter((n) => fs.readFileSync(path.join(base, n + '.mjs'), 'utf8').includes('__iconData ='));
}

// ---------- modos ----------
if (flags.help || (!flags._modo && !flags.version && pos.length === 0)) {
    const t = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
    console.log(t.filter((l) => l.startsWith('//')).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(0);
}

if (flags.version) {
    console.log(`lucide ${VERSION} (${FUENTE === 'static' ? STATIC_DIR : REACT_DIR})`);
    process.exit(0);
}

if (!fs.existsSync(FUENTE === 'static' ? path.join(STATIC_DIR, 'icons') : path.join(REACT_DIR, 'dist/esm/icons'))) {
    fallo(`No encuentro Lucide en ${FUENTE === 'static' ? STATIC_DIR : REACT_DIR}. Define LUCIDE_DIR=<ruta a lucide-react> o usa --src static:<dir>.`, 2);
}

const modo = flags._modo;

if (modo === 'list') {
    const filtro = pos[0];
    const n = listarCanonicos().filter((x) => !filtro || x.includes(filtro));
    console.log(n.join('\n'));
    console.error(`${n.length} iconos canonicos (lucide ${VERSION}; los alias tambien se aceptan)`);
} else if (modo === 'info') {
    for (const p of pos) {
        const ic = cargarIcono(p);
        if (!ic) fallo(`"${p}" no existe en Lucide ${VERSION}. Parecidos: ${sugerir(p).join(', ') || '(ninguno)'}`);
        console.log(JSON.stringify({ nombre: ic.nombre, pedido: p, alias: p !== ic.nombre, version: VERSION, hash: hashNodos(ic.nodos), elementos: ic.nodos.length }));
    }
} else if (modo === 'check') {
    let mal = 0;
    for (const p of pos) {
        const ic = cargarIcono(p);
        if (ic) console.log(`OK    ${p}${ic.nombre !== p ? ' -> alias de ' + ic.nombre : ''}`);
        else {
            mal++;
            console.log(`FALTA ${p}   (parecidos: ${sugerir(p).join(', ') || 'ninguno'})`);
        }
    }
    process.exit(mal ? 1 : 0);
} else if (modo === 'assets' || modo === 'manifest') {
    // --assets [dir] n1 n2 ...   |  --manifest [dir]
    let dir = path.join(PROYECTO, 'assets/icons');
    let nombres = pos;
    if (pos[0] && (pos[0].includes('/') || pos[0].includes('\\')) && !pos[0].endsWith('.svg')) {
        dir = path.resolve(pos[0]);
        nombres = pos.slice(1);
    }
    fs.mkdirSync(dir, { recursive: true });
    const o = opcionesDeFlags();
    if (modo === 'assets') {
        for (const p of nombres) {
            const ic = cargarIcono(p);
            if (!ic) fallo(`"${p}" no existe en Lucide ${VERSION}. Parecidos: ${sugerir(p).join(', ') || '(ninguno)'}`);
            // el archivo .svg lleva currentColor y 24 px: se redimensiona al pegarlo
            fs.writeFileSync(path.join(dir, ic.nombre + '.svg'), generarSvg(ic, { ...o, size: o.size ?? 24, tile: undefined, multiline: true }) + '\n');
        }
    }
    // manifest = todos los .svg de la carpeta, leidos de vuelta
    const entradas = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.svg')).sort()) {
        const nombre = f.slice(0, -4);
        const ic = cargarIcono(nombre);
        if (!ic) continue;
        const txt = fs.readFileSync(path.join(dir, f), 'utf8');
        const nodos = parsearHijosSvg(txt.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, ''));
        entradas.push({ nombre, archivo: f, hash: hashNodos(nodos), hashLucide: hashNodos(ic.nodos), coincide: hashNodos(nodos) === hashNodos(ic.nodos) });
    }
    const manifest = {
        lucide: VERSION,
        fuente: FUENTE === 'static' ? 'lucide-static' : 'lucide-react',
        hashes: 'sha256 (16 hex) de la geometria canonica: tag + d/cx/cy/r/rx/ry/x/y/x1/x2/y1/y2/width/height/points. Ignora class, id, pathLength, fill, stroke.',
        iconos: entradas.map(({ nombre, archivo, hash }) => ({ nombre, archivo, version: VERSION, hash })),
    };
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    const malos = entradas.filter((e) => !e.coincide);
    console.log(`${entradas.length} iconos en ${dir} (lucide ${VERSION})${malos.length ? ' | NO coinciden: ' + malos.map((m) => m.nombre).join(', ') : ''}`);
    process.exit(malos.length ? 1 : 0);
} else if (modo === 'identify') {
    if (!pos.length) fallo('Uso: --identify archivo.html [...]', 2);
    const indice = new Map();
    const todos = [];
    for (const n of listarCanonicos()) {
        const ic = cargarIcono(n);
        if (!ic) continue;
        todos.push(ic);
        const h = hashNodos(ic.nodos);
        if (!indice.has(h)) indice.set(h, []);
        indice.get(h).push(n);
    }
    const tokens = (nodos) => new Set(canon(nodos).split(/(?=[A-Za-z])|\n|"/).map((t) => t.trim()).filter((t) => t.length > 1));
    let ok = 0, mal = 0;
    for (const f of pos) {
        const h = fs.readFileSync(f, 'utf8');
        const base = path.basename(f);
        for (const m of h.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g)) {
            if (!/viewBox="0 0 24 24"/.test(m[1])) continue;
            const linea = h.slice(0, m.index).split('\n').length;
            const nodos = parsearHijosSvg(m[2]);
            const hs = hashNodos(nodos);
            const dl = (m[1].match(/data-lucide="([^"]+)"/) || [])[1];
            const sw = (m[1].match(/stroke-width="([\d.]+)"/) || [])[1] || '-';
            if (indice.has(hs)) {
                ok++;
                console.log(`${base}:${linea}  EXACTO     ${indice.get(hs)[0]}  stroke=${sw}${dl ? ' data-lucide=' + dl : ' (sin data-lucide)'}`);
            } else {
                mal++;
                const t = tokens(nodos);
                let mejor = null, ms = 0;
                for (const ic of todos) {
                    const u = tokens(ic.nodos);
                    let c = 0;
                    for (const x of t) if (u.has(x)) c++;
                    const sc = c / (t.size + u.size - c || 1);
                    if (sc > ms) { ms = sc; mejor = ic.nombre; }
                }
                console.log(`${base}:${linea}  DIFIERE     parecido a ${mejor} (${Math.round(ms * 100)} %)  stroke=${sw}${dl ? ' data-lucide=' + dl : ''}`);
            }
        }
    }
    console.log(`${ok} exactos, ${mal} difieren de Lucide ${VERSION}`);
} else if (modo === 'verify') {
    if (!pos.length) fallo('Uso: --verify archivo.html [...] [--strict]', 2);
    let errores = 0;
    let revisados = 0;
    let sinData = 0;
    for (const f of pos) {
        const h = fs.readFileSync(f, 'utf8');
        const base = path.basename(f);
        for (const m of h.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g)) {
            const attrs = m[1];
            const linea = h.slice(0, m.index).split('\n').length;
            const dl = attrs.match(/data-lucide="([^"]+)"/);
            const es24 = /viewBox="0 0 24 24"/.test(attrs);
            if (!dl) {
                if (es24) {
                    sinData++;
                    if (flags.strict) {
                        errores++;
                        console.log(`${base}:${linea}  SIN data-lucide (svg 24x24 a mano o de otra version)`);
                    }
                }
                continue;
            }
            revisados++;
            const ic = cargarIcono(dl[1]);
            if (!ic) {
                errores++;
                console.log(`${base}:${linea}  data-lucide="${dl[1]}" NO existe en Lucide ${VERSION}`);
                continue;
            }
            const nodos = parsearHijosSvg(m[2]);
            if (!mismoContenido(nodos, ic.nodos)) {
                errores++;
                console.log(`${base}:${linea}  data-lucide="${dl[1]}" NO coincide con Lucide ${VERSION} (hash ${hashNodos(nodos)} vs ${hashNodos(ic.nodos)})`);
            }
            const sw = attrs.match(/stroke-width="([\d.]+)"/);
            const w = attrs.match(/\bwidth="([\d.]+)"/);
            if (sw && (Number(sw[1]) < 1.25 || Number(sw[1]) > 3.5)) console.log(`${base}:${linea}  aviso: stroke-width=${sw[1]} fuera de 1.25-3.5`);
            if (w && Number(w[1]) < 28) console.log(`${base}:${linea}  aviso: width=${w[1]} < 28 px (poco legible a 1080p)`);
        }
    }
    console.log(`verificados ${revisados} svg con data-lucide, ${errores} error(es)${sinData ? `, ${sinData} svg 24x24 sin data-lucide` : ''}  (lucide ${VERSION})`);
    process.exit(errores ? 1 : 0);
} else {
    // modo normal: uno o varios nombres
    const o = opcionesDeFlags();
    let mal = 0;
    for (const p of pos) {
        const ic = cargarIcono(p);
        if (!ic) {
            mal++;
            console.error(`"${p}" no existe en Lucide ${VERSION}. Parecidos: ${sugerir(p).join(', ') || '(ninguno)'}`);
            continue;
        }
        console.log(generarSvg(ic, o));
    }
    process.exit(mal ? 1 : 0);
}
