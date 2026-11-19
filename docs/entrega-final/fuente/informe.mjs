import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { analizarGrupo } from '/Users/diegoguerrero/Developer/SUSAN/web/src/lib/numerics/index.js';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
    HeadingLevel, PageBreak, Footer, Header, PageNumber, BorderStyle, LevelFormat, HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom, TextWrappingType, VerticalAlign, TableLayoutType,
} = require('docx');

const DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = process.argv[2];
const CAP = '/Users/diegoguerrero/Developer/SUSAN/video/susan-v4/capture/assets';
const ASSETS = path.join(DIR, 'informe-assets');
fs.mkdirSync(ASSETS, { recursive: true });

const NAVY = '0B2461'; const GOLD = 'C8920E'; const GRAY = '6B7280'; const LINE = 'C9D2E3'; const TINT = 'EEF2F9';

// ======================= caso de estudio (mismo que presentacion y reporte) =======================
const L0 = Date.UTC(2026, 7, 17);
const fe = (w, d) => new Date(L0 + ((w - 1) * 7 + (d - 1)) * 864e5).toISOString().slice(0, 10);
const AUS = { 1: [2, 2, 3], 2: [2, 3, 4], 3: [3, 3, 5], 4: [3, 4, 5], 5: [4, 4, 6], 6: [4, 5, 7], 7: [5, 5, 8], 8: [5, 6, 8] };
const serie = [];
for (const [w, arr] of Object.entries(AUS)) {
    [1, 3, 5].forEach((d, i) => {
        const a = arr[i];
        serie.push({ id_sesion: serie.length + 1, fecha: fe(+w, d), semana_iso: 33 + +w, dia_semana: d, inscritos: 35,
            presentes: 34 - a, retardos: 1, ausentes: a, justificados: 0, pendientes: 0, tasa_ausentismo: a / 35 });
    });
}
const R = analizarGrupo({ serie, limitePct: 20, sesionesProgramadas: 48, retardosPorAusencia: 3 });
const T = R.tendencia; const AJ = T.ajuste; const P = R.proyeccion; const C = R.cruceLimite;
const [c1, c2] = P.candidatos;
const proc = (id, t) => R.procedimientos.find((p) => p.id === id).pasos.find((s) => s.titulo.startsWith(t));
const area = proc('derivacion-integracion', 'Área').tabla.filas;
const cusumP = R.cambios.cusum;
const dias = R.patronSemanal.dias;
const n = (x, d = 4) => Number(x).toFixed(d);
const pc = (x, d = 2) => (x * 100).toFixed(d);

// ======================= imagenes: logotipo, portada, graficas =======================
// El logotipo es la marca real de la app (componente BrandMark), renderizada aparte en informe-assets/logo-*.png.

// portada: fondo carta 8.5 x 11 a 200 dpi con escudo y jaguar ya compuestos
const W = 1700; const H = 2200; const k = 2; // 100 unidades por pulgada en el svg de la practica -> x2
const fondo = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 850 1100">
  <rect width="850" height="1100" fill="#${NAVY}"/>
  <path d="M850,0 L408,0 C420,40 432,120 428,150 C420,185 395,190 330,190 L210,190 Q108,190 108,292 L108,1100 L850,1100 Z" fill="#fff"/>
  <path d="M185,1100 C200,1030 300,1022 520,1026 C700,1030 820,1050 850,1100 Z" fill="#${NAVY}"/>
  <circle cx="120" cy="125" r="96" fill="#fff"/><circle cx="110" cy="1015" r="78" fill="#fff"/></svg>`;
const escudo = await sharp(path.join(DIR, 'unach.png')).resize(280 * k / 2 * 1, null).toBuffer();
const jaguar = await sharp(path.join(DIR, 'jaguar.png')).resize(127 * k, null).toBuffer();
await sharp(Buffer.from(fondo)).composite([
    { input: escudo, left: 50 * k, top: 55 * k },
    { input: jaguar, left: 47 * k, top: 950 * k },
]).png().toFile(path.join(ASSETS, 'portada.png'));

function svgLineas({ xs, series, ymax, ymin = 0, paso, w = 640, h = 280, ref }) {
    const L = 48; const Rm = 16; const Tp = 14; const B = 56;
    const X = (x) => L + ((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * (w - L - Rm);
    const Y = (y) => Tp + (1 - (y - ymin) / (ymax - ymin)) * (h - Tp - B);
    let g = '';
    for (let i = 0; ymin + i * paso <= ymax + 1e-9; i += 1) {
        const y = +(ymin + i * paso).toFixed(6);
        g += `<line x1="${L}" x2="${w - Rm}" y1="${Y(y)}" y2="${Y(y)}" stroke="#E5E7EB"/><text x="${L - 8}" y="${Y(y) + 4}" text-anchor="end">${y}</text>`;
    }
    xs.forEach((x) => { g += `<text x="${X(x)}" y="${h - B + 18}" text-anchor="middle">S${x}</text>`; });
    if (ref) g += `<line x1="${L}" x2="${w - Rm}" y1="${Y(ref.y)}" y2="${Y(ref.y)}" stroke="#B42318" stroke-dasharray="6 4" stroke-width="1.5"/><text x="${w - Rm}" y="${Y(ref.y) - 6}" text-anchor="end" fill="#B42318">${ref.label}</text>`;
    series.forEach((s) => {
        const pts = s.data.filter(([, y]) => y != null);
        g += `<polyline fill="none" stroke="${s.color}" stroke-width="${s.ancho || 2.4}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} points="${pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}"/>`;
        if (s.puntos) pts.forEach(([x, y]) => { g += `<circle cx="${X(x)}" cy="${Y(y)}" r="3.8" fill="${s.color}"/>`; });
    });
    let lx = L;
    const ley = series.filter((s) => s.nombre).map((s) => {
        const it = `<line x1="${lx}" x2="${lx + 22}" y1="${h - 12}" y2="${h - 12}" stroke="${s.color}" stroke-width="2.5" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/><text x="${lx + 28}" y="${h - 8}">${s.nombre}</text>`;
        lx += 44 + s.nombre.length * 6.4; return it;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Arial" font-size="11" fill="#374151"><rect width="${w}" height="${h}" fill="#fff"/>${g}${ley}</svg>`;
}
const sem = T.semanas; const s16 = Array.from({ length: 16 }, (_, i) => i + 1);
const pm = Object.fromEntries(P.puntos.map((p) => [p.semana, p]));
const q = C.ajuste.length ? C.ajuste : [];
const graficas = {
    tendencia: svgLineas({ xs: s16, ymax: 40, paso: 10, series: [
        { nombre: 'Tasa observada (%)', color: `#${NAVY}`, puntos: true, data: sem.map((w, i) => [w, T.tasas[i] * 100]) },
        { nombre: 'Proyección lineal', color: `#${GOLD}`, data: [[8, T.tasas[7] * 100], ...s16.filter((w) => pm[w]).map((w) => [w, pm[w].valor * 100])] },
        { nombre: 'Intervalo 95 %', color: '#9CA3AF', dash: '4 3', ancho: 1.5, data: s16.filter((w) => pm[w]).map((w) => [w, pm[w].inferior * 100]) },
        { color: '#9CA3AF', dash: '4 3', ancho: 1.5, data: s16.filter((w) => pm[w]).map((w) => [w, pm[w].superior * 100]) }] }),
    cruce: svgLineas({ xs: s16, ymax: 25, paso: 5, ref: { y: 20, label: 'Límite 20 %' }, series: [
        { nombre: 'Acumulado observado (%)', color: `#${NAVY}`, puntos: true, data: C.acumulado.semanas.map((w, i) => [w, C.acumulado.valores[i]]) },
        { nombre: 'Ajuste y proyección', color: `#${GOLD}`, dash: '6 4', data: [...q, ...C.proyeccion].map((p) => [p.semana, p.valor]) }] }),
};
for (const [nom, svg] of Object.entries(graficas)) {
    await sharp(Buffer.from(svg), { density: 220 }).png().toFile(path.join(ASSETS, `graf-${nom}.png`));
}

// ======================= helpers de docx =======================
const FONT = 'Arial';
const img = (file, wIn, alt) => {
    const meta = { w: 0, h: 0 };
    const buf = fs.readFileSync(file);
    return { buf, meta, wIn, alt };
};
async function imagen(file, wIn, alt, align = AlignmentType.CENTER) {
    const buf = fs.readFileSync(file);
    const m = await sharp(buf).metadata();
    const w = wIn * 96; const h = w * (m.height / m.width);
    return new Paragraph({ alignment: align, spacing: { before: 120, after: 60 }, keepNext: true,
        children: [new ImageRun({ type: file.endsWith('.jpg') ? 'jpg' : 'png', data: buf, transformation: { width: w, height: h }, altText: { title: alt, description: alt, name: alt } })] });
}
const p = (runs, o = {}) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 140, line: 300 }, ...o,
    children: (Array.isArray(runs) ? runs : [runs]).map((r) => (typeof r === 'string' ? new TextRun(r) : r)) });
