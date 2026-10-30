// Genera los diagramas entidad-relacion de SUSAN (SVG + PNG) leyendo el grafo REAL de llaves foraneas
// de la base de datos. No usa graphviz: las cajas se acomodan en una rejilla definida abajo y las lineas se
// trazan con un enrutador ortogonal propio (A* sobre una cuadricula) que esquiva las cajas.
//
// Uso:  node generar-er.mjs            -> er-*.svg y er-*.png
//       node generar-er.mjs --sin-png  -> solo SVG
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS, areaDe, consultaJson, SQL_COLUMNAS, SQL_RESTRICCIONES, tipoCorto } from './bd-lib.mjs';
import { renderizarPng, cerrarNavegador } from './renderizar-png.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SIN_PNG = process.argv.includes('--sin-png');

// ------------------------------------------------------------------------------------------------
// 1. Modelo leido de la BD
// ------------------------------------------------------------------------------------------------
const columnasBd = consultaJson(SQL_COLUMNAS);
const restricciones = consultaJson(SQL_RESTRICCIONES);
const nombresTablas = [...new Set(restricciones.filter((r) => r.tipo === 'p').map((r) => r.tabla))].sort();

const modelo = {};
for (const t of nombresTablas) {
    const cols = columnasBd.filter((c) => c.tabla === t).map((c) => ({
        nombre: c.columna, tipo: tipoCorto(c.tipo), nulo: c.admite_nulo, pk: false, fk: false, uq: false,
    }));
    const rest = restricciones.filter((r) => r.tabla === t);
    for (const r of rest) {
        for (const cn of r.columnas || []) {
            const col = cols.find((c) => c.nombre === cn);
            if (r.tipo === 'p') col.pk = true;
            if (r.tipo === 'f') col.fk = true;
            if (r.tipo === 'u' && r.columnas.length === 1) col.uq = true;
        }
    }
    modelo[t] = {
        nombre: t,
        area: areaDe(t),
        cols,
        uqCompuestos: rest.filter((r) => r.tipo === 'u' && r.columnas.length > 1).map((r) => r.columnas),
    };
}
const fks = restricciones.filter((r) => r.tipo === 'f').map((r) => {
    const hijo = modelo[r.tabla];
    const unicoSolo = restricciones.some((u) => u.tabla === r.tabla && (u.tipo === 'u' || u.tipo === 'p')
        && u.columnas.length === r.columnas.length && u.columnas.every((c) => r.columnas.includes(c)));
    return {
        nombre: r.nombre, hijo: r.tabla, padre: r.tabla_destino, columnas: r.columnas, columnasPadre: r.columnas_destino,
        nulo: r.columnas.some((c) => hijo.cols.find((x) => x.nombre === c).nulo),
        unicoEnHijo: unicoSolo,
        entreAreas: modelo[r.tabla].area.id !== modelo[r.tabla_destino].area.id,
    };
});
const totalCols = Object.values(modelo).reduce((n, t) => n + t.cols.length, 0);

// ------------------------------------------------------------------------------------------------
// 2. Estilo
// ------------------------------------------------------------------------------------------------
const COLORES = {
    A: { oscuro: '#3d5a80', claro: '#eaf0f7' },
    B: { oscuro: '#3f7d6e', claro: '#e8f3f0' },
    C: { oscuro: '#8a5a2b', claro: '#f6eee4' },
    D: { oscuro: '#6b4e8a', claro: '#f0ebf6' },
    ghost: { oscuro: '#9aa3ad', claro: '#f5f6f7' },
};
const TINTA = '#1d2733';
const TENUE = '#5d6876';
const LINEA = '#4a5563';
const FUENTE = "'DejaVu Sans Mono', 'Liberation Mono', monospace";
const FUENTE_TEXTO = "'DejaVu Sans', 'Liberation Sans', sans-serif";
const ANCHO_CAR = 0.602; // avance de DejaVu Sans Mono, en em

// ------------------------------------------------------------------------------------------------
// 3. Definicion de los diagramas (rejilla col/fila; dx/dy ajustan en px)
// ------------------------------------------------------------------------------------------------
const DIAGRAMAS = [
    {
        id: 'general',
        titulo: 'Vista general: las 20 tablas y sus 26 llaves foráneas',
        modo: 'compacto',
        fs: 12, gapX: 64, gapY: 44,
        // Posiciones halladas por recocido simulado (ver acomodarAuto): minimizan largo de aristas, cruces y
        // aristas que atraviesan otras cajas, y mantienen juntas las tablas de una misma area.
        auto: { cols: 5, filas: 5, semilla: 11, intentos: 12 },
        nodos: [],
    },
];