const b = (t) => new TextRun({ text: t, bold: true });
const i = (t) => new TextRun({ text: t, italics: true });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 4 } } });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const pie = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: t, size: 17, color: GRAY })] });
const vi = (t, o = {}) => new TextRun({ text: t, font: 'Cambria Math', italics: true, size: 24, ...o });
const eq = (...runs) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 160 },
    children: runs.map((r) => (typeof r === 'string' ? vi(r) : r)) });
const sup = (t) => vi(t, { superScript: true });
const sub = (t) => vi(t, { subScript: true });
const vin = (t) => new TextRun({ text: t, bullet: undefined });
const bullet = (runs) => new Paragraph({ numbering: { reference: 'vinetas', level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 80, line: 290 },
    children: (Array.isArray(runs) ? runs : [runs]).map((r) => (typeof r === 'string' ? new TextRun(r) : r)) });
const num = (runs, ref = 'pasos') => new Paragraph({ numbering: { reference: ref, level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 80, line: 290 },
    children: (Array.isArray(runs) ? runs : [runs]).map((r) => (typeof r === 'string' ? new TextRun(r) : r)) });

const BORDE = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
function tabla(cols, filas, anchos, o = {}) {
    const total = anchos.reduce((a, c) => a + c, 0);
    const celda = (t, w, head, j, extra = {}) => new TableCell({
        width: { size: w, type: WidthType.DXA }, borders: BORDES, verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: NAVY } : (extra.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: extra.fill } : undefined),
        children: [new Paragraph({ alignment: (o.alinear?.[j] ?? (head ? AlignmentType.CENTER : AlignmentType.LEFT)),
            children: [new TextRun({ text: String(t), bold: head || extra.bold, color: head ? 'FFFFFF' : '222222', size: o.size ?? 19 })] })],
    });
    return new Table({
        width: { size: total, type: WidthType.DXA }, columnWidths: anchos, layout: TableLayoutType.FIXED, alignment: AlignmentType.CENTER,
        rows: [
            new TableRow({ tableHeader: true, children: cols.map((c, j) => celda(c, anchos[j], true, j)) }),
            ...filas.map((f, r) => new TableRow({ cantSplit: true, children: f.map((c, j) => celda(c, anchos[j], false, j, (o.fila?.(r) ?? {}))) })),
        ],
    });
}
const espacio = () => new Paragraph({ spacing: { after: 120 }, children: [] });
const codigo = (lineas) => new Table({
    width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: [new TableCell({
        width: { size: 9360, type: WidthType.DXA }, borders: BORDES, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F7FB' },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: lineas.split('\n').map((l) => new Paragraph({ spacing: { after: 0, line: 240 }, children: [new TextRun({ text: l.length ? l : ' ', font: 'Courier New', size: 16 })] })),
    })] })],
});