// Recocido simulado sobre una rejilla cols x filas. Determinista (PRNG con semilla).
function acomodarAuto({ cols, filas, semilla }) {
    const nombres = nombresTablas;
    const idx = Object.fromEntries(nombres.map((n, i) => [n, i]));
    const aristas = fks.map((f) => [idx[f.hijo], idx[f.padre]]);
    const celdas = cols * filas;
    const areaIdx = nombres.map((n) => AREAS.findIndex((a) => a.id === modelo[n].area.id));
    const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pos = (celda) => [celda % cols, Math.floor(celda / cols)];
    const cruza = (p1, p2, p3, p4) => {
        const o = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        const d1 = o(p3, p4, p1); const d2 = o(p3, p4, p2); const d3 = o(p1, p2, p3); const d4 = o(p1, p2, p4);
        return d1 * d2 < 0 && d3 * d4 < 0;
    };
    const distPuntoSegmento = (p, a, b) => {
        const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l2 = dx * dx + dy * dy || 1;
        let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2; t = Math.max(0, Math.min(1, t));
        return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    };
    const costo = (asig) => {
        const P = asig.map(pos);
        let c = 0;
        for (const [h, p] of aristas) c += Math.abs(P[h][0] - P[p][0]) + Math.abs(P[h][1] - P[p][1]);
        for (let i = 0; i < aristas.length; i++) {
            const [a, b] = aristas[i];
            for (let j = i + 1; j < aristas.length; j++) {
                const [d, e] = aristas[j];
                if (a === d || a === e || b === d || b === e) continue;
                if (cruza(P[a], P[b], P[d], P[e])) c += 5;
            }
            for (let k = 0; k < nombres.length; k++) {
                if (k === a || k === b) continue;
                if (distPuntoSegmento(P[k], P[a], P[b]) < 0.55) c += 10;
            }
        }
        for (let ar = 0; ar < AREAS.length; ar++) {
            const m = P.filter((_, i) => areaIdx[i] === ar);
            const cx = m.reduce((n, q) => n + q[0], 0) / m.length; const cy = m.reduce((n, q) => n + q[1], 0) / m.length;
            for (const q of m) c += 0.6 * Math.hypot(q[0] - cx, q[1] - cy);
        }
        return c;
    };
    let mejor = null; let mejorCosto = Infinity;
    for (let reinicio = 0; reinicio < 3; reinicio++) {
        const rnd = mulberry(semilla * 1000 + reinicio);
        const libres = [...Array(celdas).keys()];
        for (let i = libres.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [libres[i], libres[j]] = [libres[j], libres[i]]; }
        let asig = libres.slice(0, nombres.length);
        let actual = costo(asig);
        const N = 40000;
        for (let it = 0; it < N; it++) {
            const T = 6 * Math.pow(0.02 / 6, it / N);
            const i = Math.floor(rnd() * nombres.length);
            const destino = Math.floor(rnd() * celdas);
            const j = asig.indexOf(destino);
            const previo = asig[i];
            if (j >= 0) { asig[j] = previo; }
            asig[i] = destino;
            const c = costo(asig);
            if (c <= actual || rnd() < Math.exp((actual - c) / T)) actual = c;
            else { asig[i] = previo; if (j >= 0) asig[j] = destino; }
        }
        if (actual < mejorCosto) { mejorCosto = actual; mejor = asig.slice(); }
    }
    // Compacta: elimina columnas y filas vacias para no dejar huecos.
    const P = mejor.map(pos);
    const usadasC = [...new Set(P.map((q) => q[0]))].sort((a, b) => a - b);
    const usadasF = [...new Set(P.map((q) => q[1]))].sort((a, b) => a - b);
    console.log(`Recocido simulado: costo ${mejorCosto.toFixed(1)}`);
    return nombres.map((n, i) => ({ t: n, c: usadasC.indexOf(P[i][0]), r: usadasF.indexOf(P[i][1]) }));
}

// Diagramas por area: se dibujan todas las columnas de cada tabla; las tablas de otras areas a las que
// apunta una llave foranea aparecen como cajas "fantasma" (solo nombre y llave primaria).
const POR_AREA = [
    {
        id: 'a-academico', area: 'A',
        titulo: 'Área A · Catálogo académico',
        gapX: 90, gapY: 60,
        nodos: [
            { t: 'materia', c: 0, r: 0 }, { t: 'docente', c: 0, r: 1 }, { t: 'aula', c: 0, r: 2 },
            { t: 'grupo', c: 1, r: 1 },
            { t: 'horario_grupo', c: 2, r: 0 }, { t: 'inscripcion', c: 2, r: 2 },
            { t: 'alumno', c: 3, r: 2 },
        ],
    },
    {
        id: 'b-operacion', area: 'B',
        titulo: 'Área B · Operación de la clase',
        gapX: 90, gapY: 60,
        nodos: [
            { t: 'grupo', c: 0, r: 0, ghost: true }, { t: 'sesion_clase', c: 0, r: 1 },
            { t: 'asistencia', c: 1, r: 1 }, { t: 'alumno', c: 1, r: 2.1, ghost: true },
            { t: 'justificante', c: 2, r: 1 }, { t: 'usuario', c: 2, r: 0, ghost: true, dy: -10 },
        ],
    },
    {
        id: 'c-biometria', area: 'C',
        titulo: 'Área C · Captura y módulo biométrico',
        gapX: 80, gapY: 56,
        nodos: [
            { t: 'alumno', c: 1.5, r: 0, ghost: true },
            { t: 'consentimiento', c: 1, r: 1 }, { t: 'plantilla_facial', c: 2, r: 1 }, { t: 'plantilla_foto', c: 3, r: 1 },
            { t: 'indice_faiss', c: 0, r: 2 }, { t: 'deteccion', c: 2, r: 2 },
            { t: 'captura', c: 2, r: 3 }, { t: 'camara', c: 1, r: 3 }, { t: 'aula', c: 0, r: 3, ghost: true },
            { t: 'sesion_clase', c: 3, r: 3, ghost: true },
        ],
    },
    {
        id: 'd-seguridad', area: 'D',
        titulo: 'Área D · Seguridad y configuración',
        gapX: 90, gapY: 60,
        nodos: [
            { t: 'docente', c: 0, r: 0, ghost: true }, { t: 'alumno', c: 0, r: 2, ghost: true },
            { t: 'usuario', c: 1, r: 1 },
            { t: 'bitacora_auditoria', c: 2, r: 0 }, { t: 'parametro_sistema', c: 2, r: 2 },
        ],
    },
];
for (const d of POR_AREA) { d.modo = 'detallado'; d.fs = 12.5; }