// ======================= portada =======================
const INTEGRANTES = [
    ['Casanova Pérez Gabriela', '100043465'],
    ['Escobar Domínguez Josué Gabriel', '100045009'],
    ['Gómez Delgado Ades Yasir', '100046136'],
    ['González Guerrero Diego Enrique', '100043425'],
    ['Peña Morales José Manuel', '100047221'],
    ['Pérez Hernández Alan Eduardo', '100046111'],
];
const portadaBuf = fs.readFileSync(path.join(ASSETS, 'portada-completa.png'));
// Portada como una sola imagen en linea: no depende de como cada procesador acomode texto flotante.
const portada = [
    new Paragraph({ spacing: { before: 0, after: 0, line: 240 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: portadaBuf,
        transformation: { width: 806, height: 1043 },
        altText: { title: 'Portada', description: 'Portada institucional UNACH del informe del proyecto final SUSAN con datos de identificación', name: 'portada' } })] }),
];

// ======================= contenido =======================
const CONC = [
    ['Casanova Pérez Gabriela', 'Este proyecto me hizo ver que los métodos numéricos son la herramienta con la que la ingeniería convierte datos en decisiones. La regresión por mínimos cuadrados, resuelta con eliminación de Gauss y pivoteo parcial, nos permitió medir con precisión cómo crece el ausentismo, y la validación cruzada nos enseñó a no confiar en un modelo solo porque su r² es alto. Llevar estos métodos a un software que usa un docente real le dio sentido a lo que vimos en clase: el resultado no es un ejercicio en papel, sino una alerta que puede cambiar la situación de un alumno.'],
    ['Escobar Domínguez Josué Gabriel', 'La parte que más me enseñó fue encontrar la semana en que el grupo alcanza el límite de faltas, un problema de raíces de una ecuación no lineal como los que aparecen en física o en ingeniería. Implementar bisección y Newton-Raphson y compararlos sobre los mismos datos dejó clara la diferencia entre convergencia lineal y cuadrática (25 iteraciones contra 3). En el desarrollo de software esto importa: un método rápido no basta si no es confiable, por eso combinamos ambos. Creo que esta forma de pensar me servirá en cualquier sistema que tenga que calcular algo de manera exacta y verificable.'],
    ['Gómez Delgado Ades Yasir', 'Trabajar con datos reales me mostró que en la ciencia y la ingeniería los datos casi nunca están completos. Las semanas sin clase dejaban huecos que resolvimos con un spline cúbico natural, y comprobamos que estimaba el valor faltante con un error menor a medio punto porcentual, mientras que un polinomio de grado alto habría oscilado. Programar los métodos de interpolación nosotros mismos, y verificar que Lagrange y Newton producen el mismo polinomio, me dio una comprensión más profunda que solo aplicar una fórmula. El software hace posible usar estos métodos todos los días y sobre miles de registros.'],
    ['González Guerrero Diego Enrique', 'Mi conclusión es que un método numérico solo es útil en un producto si se puede explicar y verificar. Por eso cada función de SUSAN devuelve sus pasos y trazas, y cada método se probó contra problemas con respuesta conocida, como Newton sobre x² − 2 o Simpson de sen(x) en [0, π], hasta sumar 110 pruebas automáticas. Integrar el módulo numérico con la base de datos, el servicio de reconocimiento facial y la interfaz me mostró cómo la ingeniería de software y los métodos numéricos se necesitan entre sí: sin el software los métodos no llegan al usuario, y sin los métodos el software solo guarda datos.'],
    ['Peña Morales José Manuel', 'La derivación y la integración numérica nos dieron dos lecturas del mismo fenómeno: qué tan rápido empeora la asistencia y cuánto ausentismo se ha acumulado. La extrapolación de Richardson y el método de Romberg mostraron cómo mejorar una aproximación sin pedir más datos, controlando el error de truncamiento con el tamaño de paso. Estas mismas ideas se usan para calcular velocidades, áreas y trabajo en ingeniería, así que aplicarlas a un problema de nuestra propia universidad me ayudó a entender por qué son parte de la formación de un ingeniero en software.'],
    ['Pérez Hernández Alan Eduardo', 'Con este proyecto entendí que los métodos numéricos y la estadística se complementan para tomar decisiones a tiempo. La carta CUSUM nos dijo desde qué semana cambió el comportamiento del grupo, y el puntaje de riesgo combina siete factores calculados con distintos métodos para señalar qué alumnos necesitan atención primero. Diseñar ese puntaje para que el docente lo entienda me hizo pensar en la responsabilidad de presentar números correctos y claros. Desarrollar software con métodos numéricos no es solo programar fórmulas: es construir una herramienta que otras personas usarán para actuar.'],
];