// ------------------------------------------------------------------------------------------------
// 4. Cajas
// ------------------------------------------------------------------------------------------------
const ALTO_ENC = 28;
const ALTO_FILA = 18;
const PAD = 9;

function construirCaja(nodo, diag) {
    const t = modelo[nodo.t];
    const fs = diag.fs;
    const cw = fs * ANCHO_CAR;
    const fantasma = Boolean(nodo.ghost);
    let filas = [];
    let pie = null;
    if (diag.modo === 'compacto' || fantasma) {
        const pks = t.cols.filter((c) => c.pk);
        const fksc = fantasma ? [] : t.cols.filter((c) => c.fk && !c.pk);
        filas = [...pks, ...fksc].map((c) => ({ col: c, tag: c.pk ? 'PK' : 'FK', texto: c.nombre }));
        const ocultas = t.cols.length - filas.length;
        if (!fantasma && ocultas > 0) pie = `+ ${ocultas} columna${ocultas === 1 ? '' : 's'} más`;
        if (fantasma) pie = null;
    } else {
        filas = t.cols.map((c) => ({
            col: c,
            tag: [c.pk ? 'PK' : null, c.fk ? 'FK' : null, c.uq ? 'UQ' : null].filter(Boolean).join(','),
            texto: c.nombre + (c.nulo ? '?' : ''),
            tipo: c.tipo,
        }));
    }
    const pieUq = (diag.modo === 'detallado' && !fantasma)
        ? t.uqCompuestos.map((u) => `UQ (${u.join(', ')})`) : [];
    // Anchos (en caracteres)
    const anchoTag = diag.modo === 'detallado' && !fantasma ? 6 : 3;
    const anchoNombre = Math.max(...filas.map((f) => f.texto.length), 0);
    const anchoTipo = diag.modo === 'detallado' && !fantasma ? Math.max(...filas.map((f) => f.tipo.length), 0) : 0;
    const lineaMax = Math.max(
        anchoTag + anchoNombre + (anchoTipo ? 2 + anchoTipo : 0),
        ...(pie ? [pie.length] : []),
        ...pieUq.map((s) => s.length),
    );
    const anchoEnc = (t.nombre.length + 1) * (fs + 1) * ANCHO_CAR;
    const w = Math.ceil(Math.max(lineaMax * cw + 2 * PAD, anchoEnc + 2 * PAD, 150));
    const numPie = (pie ? 1 : 0) + pieUq.length;
    const h = ALTO_ENC + filas.length * ALTO_FILA + (numPie ? numPie * ALTO_FILA + 2 : 0) + 8;
    return { nombre: t.nombre, area: t.area, fantasma, filas, pie, pieUq, w, h, anchoTag, anchoNombre, fs, cw };
}

// ------------------------------------------------------------------------------------------------
// 5. Distribucion en rejilla
// ------------------------------------------------------------------------------------------------
const MARGEN = 40;
const ALTO_TITULO = 64;
const ALTO_LEYENDA = 165;
const ANCHO_MIN = 1300;

function distribuir(diag) {
    const cajas = diag.nodos.map((n) => ({ ...construirCaja(n, diag), nodo: n }));
    const maxC = Math.max(...diag.nodos.map((n) => Math.ceil(n.c)));
    const maxR = Math.max(...diag.nodos.map((n) => Math.ceil(n.r)));
    const colW = Array(maxC + 1).fill(0);
    const rowH = Array(maxR + 1).fill(0);
    for (const b of cajas) {
        const c = Math.round(b.nodo.c); const r = Math.round(b.nodo.r);
        colW[c] = Math.max(colW[c], b.w);
        rowH[r] = Math.max(rowH[r], b.h);
    }
    for (let i = 0; i <= maxC; i++) if (!colW[i]) colW[i] = 150;
    for (let i = 0; i <= maxR; i++) if (!rowH[i]) rowH[i] = 80;
    const izq = []; const sup = [];
    let x = MARGEN; for (let i = 0; i <= maxC; i++) { izq[i] = x; x += colW[i] + diag.gapX; }
    let y = MARGEN + ALTO_TITULO; for (let i = 0; i <= maxR; i++) { sup[i] = y; y += rowH[i] + diag.gapY; }
    const interp = (arr, tam, v) => {
        const i0 = Math.floor(v); const f = v - i0;
        const c0 = arr[i0] + tam[i0] / 2;
        if (f === 0) return c0;
        const c1 = arr[i0 + 1] + tam[i0 + 1] / 2;
        return c0 + (c1 - c0) * f;
    };
    for (const b of cajas) {
        b.x = Math.round(interp(izq, colW, b.nodo.c) - b.w / 2 + (b.nodo.dx || 0));
        b.y = Math.round(interp(sup, rowH, b.nodo.r) - b.h / 2 + (b.nodo.dy || 0));
    }
    let ancho = Math.max(...cajas.map((b) => b.x + b.w)) + MARGEN + 30;
    const alto = Math.max(...cajas.map((b) => b.y + b.h)) + ALTO_LEYENDA;
    if (ancho < ANCHO_MIN) {
        // La leyenda necesita ancho minimo: se centra el contenido.
        const desp = Math.round((ANCHO_MIN - ancho) / 2);
        for (const b of cajas) b.x += desp;
        ancho = ANCHO_MIN;
    }
    return { cajas, ancho: Math.ceil(ancho), alto: Math.ceil(alto) };
}

// ------------------------------------------------------------------------------------------------
// 6. Enrutador ortogonal (A*)
// ------------------------------------------------------------------------------------------------
const PASO = 4;
const SALIDA = 26; // largo del tramo recto junto a la caja (cabe el pie de gallo)
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // arriba, derecha, abajo, izquierda
const NORMAL = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };

class Cola {
    constructor() { this.a = []; }
    get length() { return this.a.length; }
    push(p, v) {
        const a = this.a; a.push([p, v]); let i = a.length - 1;
        while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; }
    }
    pop() {
        const a = this.a; const top = a[0]; const last = a.pop();
        if (a.length) {
            a[0] = last; let i = 0;
            for (;;) {
                let l = 2 * i + 1; const r = l + 1; let m = i;
                if (l < a.length && a[l][0] < a[m][0]) m = l;
                if (r < a.length && a[r][0] < a[m][0]) m = r;
                if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m;
            }
        }
        return top;
    }
}

class Enrutador {
    constructor(ancho, alto, cajas) {
        this.cols = Math.ceil(ancho / PASO); this.filas = Math.ceil(alto / PASO);
        this.bloq = new Uint8Array(this.cols * this.filas);
        this.uso = new Uint8Array(this.cols * this.filas);
        const m = 10;
        for (const b of cajas) {
            const x1 = Math.floor((b.x - m) / PASO); const x2 = Math.ceil((b.x + b.w + m) / PASO);
            const y1 = Math.floor((b.y - m) / PASO); const y2 = Math.ceil((b.y + b.h + m) / PASO);
            for (let y = Math.max(0, y1); y < Math.min(this.filas, y2); y++) {
                for (let x = Math.max(0, x1); x < Math.min(this.cols, x2); x++) this.bloq[y * this.cols + x] = 1;
            }
        }
    }
    celda(px, py) { return [Math.floor(px / PASO), Math.floor(py / PASO)]; }
    centro(cx, cy) { return [(cx + 0.5) * PASO, (cy + 0.5) * PASO]; }
    // Devuelve la lista de celdas [cx, cy] o null.
    buscar(s, e, dirInicial) {
        const { cols, filas } = this;
        const idx = (x, y) => y * cols + x;
        const n = cols * filas * 4;
        const g = new Float32Array(n).fill(Infinity);
        const padre = new Int32Array(n).fill(-1);
        const cola = new Cola();
        const h = (x, y) => Math.abs(x - e[0]) + Math.abs(y - e[1]);
        const s0 = idx(s[0], s[1]) * 4 + dirInicial;
        g[s0] = 0; cola.push(h(s[0], s[1]), s0);
        const objetivo = idx(e[0], e[1]);
        while (cola.length) {
            const [, estado] = cola.pop();
            const dir = estado % 4; const c = (estado - dir) / 4;
            if (c === objetivo) {
                const ruta = []; let cur = estado;
                while (cur !== -1) { const d = cur % 4; const cc = (cur - d) / 4; ruta.push([cc % cols, Math.floor(cc / cols)]); cur = padre[cur]; }
                return ruta.reverse();
            }
            const cx = c % cols; const cy = Math.floor(c / cols);
            for (let nd = 0; nd < 4; nd++) {
                if ((nd + 2) % 4 === dir) continue; // sin giro de 180 grados
                const nx = cx + DIR[nd][0]; const ny = cy + DIR[nd][1];
                if (nx < 0 || ny < 0 || nx >= cols || ny >= filas) continue;
                const ci = idx(nx, ny);
                if (this.bloq[ci] && ci !== objetivo) continue;
                const costo = g[estado] + 1 + (nd !== dir ? 7 : 0) + this.uso[ci] * 8;
                const ns = ci * 4 + nd;
                if (costo < g[ns]) { g[ns] = costo; padre[ns] = estado; cola.push(costo + h(nx, ny), ns); }
            }
        }
        return null;
    }
    marcar(ruta) { for (const [x, y] of ruta) { const i = y * this.cols + x; this.uso[i] = Math.min(255, this.uso[i] + 1); } }
    liberar(cx, cy) { this.bloq[cy * this.cols + cx] = 0; }
}

// ------------------------------------------------------------------------------------------------
// 7. Aristas
// ------------------------------------------------------------------------------------------------
function filaCentro(b, nombreColumna) {
    const i = b.filas.findIndex((f) => f.col.nombre === nombreColumna);
    const k = i < 0 ? 0 : i;
    return b.y + ALTO_ENC + k * ALTO_FILA + ALTO_FILA / 2;
}

function elegirLados(hijo, padre) {
    if (hijo.x + hijo.w + 56 <= padre.x) return ['right', 'left'];
    if (padre.x + padre.w + 56 <= hijo.x) return ['left', 'right'];
    if (hijo.y + hijo.h + 56 <= padre.y) return ['bottom', 'top'];
    if (padre.y + padre.h + 56 <= hijo.y) return ['top', 'bottom'];
    return ['right', 'right'];
}