const CODIGO_GAUSS = `export function eliminacionGaussiana(A, b) {
    const n = validarMatrizCuadrada(A);
    const M = A.map((fila, i) => [...fila, b[i]]);   // matriz aumentada [A | b]
    for (let k = 0; k < n; k += 1) {
        // Pivoteo parcial: el mayor |a_ik| de la columna evita dividir entre números pequeños.
        let p = k;
        for (let i = k + 1; i < n; i += 1) {
            if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
        }
        if (p !== k) [M[p], M[k]] = [M[k], M[p]];
        for (let i = k + 1; i < n; i += 1) {
            const m = M[i][k] / M[k][k];
            M[i][k] = 0;
            for (let j = k + 1; j <= n; j += 1) M[i][j] -= m * M[k][j];
        }
    }
    // ... sustitución regresiva y registro de pasos
}`;
const CODIGO_BISECCION = `export function biseccion(f, a, b, opciones) {
    const { tolerancia, maxIter } = opcionesComunes(opciones);
    let { fa } = validarCorchete(f, a, b);      // exige f(a)·f(b) < 0
    let lo = a; let hi = b; let x = a;
    for (let k = 1; k <= maxIter; k += 1) {
        x = (lo + hi) / 2;
        const fx = evaluarFinito(f, x);
        const error = (hi - lo) / 2;
        traza.push({ iter: k, x, fx, error });
        if (fx === 0 || error < tolerancia) {
            return { raiz: x, iteraciones: k, convergio: true, error, traza };
        }
        if (fa * fx < 0) { hi = x; } else { lo = x; fa = fx; }
    }
    // ...
}`;
const CODIGO_NEWTON = `export function newtonRaphson(f, x0, opciones = {}) {
    const derivada = opciones.df
        ?? ((x) => derivadaFuncion(f, x, { h: opciones.h ?? 1e-6 }));
    let x = x0;
    for (let k = 1; k <= maxIter; k += 1) {
        const fx = evaluarFinito(f, x);
        const dfx = evaluarFinito(derivada, x);
        if (Math.abs(dfx) < 1e-14) {
            throw new RangeError('La derivada es cero (o casi) ...');
        }
        const siguiente = x - fx / dfx;            // x_{k+1} = x_k - f(x_k) / f'(x_k)
        const error = Math.abs(siguiente - x);
        x = siguiente;
        traza.push({ iter: k, x, fx: evaluarFinito(f, x), error });
        if (error < tolerancia) {
            return { raiz: x, iteraciones: k, convergio: true, error, traza };
        }
    }
    // ...
}`;
const CODIGO_TRAPECIO = `export function trapecioDatos(xs, ys) {
    validarParejas(xs, ys, 2, ['xs', 'ys']);
    const acumulado = [0];
    for (let i = 1; i < xs.length; i += 1) {
        if (!(xs[i] > xs[i - 1])) {
            throw new RangeError('Los nodos x deben ser estrictamente crecientes.');
        }
        acumulado.push(acumulado[i - 1] + ((xs[i] - xs[i - 1]) * (ys[i - 1] + ys[i])) / 2);
    }
    return { valor: acumulado[acumulado.length - 1], acumulado };
}`;
const CODIGO_USO = `import { analizarGrupo } from '@/lib/numerics';

const analisis = analizarGrupo({ serie, limitePct: 20, sesionesProgramadas: 48, retardosPorAusencia: 3 });
analisis.tendencia.pendientePuntosPorSemana;   // ${n(T.pendientePuntosPorSemana, 2)}
analisis.cruceLimite.mensaje;                  // '${C.mensaje}'
analisis.cambios.mensaje;                      // '${R.cambios.mensaje}'`;

// costos (MXN). Supuestos explicitos en el texto.
const TC = 18.5;
const horas = 6 * 12 * 8; const tarifa = 175; const desarrollo = horas * tarifa;
const infra = [
    ['Hospedaje de la aplicación web (Vercel Pro)', 20 * 12],
    ['Base de datos, autenticación y almacenamiento (Supabase Pro)', 25 * 12],
    ['Servidor del servicio de reconocimiento (VPS 4 vCPU, 8 GB)', 24 * 12],
    ['Dominio de internet', 15],
];
const infraMxn = infra.map(([c, usd]) => [c, usd, usd * TC]);
const infraTotal = infraMxn.reduce((a, r) => a + r[2], 0);
const hardware = [['Raspberry Pi 4 Model B (4 GB)', 1650], ['Camera Module V2', 650], ['Caja, fuente oficial 5 V 3 A y memoria USB', 550]];
const hwTotal = hardware.reduce((a, r) => a + r[1], 0);
const subtotal = desarrollo + infraTotal + hwTotal;
const contingencia = subtotal * 0.10;
const antesIva = subtotal + contingencia;
const iva = antesIva * 0.16;
const totalCosto = antesIva + iva;
const mx = (v) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pantallas = [
    ['pantalla-login-pasa-lista.jpg', 'Inicio de sesión. El acceso es por rol (administrador, docente o alumno) con Supabase Auth.'],
    ['pantalla-home-docente.jpg', 'Panel del docente: sesiones del día, botón «Abrir y pasar lista», pendientes de revisión y alertas de alumnos cerca del límite.'],
    ['pantalla-pasar-lista-maqueta.jpg', 'Pasar lista: la cámara del aula captura el grupo y cada alumno reconocido se marca presente; el medidor muestra el avance de la sesión.'],
    ['pantalla-revision-caso.jpg', 'Revisión: los casos dudosos llegan al docente con el score de cada lectura para confirmar o corregir la asistencia.'],
    ['pantalla-analitica-3a.jpg', 'Analítica: aquí se muestran los resultados de los métodos numéricos (tendencia, proyección, cruce del límite, alertas y riesgo).'],
    ['pantalla-reportes-3a.jpg', 'Reportes: asistencia acumulada, faltas por alumno contra el límite y exportación a CSV o PDF.'],
    ['pantalla-alumno-limite.jpg', 'Vista del alumno: su porcentaje de asistencia, faltas equivalentes y aviso cuando se acerca al límite.'],
];