function trazarAristas(diag, lay) {
    const porNombre = Object.fromEntries(lay.cajas.map((b) => [b.nombre, b]));
    const nombresVisibles = new Set(lay.cajas.map((b) => b.nombre));
    // Cada llave foranea se dibuja en el diagrama del hijo; el padre debe estar presente.
    const aristas = fks
        .filter((f) => nombresVisibles.has(f.hijo) && nombresVisibles.has(f.padre))
        .filter((f) => !(porNombre[f.hijo].fantasma))
        .map((f) => ({ ...f, caja_h: porNombre[f.hijo], caja_p: porNombre[f.padre] }));
    for (const a of aristas) {
        const forzado = diag.lados && diag.lados[`${a.hijo}.${a.nombre}`];
        [a.ladoH, a.ladoP] = forzado || elegirLados(a.caja_h, a.caja_p);
    }
    // Reparto de puertos: varias lineas en el mismo lado de una caja.
    const grupos = new Map();
    for (const a of aristas) {
        for (const [rol, lado] of [['h', a.ladoH], ['p', a.ladoP]]) {
            const caja = rol === 'h' ? a.caja_h : a.caja_p;
            const clave = `${caja.nombre}|${lado}`;
            if (!grupos.has(clave)) grupos.set(clave, []);
            grupos.get(clave).push({ a, rol });
        }
    }
    for (const [clave, lista] of grupos) {
        const lado = clave.split('|')[1];
        lista.forEach((it, k) => { it.a['idx_' + it.rol] = k; it.a['n_' + it.rol] = lista.length; });
        if (lado === 'top' || lado === 'bottom') {
            lista.sort((u, v) => {
                const xo = (it) => { const o = it.rol === 'h' ? it.a.caja_p : it.a.caja_h; return o.x + o.w / 2; };
                return xo(u) - xo(v);
            });
            lista.forEach((it, k) => { it.a['idx_' + it.rol] = k; });
        }
    }
    const puerto = (a, rol) => {
        const caja = rol === 'h' ? a.caja_h : a.caja_p;
        const lado = rol === 'h' ? a.ladoH : a.ladoP;
        const k = a['idx_' + rol]; const n = a['n_' + rol];
        const col = rol === 'h' ? a.columnas[0] : a.columnasPadre[0];
        let x; let y;
        if (lado === 'left' || lado === 'right') {
            y = filaCentro(caja, col);
            if (rol === 'p' && n > 1) y += (k - (n - 1) / 2) * 12;
            x = lado === 'left' ? caja.x : caja.x + caja.w;
        } else {
            x = caja.x + caja.w * (k + 1) / (n + 1);
            y = lado === 'top' ? caja.y : caja.y + caja.h;
        }
        return { x, y, lado, normal: NORMAL[lado] };
    };
    const ruta = new Enrutador(lay.ancho, lay.alto, lay.cajas);
    // Orden: aristas cortas primero.
    const pares = aristas.map((a) => ({ a, ph: puerto(a, 'h'), pp: puerto(a, 'p') }));
    pares.sort((u, v) => (Math.abs(u.ph.x - u.pp.x) + Math.abs(u.ph.y - u.pp.y)) - (Math.abs(v.ph.x - v.pp.x) + Math.abs(v.ph.y - v.pp.y)));
    const snap = (v) => (Math.floor(v / PASO) + 0.5) * PASO;
    for (const { a, ph, pp } of pares) {
        // Puertos con la coordenada perpendicular alineada a la cuadricula para que el tramo de salida sea recto.
        const fijar = (p) => {
            if (p.lado === 'left' || p.lado === 'right') p.y = snap(p.y); else p.x = snap(p.x);
            p.fuera = { x: snap(p.x + p.normal[0] * SALIDA), y: snap(p.y + p.normal[1] * SALIDA) };
            if (p.lado === 'left' || p.lado === 'right') p.fuera.y = p.y; else p.fuera.x = p.x;
        };
        fijar(ph); fijar(pp);
        const sCel = ruta.celda(ph.fuera.x, ph.fuera.y); const eCel = ruta.celda(pp.fuera.x, pp.fuera.y);
        // Libera la salida y el tramo hasta la caja.
        for (const [p, cel] of [[ph, sCel], [pp, eCel]]) {
            const desde = ruta.celda(p.x, p.y);
            const pasos = Math.max(Math.abs(cel[0] - desde[0]), Math.abs(cel[1] - desde[1]));
            for (let i = 0; i <= pasos + 1; i++) {
                ruta.liberar(desde[0] + Math.sign(cel[0] - desde[0]) * i, desde[1] + Math.sign(cel[1] - desde[1]) * i);
            }
            ruta.liberar(cel[0], cel[1]);
        }
        const dirInicial = DIR.findIndex((d) => d[0] === ph.normal[0] && d[1] === ph.normal[1]);
        const celdas = ruta.buscar(sCel, eCel, dirInicial);
        if (!celdas) { console.warn('SIN RUTA:', a.hijo, '->', a.padre, a.nombre); a.puntos = [[ph.x, ph.y], [pp.x, pp.y]]; a.ph = ph; a.pp = pp; continue; }
        ruta.marcar(celdas);
        // Polilinea: puerto, salida, esquinas, salida del padre, puerto padre
        const pts = [[ph.x, ph.y], ...celdas.map(([cx, cy]) => ruta.centro(cx, cy)), [pp.x, pp.y]];
        // Alinea los extremos de las salidas con los puertos (misma coordenada perpendicular).
        pts[1] = [ph.fuera.x, ph.fuera.y]; pts[pts.length - 2] = [pp.fuera.x, pp.fuera.y];
        // Elimina puntos colineales
        const lim = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
            const [x0, y0] = lim[lim.length - 1]; const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1];
            if ((x0 === x1 && x1 === x2) || (y0 === y1 && y1 === y2)) continue;
            if (x0 === x1 && y0 === y1) continue;
            lim.push(pts[i]);
        }
        lim.push(pts[pts.length - 1]);
        a.puntos = lim; a.ph = ph; a.pp = pp;
    }
    return aristas;
}

// ------------------------------------------------------------------------------------------------
// 8. SVG
// ------------------------------------------------------------------------------------------------
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Simbolos de cardinalidad en el extremo (x, y) con normal saliente (nx, ny).
function simbolo(x, y, [nx, ny], tipo, esc_ = 1) {
    const tx = -ny; const ty = nx;
    const P = (d, o = 0) => [x + nx * d * esc_ + tx * o * esc_, y + ny * d * esc_ + ty * o * esc_];
    const linea = (p, q) => `<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}"/>`;
    const circ = (d) => { const c = P(d); return `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(4 * esc_)}" fill="#fff"/>`; };
    const barra = (d) => linea(P(d, 5), P(d, -5));
    switch (tipo) {
        case 'muchos0': // cero o muchos: pie de gallo + circulo
            return linea(P(12, 0), P(0, 6.5)) + linea(P(12, 0), P(0, 0)) + linea(P(12, 0), P(0, -6.5)) + circ(17.5);
        case 'uno': // uno y solo uno: dos barras
            return barra(7) + barra(12);
        case 'uno0': // cero o uno: barra + circulo
            return barra(7) + circ(13.5);
        default: return '';
    }
}

function svgCaja(b, diag) {
    const ar = b.fantasma ? COLORES.ghost : COLORES[b.area.id];
    const g = [];
    const dash = b.fantasma ? ' stroke-dasharray="5 3"' : '';
    g.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="5" fill="${ar.claro}" stroke="${ar.oscuro}" stroke-width="1.4"${dash}/>`);
    // Encabezado (redondeado arriba)
    g.push(`<path d="M${b.x} ${b.y + ALTO_ENC} V${b.y + 5} Q${b.x} ${b.y} ${b.x + 5} ${b.y} H${b.x + b.w - 5} Q${b.x + b.w} ${b.y} ${b.x + b.w} ${b.y + 5} V${b.y + ALTO_ENC} Z" fill="${ar.oscuro}"/>`);
    const colorTitulo = b.fantasma ? '#ffffff' : '#ffffff';
    g.push(`<text x="${b.x + PAD}" y="${b.y + 19}" font-family="${FUENTE}" font-size="${b.fs + 1}" font-weight="700" fill="${colorTitulo}">${esc(b.nombre)}</text>`);
    if (b.fantasma) {
        g.push(`<text x="${b.x + b.w - PAD}" y="${b.y + 19}" text-anchor="end" font-family="${FUENTE_TEXTO}" font-size="10" fill="#ffffff">${b.area.id}</text>`);
    }
    b.filas.forEach((f, i) => {
        const yy = b.y + ALTO_ENC + i * ALTO_FILA + 13;
        const colorTag = f.col.pk ? TINTA : (f.col.fk ? '#1f4e79' : '#7a4a00');
        if (f.tag) g.push(`<text x="${b.x + PAD}" y="${yy}" font-family="${FUENTE}" font-size="${b.fs - 1.5}" font-weight="700" fill="${colorTag}">${esc(f.tag)}</text>`);
        const xNombre = b.x + PAD + b.anchoTag * b.cw;
        g.push(`<text x="${xNombre}" y="${yy}" font-family="${FUENTE}" font-size="${b.fs}" font-weight="${f.col.pk ? 700 : 400}" fill="${TINTA}">${esc(f.texto)}</text>`);
        if (f.tipo) g.push(`<text x="${b.x + b.w - PAD}" y="${yy}" text-anchor="end" font-family="${FUENTE}" font-size="${b.fs - 1}" fill="${TENUE}">${esc(f.tipo)}</text>`);
        if (i > 0 && !b.fantasma) { /* separador suave entre filas no necesario */ }
    });
    let yPie = b.y + ALTO_ENC + b.filas.length * ALTO_FILA + 2;
    if (b.pieUq.length || b.pie) {
        g.push(`<line x1="${b.x + 6}" y1="${yPie}" x2="${b.x + b.w - 6}" y2="${yPie}" stroke="${ar.oscuro}" stroke-opacity="0.35" stroke-width="1"/>`);
    }
    for (const u of [...b.pieUq, ...(b.pie ? [b.pie] : [])]) {
        yPie += ALTO_FILA;
        g.push(`<text x="${b.x + PAD}" y="${yPie - 5}" font-family="${FUENTE}" font-size="${b.fs - 1.5}" font-style="italic" fill="${TENUE}">${esc(u)}</text>`);
    }
    return g.join('\n');
}

function svgArista(a, esc_) {
    const pts = a.puntos.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');
    const dash = a.entreAreas ? ' stroke-dasharray="6 4"' : '';
    const tipoH = a.unicoEnHijo ? 'uno0' : 'muchos0';
    const tipoP = a.nulo ? 'uno0' : 'uno';
    return `<g stroke="${LINEA}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round">
<polyline points="${pts}"${dash}/>
${simbolo(a.ph.x, a.ph.y, a.ph.normal, tipoH, esc_)}
${simbolo(a.pp.x, a.pp.y, a.pp.normal, tipoP, esc_)}
</g>`;
}

function svgLeyenda(diag, lay, yBase) {
    const g = [];
    const x0 = MARGEN;
    const sz = 12;
    g.push(`<line x1="${x0}" y1="${yBase}" x2="${lay.ancho - MARGEN}" y2="${yBase}" stroke="#c9ced6" stroke-width="1"/>`);
    const y0 = yBase + 28;
    // Ejemplos de cardinalidad (linea con simbolos en cada extremo)
    const ej = (y, tipoH, tipoP, texto) => {
        const xi = x0 + 30; const xf = xi + 78;
        return `<g stroke="${LINEA}" stroke-width="1.3" fill="none" stroke-linecap="round"><line x1="${xi}" y1="${y}" x2="${xf}" y2="${y}"/>${simbolo(xi, y, [1, 0], tipoH, 1)}${simbolo(xf, y, [-1, 0], tipoP, 1)}</g>
<text x="${xf + 16}" y="${y + 4}" font-family="${FUENTE_TEXTO}" font-size="${sz}" fill="${TINTA}">${esc(texto)}</text>`;
    };
    g.push(ej(y0, 'muchos0', 'uno', 'FK obligatoria: el padre es exactamente uno; el hijo, cero o muchos (1:N)'));
    g.push(ej(y0 + 24, 'muchos0', 'uno0', 'FK que admite nulo: el padre es cero o uno'));
    g.push(ej(y0 + 48, 'uno0', 'uno', 'FK única (UNIQUE) en el hijo: relación 1:0..1'));
    const xr = x0 + 700;
    g.push(`<line x1="${xr}" y1="${y0}" x2="${xr + 40}" y2="${y0}" stroke="${LINEA}" stroke-width="1.3" stroke-dasharray="6 4"/><text x="${xr + 52}" y="${y0 + 4}" font-family="${FUENTE_TEXTO}" font-size="${sz}" fill="${TINTA}">Relación entre áreas funcionales distintas</text>`);
    g.push(`<text x="${xr}" y="${y0 + 28}" font-family="${FUENTE}" font-size="${sz}" fill="${TINTA}"><tspan font-weight="700">PK</tspan> llave primaria   <tspan font-weight="700" fill="#1f4e79">FK</tspan> llave foránea   <tspan font-weight="700" fill="#7a4a00">UQ</tspan> único</text>`);
    if (diag.modo === 'detallado') {
        g.push(`<text x="${xr}" y="${y0 + 52}" font-family="${FUENTE}" font-size="${sz}" fill="${TINTA}">nombre? admite nulo   UQ (a, b) único compuesto</text>`);
    } else {
        g.push(`<text x="${xr}" y="${y0 + 52}" font-family="${FUENTE}" font-size="${sz}" fill="${TINTA}">Cada caja muestra solo PK y FK; el resto, en el diccionario.</text>`);
    }
    // Colores de area (fila propia, ancho completo)
    let xa = x0 + 30; const ya = y0 + 86;
    for (const a of AREAS) {
        g.push(`<rect x="${xa}" y="${ya - 11}" width="15" height="15" rx="2" fill="${COLORES[a.id].oscuro}"/>`);
        const txt = `${a.id} · ${a.nombre}`;
        g.push(`<text x="${xa + 22}" y="${ya + 1}" font-family="${FUENTE_TEXTO}" font-size="${sz}" fill="${TINTA}">${esc(txt)}</text>`);
        xa += 22 + txt.length * 7.2 + 28;
    }
    if (diag.nodos.some((n) => n.ghost)) {
        g.push(`<rect x="${xa}" y="${ya - 11}" width="15" height="15" rx="2" fill="${COLORES.ghost.claro}" stroke="${COLORES.ghost.oscuro}" stroke-dasharray="3 2"/>`);
        g.push(`<text x="${xa + 22}" y="${ya + 1}" font-family="${FUENTE_TEXTO}" font-size="${sz}" fill="${TINTA}">tabla de otra área (solo PK)</text>`);
    }
    return g.join('\n');
}

function svgDiagrama(diag, lay, aristas) {
    const tam = diag.modo === 'compacto' ? 0.9 : 1;
    const partes = [];
    partes.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${lay.ancho}" height="${lay.alto}" viewBox="0 0 ${lay.ancho} ${lay.alto}">`);
    partes.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
    partes.push(`<text x="${MARGEN}" y="${MARGEN + 12}" font-family="${FUENTE_TEXTO}" font-size="22" font-weight="700" fill="${TINTA}">SUSAN · Modelo entidad-relación</text>`);
    partes.push(`<text x="${MARGEN}" y="${MARGEN + 36}" font-family="${FUENTE_TEXTO}" font-size="14" fill="${TENUE}">${esc(diag.titulo)} · generado de la base de datos (PostgreSQL 16, esquema public)</text>`);
    for (const a of aristas) partes.push(svgArista(a, tam));
    for (const b of lay.cajas) partes.push(svgCaja(b, diag));
    partes.push(svgLeyenda(diag, lay, lay.alto - ALTO_LEYENDA + 30));
    partes.push('</svg>');
    return partes.join('\n');
}