async function build() {
    const cuerpo = [];
    const add = (...xs) => cuerpo.push(...xs);

    // 1. Introduccion
    add(h1('1. Introducción'),
        p('El presente informe documenta el proyecto final de la materia de Métodos Numéricos: SUSAN, un sistema de software que registra la asistencia de los alumnos mediante reconocimiento facial y analiza el ausentismo con métodos numéricos para que el docente pueda intervenir a tiempo.'),
        p('En la mayoría de las aulas el pase de lista sigue siendo manual. Con 5 minutos por sesión, 3 sesiones por semana y 16 semanas, consume cerca de 4 horas de clase por grupo al semestre, y el registro en papel no permite ver tendencias. SUSAN automatiza el registro y, sobre todo, convierte la asistencia en series numéricas a las que se aplican los métodos vistos en el curso.'),
        p('Los temas que se tratan son: la descripción del producto, su identidad (logotipo y eslogan), los modelos matemáticos que utiliza (sistemas de ecuaciones lineales, mínimos cuadrados, validación cruzada, búsqueda de raíces, interpolación, suavizado, derivación e integración numérica y control estadístico), la metodología de desarrollo, la interfaz, la codificación de los métodos, los resultados obtenidos, el costo estimado del software y las conclusiones de cada integrante del equipo.'));

    // 2. Producto
    add(h1('2. Nombre y descripción del producto'),
        p([b('Nombre: '), 'SUSAN (sistema centralizado de registro digital de asistencia académica con análisis numérico del ausentismo).']),
        p([b('Tipo de software: '), 'aplicación web (escritorio y móvil) con un servicio de reconocimiento facial y una terminal de aula en Raspberry Pi.']),
        p([b('Usuarios: '), 'administrador escolar, docentes y alumnos.']),
        p([b('Descripción. '), 'Durante la ventana de tolerancia, la cámara del aula toma capturas del grupo. Cada rostro se convierte en un vector de 512 dimensiones y se busca en un índice FAISS que solo contiene a los alumnos inscritos. Varias lecturas del mismo alumno en capturas distintas confirman su presencia y los casos dudosos pasan a revisión del docente. PostgreSQL consolida cada sesión (inscritos, presentes, ausentes, retardos y justificados) y el módulo de métodos numéricos analiza esa serie para generar la tendencia, la proyección, la semana estimada en que el grupo alcanzará el límite de faltas, los cambios de nivel, el día crítico y el riesgo de cada alumno.']),
        p([b('Funciones principales:')], { spacing: { after: 60 } }),
        bullet('Pase de lista automático con cámara y revisión de casos dudosos.'),
        bullet('Gestión de periodos, materias, grupos, horarios, aulas e inscripciones.'),
        bullet('Justificantes con aprobación del docente.'),
        bullet('Reportes de asistencia por alumno, grupo y periodo, exportables a CSV y PDF.'),
        bullet('Analítica del ausentismo con métodos numéricos y alertas para el docente.'),
        bullet('Vista del alumno con su asistencia y su distancia al límite de faltas.'),
        p([b('Tecnologías: '), 'Next.js 16 y React 19 (interfaz y servidor), Tailwind CSS 4, Supabase sobre PostgreSQL 16 (base de datos, autenticación y almacenamiento), Python 3.12 con FastAPI, InsightFace y FAISS (reconocimiento), Raspberry Pi 4 con Camera Module V2 (terminal del aula) y Vercel (publicación).'], { spacing: { before: 120, after: 140, line: 300 } }));

    // 3. Logotipo
    add(h1('3. Logotipo'),
        await imagen(path.join(ASSETS, 'logo-full.png'), 5.4, 'Logotipo de SUSAN'),
        pie('Figura 1. Logotipo de SUSAN en su versión completa, como aparece en la pantalla de inicio de sesión.'),
        await imagen(path.join(ASSETS, 'logo-compact.png'), 2.6, 'Logotipo compacto de SUSAN'),
        pie('Figura 2. Versión compacta, usada en la barra lateral y en la barra superior del teléfono.'),
        p('El logotipo une la identidad institucional con el nombre del producto: a la izquierda el escudo de la Universidad Autónoma de Chiapas, al centro el nombre SUSAN en Hanken Grotesk (la tipografía de toda la interfaz) con el descriptor «Registro de asistencia», y a la derecha el escudo de la Facultad de Contaduría y Administración, Campus I. La versión compacta conserva el escudo de la UNACH y el nombre; el escudo de la UNACH también es el ícono de la aplicación en el navegador.'));

    // 4. Slogan
    add(h1('4. Eslogan'),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 }, children: [new TextRun({ text: '«Asistencia académica, medida y a tiempo»', italics: true, bold: true, size: 32, color: NAVY })] }),
        p([b('Asistencia académica'), ' nombra el problema que resuelve el sistema. ', b('Medida'), ' se refiere a que la asistencia ya no es una lista en papel sino un dato que se analiza con métodos numéricos. ', b('A tiempo'), ' resume el objetivo del proyecto: detectar el ausentismo antes de que el alumno pierda el derecho a examen, para que la intervención docente sea oportuna.']));

    // 5. Modelos matematicos
    add(h1('5. Modelos matemáticos usados en el proyecto'),
        p(['Para ilustrar cada modelo se usa un caso de estudio: un grupo de 35 alumnos con 3 sesiones por semana (lunes, miércoles y viernes), 48 sesiones programadas en el semestre y 8 semanas observadas. Todos los valores se obtuvieron ejecutando la función ', i('analizarGrupo()'), ' de SUSAN sobre estos datos.']),
        tabla(['Semana', ...sem.map(String)], [
            ['Tasa r(w) %', ...T.tasas.map((t) => pc(t))],
            ['Acumulado A(w) %', ...C.acumulado.valores.map((v) => v.toFixed(2))]],
        [1760, ...Array(8).fill(950)], { size: 18, alinear: [AlignmentType.LEFT, ...Array(8).fill(AlignmentType.CENTER)] }),
        pie('Tabla 1. Serie semanal del caso de estudio.'));

    add(h2('5.1 Tasa semanal y acumulado de faltas'),
        eq('r(w) = Σ ausentes / Σ inscritos'),
        eq('A(w) = 100 · Σ (ausentes + retardos/3) / inscritos / 48'),
        p('La tasa semanal r(w) es la fracción de inasistencias de la semana w. El acumulado A(w) es el porcentaje promedio de faltas equivalentes de un alumno respecto al periodo (3 retardos equivalen a una falta). El alumno pierde el derecho a examen cuando sus faltas superan el 20 % de las sesiones programadas.'));

    add(h2('5.2 Similitud de rostros (álgebra vectorial)'),
        eq('cos θ = (u · v) / (‖u‖ ‖v‖),     score = (cos θ + 1) / 2'),
        p('Cada rostro es un vector de 512 dimensiones normalizado. El índice FAISS calcula el producto interno, que para vectores unitarios es el coseno del ángulo entre ellos; SUSAN lo lleva al intervalo [0, 1] para compararlo con el umbral de la especificación (0.850).'));

    add(h2('5.3 Mínimos cuadrados y sistemas de ecuaciones lineales'),
        eq('r(w) = a + b·w'),
        eq('n·a + (Σw)·b = Σr,     (Σw)·a + (Σw²)·b = Σw·r'),
        p(['La recta que minimiza la suma de cuadrados de los residuos se obtiene de las ecuaciones normales, un sistema lineal que se resuelve con ', b('eliminación de Gauss con pivoteo parcial'), ` (también está la factorización LU, PA = LU). En el caso de estudio: a = ${n(AJ.intercepto, 5)}, b = ${n(AJ.pendiente, 5)} y r² = ${n(AJ.r2, 4)}. El ausentismo sube ${n(T.pendientePuntosPorSemana, 2)} puntos porcentuales por semana.`]));

    add(h2('5.4 Selección del modelo e intervalo de predicción'),
        p('Se ajustan una recta y una parábola y se elige con validación cruzada leave-one-out (LOO): se deja fuera una semana, se predice y se mide la raíz del error cuadrático medio. La parábola solo se elige si mejora ese error en al menos 2 %.'),
        tabla(['Modelo', 'r²', 'r² ajustado', 'AIC', 'RMSE LOO'], [
            ['Grado 1 (recta)', n(c1.r2), n(c1.r2Ajustado), n(c1.aic, 2), n(c1.errorLOO, 5)],
            ['Grado 2 (parábola)', n(c2.r2), n(c2.r2Ajustado), n(c2.aic, 2), n(c2.errorLOO, 5)]],
        [2600, 1600, 1700, 1600, 1860], { alinear: [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER], fila: (r) => (r === 0 ? { bold: true, fill: TINT } : {}) }),
        pie('Tabla 2. Comparación de modelos. Gana la recta: predice mejor los datos que no vio.'),
        eq('ŷ ± t · s · √(1 + φ', sup('T'), '(X', sup('T'), 'X)', sup('−1'), 'φ)'),
        await imagen(path.join(ASSETS, 'graf-tendencia.png'), 6.0, 'Proyección del ausentismo semanal'),
        pie(`Figura 3. Proyección lineal con intervalo de predicción al 95 %. Para la semana 9 se esperan ${pc(pm[9].valor, 1)} % [${pc(pm[9].inferior, 1)} %, ${pc(pm[9].superior, 1)} %].`));

    const bt = C.biseccion.traza; const nt = C.newton.traza;
    add(h2('5.5 Búsqueda de raíces: semana de cruce del límite'),
        eq('f(t) = A(t) − 20 = 0'),
        eq('Bisección: t = (a + b) / 2;     Newton-Raphson: t', sub('k+1'), ' = t', sub('k'), ' − f(t', sub('k'), ') / f′(t', sub('k'), ')'),
        p(`Un barrido con paso de 0.25 semanas encuentra el intervalo [15.75, 16.0] donde f cambia de signo. Bisección conserva el cambio de signo y siempre converge; Newton-Raphson usa la derivada analítica del ajuste y converge cuadráticamente. Ambos llegan a t ≈ ${n(C.t, 6)}: el grupo alcanzaría el límite en la semana ${C.semana}.`),
        tabla(['Método', 'Iteraciones', 'Raíz t', 'Error final'], [
            ['Bisección', String(bt.length), n(C.biseccion.raiz, 9), bt[bt.length - 1].error.toExponential(1)],
            ['Newton-Raphson', String(nt.length), n(C.newton.raiz, 9), nt[nt.length - 1].error.toExponential(1)]],
        [2600, 1800, 2600, 2360], { alinear: [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER] }),
        pie('Tabla 3. Bisección contra Newton-Raphson sobre la misma ecuación.'),
        await imagen(path.join(ASSETS, 'graf-cruce.png'), 6.0, 'Acumulado de faltas y límite'),
        pie('Figura 4. Acumulado de faltas, ajuste y proyección. La intersección con el límite es la raíz de f(t).'));

    add(h2('5.6 Interpolación'),
        eq('S', sub('i'), '(x) = a', sub('i'), ' + b', sub('i'), '(x − x', sub('i'), ') + c', sub('i'), '(x − x', sub('i'), ')', sup('2'), ' + d', sub('i'), '(x − x', sub('i'), ')', sup('3'), ',     S″(x', sub('0'), ') = S″(x', sub('n'), ') = 0'),
        p('Las semanas sin clase se rellenan con un spline cúbico natural (cúbicas por tramos con primera y segunda derivada continuas, resuelto como sistema tridiagonal). Al eliminar la semana 5 del caso, el spline estimó 13.05 % contra el 13.33 % real. También se implementaron Lagrange y diferencias divididas de Newton.'));

    add(h2('5.7 Suavizado'),
        eq('SMA', sub('t'), ' = (r', sub('t'), ' + r', sub('t−1'), ' + r', sub('t−2'), ') / 3,     EMA', sub('t'), ' = α·r', sub('t'), ' + (1 − α)·EMA', sub('t−1')),
        p('Las medias móviles simple, ponderada y exponencial (α = 0.5) muestran la tendencia sin el ruido de semana a semana.'));

    add(h2('5.8 Derivación e integración numérica'),
        eq('f′(x) ≈ [f(x + h) − f(x − h)] / 2h'),
        eq('∫ r(w) dw ≈ (h/2) [r', sub('1'), ' + 2r', sub('2'), ' + … + 2r', sub('7'), ' + r', sub('8'), ']'),
        p(`La tasa de cambio usa diferencias finitas de tres puntos y extrapolación de Richardson; en la semana 8 resulta ${n(AJ.pendiente * 100, 4)} pp/semana, igual a la derivada analítica. El área bajo la tasa semanal (ausentismo acumulado) con trapecio sobre los datos es ${n(area[0][1], 4)} tasa·semanas; Simpson 1/3 y Romberg sobre la recta dan ${n(area[2][1], 4)}.`));

    add(h2('5.9 Control estadístico y riesgo'),
        eq('S', sup('+'), sub('t'), ' = máx[0, S', sup('+'), sub('t−1'), ' + r', sub('t'), ' − μ', sub('0'), ' − k],     z = (x − μ) / σ'),
        p(`La carta CUSUM (k = 0.5σ, h = 4σ) detecta que el ausentismo cambió de nivel desde la semana ${R.cambios.semanaCambio} (alarma en la ${R.cambios.semanaDeteccion}); una carta EWMA lo confirma. El patrón por día marca al ${R.patronSemanal.nombreDiaCritico.toLowerCase()} como crítico (${pc(dias[2].tasa, 1)} %). El riesgo de cada alumno es un puntaje de 0 a 100 que suma siete factores: distancia al límite (25), proyección al cierre (20), pendiente reciente (15), faltas consecutivas (15), z-score frente al grupo (10), retardos (10) y concentración por día (5).`));

    // 6. Metodologia
    add(h1('6. Metodología de desarrollo'),
        p(['Se siguió un ', b('modelo incremental'), ' (Sommerville, 2011): primero se analizó y diseñó el sistema completo y después se construyó por incrementos funcionales, cada uno probado antes de pasar al siguiente.']),
        num([b('Análisis de requerimientos. '), 'Se definieron 22 requerimientos funcionales, 14 no funcionales y 13 reglas de negocio, con su matriz de trazabilidad.']),
        num([b('Diseño. '), 'Diagramas de procesos BPMN, modelo entidad–relación, modelo lógico de 19 tablas y diseño de 9 pantallas.']),
        num([b('Base de datos y reglas de negocio. '), 'Migraciones de PostgreSQL con funciones RPC, disparadores y seguridad por filas (RLS), cada una con pruebas SQL.']),
        num([b('Servicio de reconocimiento. '), 'API en FastAPI con InsightFace y FAISS, probada con pytest.']),
        num([b('Módulo de métodos numéricos. '), 'Cada método se implementó en JavaScript puro y se validó con problemas de respuesta conocida antes de integrarlo al análisis.']),
        num([b('Interfaz por fases. '), 'Doce fases de diseño (F0 a F11), cada una con criterios de aceptación: legible a 360 px, sin desbordes y respetando «reducir movimiento».']),
        num([b('Despliegue y demostración. '), 'Publicación en Vercel, terminal del aula en Raspberry Pi en modo kiosco y escenario de demostración con datos de prueba.']),
        p('El trabajo se coordinó con Git: cada cambio se registró en el historial del repositorio y se verificó con las pruebas automáticas (Vitest para la web, pytest para el servicio y pruebas SQL para la base de datos).', { spacing: { before: 120, after: 140, line: 300 } }));

    // 7. Interfaz
    add(h1('7. Interfaz del software'),
        p('La interfaz usa una identidad propia: lienzo crema, paneles blancos, tipografía Hanken Grotesk, botones negros y estados de asistencia siempre con texto y color. Todas las gráficas están hechas a mano (sin librerías) y cada pantalla abre con cifras clave. Las capturas muestran el escenario de demostración, con datos de prueba.'));
    let figN = 5;
    for (const [f, t] of pantallas) {
        add(await imagen(path.join(CAP, f), 6.2, t), pie(`Figura ${figN}. ${t}`));
        figN += 1;
    }
    add(await imagen(path.join(CAP, 'movil-home-docente.jpg'), 2.3, 'Panel del docente en el teléfono'),
        pie(`Figura ${figN}. La misma aplicación en un teléfono: navegación inferior y botón central para pasar lista.`));

    // 8. Codificacion
    add(h1('8. Codificación'),
        p(['El módulo de métodos numéricos está en ', i('web/src/lib/numerics/'), ', escrito en JavaScript sin dependencias. Tiene una carpeta por familia: linear-algebra, regression, interpolation, smoothing, differentiation, integration, rootfinding, stats, forecast, risk y analysis. Todas las funciones son puras y deterministas, validan su entrada con mensajes en español y devuelven su procedimiento (pasos, tablas y trazas) para que la pantalla de Analítica lo muestre. A continuación se presentan fragmentos del código real (las líneas omitidas se indican con «...»).']),
        h2('8.1 Eliminación de Gauss con pivoteo parcial'), codigo(CODIGO_GAUSS), espacio(),
        h2('8.2 Bisección'), codigo(CODIGO_BISECCION), espacio(),
        h2('8.3 Newton-Raphson'), codigo(CODIGO_NEWTON), espacio(),
        h2('8.4 Regla del trapecio sobre datos'), codigo(CODIGO_TRAPECIO), espacio(),
        h2('8.5 Uso desde la aplicación'), codigo(CODIGO_USO), espacio(),
        p('La interfaz nunca calcula ni consulta la base de datos directamente: llama a funciones de PostgreSQL a través de envoltorios en lib/api y pasa la serie al módulo numérico. Así la lógica de negocio queda en la base de datos y los cálculos en un módulo que se puede probar por separado.'));

    // 9. Resultados
    add(h1('9. Resultados'),
        p([b('Producto funcionando. '), 'SUSAN está publicado en internet y la terminal del aula (Raspberry Pi 4 con Camera Module V2) abre la aplicación en modo kiosco para pasar lista con la cámara. El flujo completo funciona: captura, reconocimiento, revisión, reportes y analítica.']),
        p([b('Verificación. '), 'El módulo numérico tiene 110 pruebas automáticas aprobadas en 11 archivos. Cada método se comparó contra un problema de respuesta conocida:']),
        tabla(['Prueba', 'Resultado esperado'], [
            ['Newton-Raphson sobre x² − 2', '√2 = 1.41421356…'],
            ['Bisección sobre cos(x) − x', '0.73908513…'],
            ['Simpson 1/3 de sen(x) en [0, π]', '2'],
            ['Spline cúbico natural', 'reproduce los nudos'],
            ['Lagrange contra diferencias divididas de Newton', 'mismo polinomio'],
            ['Matriz de Hilbert', 'número de condición alto (mal condicionada)'],
            ['CUSUM sobre un salto sintético', 'detecta la semana del salto']], [5200, 4160]),
        pie('Tabla 4. Casos de verificación del módulo numérico.'),
        p([b('Análisis del caso de estudio. '), 'El sistema generó cuatro alertas para el docente:']),
        tabla(['Alerta', 'Resultado', 'Método'], [
            ['Tendencia al alza', `+${n(T.pendientePuntosPorSemana, 2)} pp por semana (r² = ${n(AJ.r2, 3)})`, 'Mínimos cuadrados + Gauss'],
            ['Cruce proyectado', `Semana ${C.semana} (t ≈ ${n(C.t, 2)})`, 'Bisección y Newton-Raphson'],
            ['Cambio de nivel', `Desde la semana ${R.cambios.semanaCambio}`, 'CUSUM y EWMA'],
            ['Día crítico', `${R.patronSemanal.nombreDiaCritico}: ${pc(dias[2].tasa, 1)} % vs ${pc(dias[0].tasa, 1)} % el lunes`, 'Estadística descriptiva']], [2400, 4060, 2900]),
        pie('Tabla 5. Alertas generadas para el grupo del caso de estudio.'),
        p([b('Tamaño del proyecto. '), 'El repositorio tiene alrededor de 47 000 líneas de JavaScript en la aplicación (sin contar pruebas), 46 migraciones SQL con unas 11 000 líneas y un servicio en Python de unas 1 800 líneas.']));

    // 10. Costo
    add(h1('10. Costo total del software'),
        p('El costo se estimó para el desarrollo realizado y el primer año de operación de un piloto en un aula. Supuestos: 6 integrantes durante 12 semanas a 8 horas por semana, una tarifa de $175.00 MXN por hora (programador junior en México), un tipo de cambio de $18.50 MXN por dólar y precios de lista de los servicios en la nube.'),
        tabla(['Concepto', 'Detalle', 'Importe (MXN)'], [
            ['Desarrollo', `${horas} horas × ${mx(tarifa)}`, mx(desarrollo)],
            ...infraMxn.map(([c, usd, m]) => ['Infraestructura (12 meses)', `${c}: ${usd} USD`, mx(m)]),
            ...hardware.map(([c, m]) => ['Hardware del aula', c, mx(m)]),
            ['Licencias de software', 'Next.js, PostgreSQL, FAISS y demás son de código abierto', mx(0)],
            ['Subtotal', '', mx(subtotal)],
            ['Contingencia (10 %)', 'Imprevistos y ajustes', mx(contingencia)],
            ['IVA (16 %)', '', mx(iva)],
            ['Costo total', '', mx(totalCosto)]],
        [2700, 4460, 2200], { alinear: [AlignmentType.LEFT, AlignmentType.LEFT, AlignmentType.RIGHT], fila: (r) => (r >= 9 ? { bold: true, fill: r === 12 ? TINT : undefined } : {}) }),
        pie('Tabla 6. Costo estimado del software (desarrollo, primer año de operación y una terminal de aula).'),
        p([b(`Costo total estimado: ${mx(totalCosto)} MXN. `), `Cada aula adicional suma ${mx(hwTotal)} MXN de hardware más IVA. Los modelos preentrenados de reconocimiento facial de InsightFace tienen licencia para investigación; un uso comercial requeriría adquirir una licencia o cambiar de modelo, lo que no está incluido en esta estimación.`]));

    // 11. Conclusiones
    add(h1('11. Conclusiones individuales'));
    for (const [nm, t] of CONC) {
        add(new Paragraph({ spacing: { before: 120, after: 60 }, keepNext: true, children: [new TextRun({ text: nm, bold: true, color: NAVY, size: 23 })] }), p(t));
    }

    // 12. Referencias
    const ref = (runs) => new Paragraph({ indent: { left: 720, hanging: 720 }, spacing: { after: 160, line: 300 }, children: runs });
    add(h1('12. Referencias'),
        ref([new TextRun('Burden, R. L., Faires, J. D. y Burden, A. M. (2017). '), new TextRun({ text: 'Análisis numérico', italics: true }), new TextRun(' (10.ª ed.). Cengage Learning.')]),
        ref([new TextRun('Chapra, S. C. y Canale, R. P. (2015). '), new TextRun({ text: 'Métodos numéricos para ingenieros', italics: true }), new TextRun(' (7.ª ed.). McGraw-Hill Education.')]),
        ref([new TextRun('Montgomery, D. C. (2019). '), new TextRun({ text: 'Introduction to statistical quality control', italics: true }), new TextRun(' (8th ed.). Wiley.')]),
        ref([new TextRun('Sommerville, I. (2011). '), new TextRun({ text: 'Ingeniería de software', italics: true }), new TextRun(' (9.ª ed.). Pearson Educación.')]));

    const doc = new Document({
        creator: 'Equipo SUSAN', title: 'Informe del proyecto final: SUSAN', description: 'Métodos Numéricos, UNACH',
        styles: {
            default: { document: { run: { font: FONT, size: 22 } } },
            paragraphStyles: [
                { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { font: FONT, size: 30, bold: true, color: NAVY }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, outlineLevel: 0 } },
                { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { font: FONT, size: 24, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } },
            ],
        },
        numbering: { config: [
            { reference: 'vinetas', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
            { reference: 'pasos', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 320 } } } }] },
        ] },
        sections: [
            { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 60, bottom: 0, left: 60, right: 60, header: 0, footer: 0 } } }, children: portada },
            {
                properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1200, left: 1440, right: 1440 }, pageNumbers: { start: 2 } } },
                headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'SUSAN · Informe del proyecto final · Métodos Numéricos', size: 16, color: GRAY })] })] }) },
                footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: GRAY })] })] }) },
                children: cuerpo,
            },
        ],
    });
    fs.writeFileSync(OUT, await Packer.toBuffer(doc));
    console.log('ok', OUT, { total: totalCosto, subtotal, desarrollo, infraTotal, hwTotal });
}
await build();