// ------------------------------------------------------------------------------------------------
// 9. Principal
// ------------------------------------------------------------------------------------------------
function validar(diag, lay, aristas) {
    // Choques de cajas y recuento de aristas dibujadas.
    for (let i = 0; i < lay.cajas.length; i++) {
        for (let j = i + 1; j < lay.cajas.length; j++) {
            const a = lay.cajas[i]; const b = lay.cajas[j];
            if (a.x < b.x + b.w + 16 && b.x < a.x + a.w + 16 && a.y < b.y + b.h + 16 && b.y < a.y + a.h + 16) {
                console.warn(`  AVISO: ${diag.id}: ${a.nombre} y ${b.nombre} quedan a menos de 16 px`);
            }
        }
    }
    const sinRuta = aristas.filter((a) => !a.puntos || a.puntos.length < 2);
    if (sinRuta.length) console.warn(`  AVISO: ${diag.id}: ${sinRuta.length} aristas sin ruta`);
}

const todos = [...DIAGRAMAS, ...POR_AREA];
const generados = [];
// Puntaje de un trazado: largo + cruces entre aristas + traslapes + giros (menor es mejor).
function puntuar(aristas) {
    const segs = [];
    aristas.forEach((a, k) => {
        for (let i = 0; i < a.puntos.length - 1; i++) segs.push({ k, p: a.puntos[i], q: a.puntos[i + 1] });
    });
    let largo = 0; let giros = 0;
    for (const a of aristas) { giros += Math.max(0, a.puntos.length - 2); for (let i = 0; i < a.puntos.length - 1; i++) largo += Math.abs(a.puntos[i + 1][0] - a.puntos[i][0]) + Math.abs(a.puntos[i + 1][1] - a.puntos[i][1]); }
    let cruces = 0; let traslape = 0;
    for (let i = 0; i < segs.length; i++) {
        for (let j = i + 1; j < segs.length; j++) {
            const u = segs[i]; const v = segs[j];
            if (u.k === v.k) continue;
            const uh = u.p[1] === u.q[1]; const vh = v.p[1] === v.q[1];
            if (uh !== vh) {
                const h = uh ? u : v; const w = uh ? v : u;
                const x = w.p[0]; const y = h.p[1];
                if (x > Math.min(h.p[0], h.q[0]) + 1 && x < Math.max(h.p[0], h.q[0]) - 1 && y > Math.min(w.p[1], w.q[1]) + 1 && y < Math.max(w.p[1], w.q[1]) - 1) cruces++;
            } else if (uh) {
                if (Math.abs(u.p[1] - v.p[1]) < 2) traslape += Math.max(0, Math.min(Math.max(u.p[0], u.q[0]), Math.max(v.p[0], v.q[0])) - Math.max(Math.min(u.p[0], u.q[0]), Math.min(v.p[0], v.q[0])));
            } else if (Math.abs(u.p[0] - v.p[0]) < 2) {
                traslape += Math.max(0, Math.min(Math.max(u.p[1], u.q[1]), Math.max(v.p[1], v.q[1])) - Math.max(Math.min(u.p[1], u.q[1]), Math.min(v.p[1], v.q[1])));
            }
        }
    }
    return { total: largo / 20 + cruces * 12 + traslape / 6 + giros * 2, largo, cruces, traslape, giros };
}

for (const diag of todos) {
    let lay; let aristas;
    if (diag.auto) {
        // Se prueban varias semillas del recocido y se conserva el trazado con mejor puntaje real
        // (despues de enrutar), no solo el de menor costo geometrico.
        let mejor = null;
        for (let k = 0; k < diag.auto.intentos; k++) {
            const base = acomodarAuto({ ...diag.auto, semilla: diag.auto.semilla + k });
            // Variantes con las columnas escalonadas en vertical: evita que las FK de cajas vecinas queden
            // exactamente a la misma altura y sus lineas se encimen.
            for (const paso of [0, 16]) {
                diag.nodos = base.map((n) => ({ ...n, dy: paso ? ((n.c % 2) ? paso : -paso / 2) : 0 }));
                const l = distribuir(diag);
                const a = trazarAristas(diag, l);
                const pt = puntuar(a);
                console.log(`  intento ${k} (escalon ${paso}): puntaje ${pt.total.toFixed(1)} (cruces ${pt.cruces}, traslape ${Math.round(pt.traslape)}, giros ${pt.giros})`);
                if (!mejor || pt.total < mejor.pt.total) mejor = { nodos: diag.nodos, l, a, pt };
            }
        }
        diag.nodos = mejor.nodos; lay = mejor.l; aristas = mejor.a;
        const rej = {}; for (const n of diag.nodos) rej[`${n.c},${n.r}`] = n.t;
        const maxC = Math.max(...diag.nodos.map((n) => n.c)); const maxR = Math.max(...diag.nodos.map((n) => n.r));
        console.log(`Mejor trazado: puntaje ${mejor.pt.total.toFixed(1)}`);
        for (let r = 0; r <= maxR; r++) console.log('  ' + Array.from({ length: maxC + 1 }, (_, c) => (rej[`${c},${r}`] || '.').padEnd(20)).join(''));
    } else {
        lay = distribuir(diag);
        aristas = trazarAristas(diag, lay);
    }
    validar(diag, lay, aristas);
    const svg = svgDiagrama(diag, lay, aristas);
    const ruta = join(AQUI, `er-${diag.id}.svg`);
    writeFileSync(ruta, svg);
    generados.push({ id: diag.id, ruta, ancho: lay.ancho, alto: lay.alto, aristas: aristas.length, tablas: lay.cajas.filter((b) => !b.fantasma).length });
    console.log(`er-${diag.id}.svg  ${lay.ancho}x${lay.alto}  tablas=${generados.at(-1).tablas} aristas=${aristas.length}`);
}
// Comprobacion: la suma de aristas de los diagramas por area debe igualar las llaves foraneas de la BD.
const sumaAreas = generados.filter((g) => g.id !== 'general').reduce((n, g) => n + g.aristas, 0);
console.log(`FK en la BD: ${fks.length} | aristas en la vista general: ${generados[0].aristas} | suma en diagramas por area: ${sumaAreas}`);
console.log(`Tablas: ${nombresTablas.length}, columnas: ${totalCols}`);

if (!SIN_PNG) {
    for (const g of generados) {
        const png = await renderizarPng(g.ruta, g.ancho, g.alto);
        console.log(`  -> ${png.ruta}  ${png.pxAncho}x${png.pxAlto}px`);
    }
    await cerrarNavegador();
}
