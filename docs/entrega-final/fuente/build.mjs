import { createRequire } from 'module';
import path from 'path';
import { analizarGrupo } from '/Users/diegoguerrero/Developer/SUSAN/web/src/lib/numerics/index.js';

const require = createRequire(import.meta.url);
const pptxgen = require('pptxgenjs');
const SKILL = process.env.PPTX_SKILL || '';
const { applyTheme } = require(path.join(SKILL, 'scripts/apply_theme.js'));
const DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = process.argv[2];

// ---------- caso de estudio: se calcula con el modulo real de SUSAN ----------
const L0 = Date.UTC(2026, 7, 17);
const f = (w, d) => new Date(L0 + ((w - 1) * 7 + (d - 1)) * 864e5).toISOString().slice(0, 10);
const AUS = { 1: [2, 2, 3], 2: [2, 3, 4], 3: [3, 3, 5], 4: [3, 4, 5], 5: [4, 4, 6], 6: [4, 5, 7], 7: [5, 5, 8], 8: [5, 6, 8] };
const serie = [];
for (const [w, arr] of Object.entries(AUS)) {
    [1, 3, 5].forEach((d, i) => {
        const a = arr[i];
        serie.push({ id_sesion: serie.length + 1, fecha: f(+w, d), semana_iso: 33 + +w, dia_semana: d, inscritos: 35,
            presentes: 34 - a, retardos: 1, ausentes: a, justificados: 0, pendientes: 0, tasa_ausentismo: a / 35 });
    });
}
const R = analizarGrupo({ serie, limitePct: 20, sesionesProgramadas: 48, retardosPorAusencia: 3 });
// misma serie con la semana 5 suspendida, para mostrar el spline
const R5 = analizarGrupo({ serie: serie.filter((s) => s.fecha < f(5, 1) || s.fecha >= f(6, 1)), limitePct: 20, sesionesProgramadas: 48, retardosPorAusencia: 3 });

const pct = (x, d = 1) => (x * 100).toFixed(d);
const fx = (x, d) => x.toFixed(d);
const T = R.tendencia; const AJ = T.ajuste; const P = R.proyeccion; const C = R.cruceLimite;
const [c1, c2] = P.candidatos;
const spline5 = R5.suavizado.tasasRellenas[4];
const di = R.procedimientos.find((p) => p.id === 'derivacion-integracion');
const rich = di.pasos.find((p) => p.titulo.startsWith('Tasa de cambio en la')).valores;
const romb = di.pasos.find((p) => p.titulo === 'Tabla de Romberg').valores[0].valor;
const NAMES = ['Casanova Pérez Gabriela', 'Escobar Domínguez Josué Gabriel', 'Gómez Delgado Ades Yasir',
    'González Guerrero Diego Enrique', 'Peña Morales José Manuel', 'Pérez Hernández Alan Eduardo'];

// ---------- tema ----------
const NAVY = '0B2461'; const GOLD = 'D9A21B'; const INK = '1F2937'; const GRAY = '6B7280'; const TINT = 'EEF2F9'; const LINE = 'C9D2E3'; const RED = 'B42318';
const THEME = {
    name: 'UNACH SUSAN', headFontFace: 'Arial', bodyFontFace: 'Arial',
    colors: { dk1: INK, lt1: 'FFFFFF', dk2: NAVY, lt2: TINT, accent1: NAVY, accent2: GOLD, accent3: '3B5BA9', accent4: RED,
        accent5: '8A94A6', accent6: '2E7D32', hlink: '1D4ED8', folHlink: '6D28D9' },
};
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };
pres.title = 'SUSAN · Proyecto final de Métodos Numéricos';
pres.author = 'Equipo SUSAN';
const S = pres.SchemeColor;

pres.defineSlideMaster({ title: 'PORTADA', background: { path: path.join(DIR, 'portada.png') }, objects: [] });
pres.defineSlideMaster({ title: 'CIERRE', background: { path: path.join(DIR, 'cierre.png') }, objects: [] });
pres.defineSlideMaster({
    title: 'CONTENIDO', background: { color: 'FFFFFF' },
    margin: [0.5, 0.6, 0.8, 0.6],
    objects: [
        { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.35, w: 12.1, h: 0.7, fontSize: 30, bold: true, color: S.text2, valign: 'bottom', align: 'left', margin: 0 }, text: '' } },
        { line: { x: 0.6, y: 1.12, w: 12.13, h: 0, line: { color: S.text2, width: 1.25 } } },
        { image: { x: 0.6, y: 6.88, w: 0.42, h: 0.42, path: path.join(DIR, 'unach.png') } },
        { text: { text: 'SUSAN · Métodos Numéricos · UNACH', options: { x: 1.12, y: 6.9, w: 6, h: 0.38, fontSize: 10, color: S.text1, transparency: 35, valign: 'middle', margin: 0 } } },
    ],
    slideNumber: { x: 12.23, y: 6.9, w: 0.5, h: 0.38, fontSize: 10, color: S.text2, align: 'right' },
});

const tx = (slide, text, o) => slide.addText(text, { isTextBox: true, margin: 0, color: S.text1, fontSize: 16, valign: 'top', ...o });
const lead = (slide, text) => tx(slide, text, { x: 0.6, y: 1.3, w: 12.1, h: 0.75, fontSize: 16, color: S.text1, transparency: 20 });
const content = (title, sec) => { const s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: sec }); s.addText(title, { placeholder: 'title' }); return s; };
const card = (slide, x, y, w, h, name) => slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: S.background2 }, line: { color: S.background2 }, objectName: name });
const HEAD = { bold: true, color: S.background1, fill: { color: S.text2 }, align: 'center', valign: 'middle' };
const table = (slide, rows, o) => slide.addTable(rows.map((r, i) => r.map((c) => (typeof c === 'object' ? c : { text: String(c), options: i === 0 ? HEAD : { align: 'center', valign: 'middle' } }))),
    { fontSize: 13, color: S.text1, border: { type: 'solid', pt: 0.75, color: LINE }, rowH: 0.36, margin: [0.03, 0.08, 0.03, 0.08], ...o });
const chartBase = (title) => ({
    showTitle: true, title, titleFontSize: 13, titleColor: INK, titleFontFace: '+mn-lt',
    catAxisLabelColor: GRAY, valAxisLabelColor: GRAY, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
    catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt', legendFontFace: '+mn-lt', legendFontSize: 11, legendColor: INK,
    valGridLine: { color: 'E5E7EB', size: 0.75 }, catGridLine: { style: 'none' }, showLegend: true, legendPos: 'b',
});

// ================= 1. Portada =================
pres.addSection({ title: 'Portada' });
{
    const s = pres.addSlide({ masterName: 'PORTADA', sectionTitle: 'Portada' });
    s.addImage({ path: path.join(DIR, 'unach.png'), x: 0.75, y: 0.65, w: 1.8, h: 1.8, objectName: 'Escudo UNACH', altText: 'Escudo de la UNACH' });
    s.addImage({ path: path.join(DIR, 'jaguar.png'), x: 1.0, y: 5.68, w: 1.3, h: 1.34, objectName: 'Jaguar', altText: 'Mascota jaguar' });
    tx(s, 'Benemérita Universidad\nAutónoma de Chiapas', { x: 3.9, y: 0.3, w: 8.9, h: 1.15, valign: 'top', lineSpacingMultiple: 0.95, fontSize: 30, bold: true, color: S.text2, align: 'right' });
    tx(s, 'Por La Conciencia De La Necesidad De Servir', { x: 3.9, y: 1.5, w: 8.9, h: 0.35, fontSize: 14, bold: true, italic: true, color: S.text1, align: 'right' });
    const bloque = (x, y, w, label, lines) => tx(s, [
        { text: label, options: { bold: true, breakLine: true, paraSpaceAfter: 3 } },
        ...lines.map((l, i) => ({ text: l, options: { breakLine: i < lines.length - 1 } })),
    ], { x, y, w, h: 0.34 + 0.27 * lines.length, fontSize: 14, align: 'center', lineSpacingMultiple: 1.05 });
    const L = 3.75; const LW = 4.75; const Rx = 8.75; const RW = 4.1;
    bloque(L, 2.2, LW, 'FACULTAD y LICENCIATURA:', ['Escuela de Tecnologías Digitales Aplicadas, Campus I', '(Ingeniería en Desarrollo y Tecnologías de Software)']);
    bloque(L, 3.3, LW, 'NOMBRE DE LA MATERIA:', ['Métodos Numéricos']);
    bloque(L, 4.15, LW, 'NOMBRE DE LA ACTIVIDAD:', ['Proyecto Final: SUSAN', 'Registro digital de asistencia con', 'análisis numérico del ausentismo']);
    bloque(L, 5.55, LW, 'NOMBRE DEL CATEDRÁTICO:', ['Mtro. Octavio Morales Jiménez']);
    bloque(Rx, 2.2, RW, 'INTEGRANTES DEL EQUIPO:', NAMES);
    bloque(Rx, 4.55, RW, 'SEMESTRE: 3° | GRADO: “N”', []);
    bloque(Rx, 5.1, RW, 'FECHA Y LUGAR DE ENTREGA:', ['Noviembre 11, 2026.', 'Tuxtla Gutiérrez, Chiapas, México']);
    s.addNotes('Presentación del equipo y del proyecto final: SUSAN, un sistema de registro digital de asistencia que además analiza el ausentismo con métodos numéricos.');
}

// ================= 2. Problema y objetivo =================
pres.addSection({ title: 'Contexto' });
{
    const s = content('1. Problema y objetivo', 'Contexto');
    lead(s, 'El pase de lista manual consume tiempo de clase y no deja un historial que permita detectar a tiempo a quién se está alejando del aula.');
    card(s, 0.6, 2.25, 3.6, 3.0, 'Cifra pase de lista');
    tx(s, '4 h', { x: 0.85, y: 2.45, w: 3.1, h: 1.1, fontSize: 60, bold: true, color: S.text2 });
    tx(s, 'de clase por grupo al semestre: 5 min de pase de lista × 3 sesiones por semana × 16 semanas.', { x: 0.85, y: 3.6, w: 3.1, h: 1.4, fontSize: 15 });
    tx(s, [
        { text: 'Objetivo general', options: { bold: true, color: S.text2, fontSize: 20, breakLine: true, paraSpaceAfter: 6 } },
        { text: 'Reducir el tiempo de pase de lista con un registro digital (cámara + reconocimiento facial) y generar historiales consolidados que, analizados con métodos numéricos, identifiquen patrones de ausentismo para orientar la intervención docente oportuna.', options: { breakLine: true, paraSpaceAfter: 14 } },
        { text: 'Objetivos del análisis numérico', options: { bold: true, color: S.text2, fontSize: 20, breakLine: true, paraSpaceAfter: 6 } },
        { text: 'Medir la tendencia del ausentismo de cada grupo.', options: { bullet: true, breakLine: true } },
        { text: 'Proyectar en qué semana el grupo alcanzaría el límite de 20 % de faltas.', options: { bullet: true, breakLine: true } },
        { text: 'Detectar cambios de nivel, días críticos y alumnos en riesgo.', options: { bullet: true } },
    ], { x: 4.7, y: 2.25, w: 8.0, h: 4.2, fontSize: 16, paraSpaceAfter: 4 });
    s.addNotes('El problema: el pase de lista se come unas 4 horas por grupo al semestre y en papel no hay forma de ver tendencias. SUSAN registra la asistencia y luego aplica métodos numéricos a esos datos.');
}

// ================= 3. Flujo SUSAN =================
{
    const s = content('2. ¿Qué es SUSAN?', 'Contexto');
    lead(s, 'Del aula a la decisión del docente: la asistencia se captura sola y se convierte en una serie de datos que se analiza numéricamente.');
    const pasos = [
        ['01', 'Captura', 'La cámara del aula toma fotos durante la ventana de tolerancia.'],
        ['02', 'Reconocimiento', 'Cada rostro se convierte en un vector de 512 dimensiones y se busca en un índice FAISS.'],
        ['03', 'Asistencia', 'Varias lecturas del mismo alumno confirman su presencia; el docente revisa los dudosos.'],
        ['04', 'Serie', 'PostgreSQL consolida cada sesión: inscritos, ausentes, retardos, justificados.'],
        ['05', 'Análisis numérico', 'Tendencia, proyección, cruce del límite, cambios de nivel y riesgo por alumno.'],
    ];
    const w = 2.26; const gap = 0.2;
    pasos.forEach(([n, t, d], i) => {
        const x = 0.6 + i * (w + gap);
        const ultimo = i === pasos.length - 1;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.35, w, h: 3.4, rectRadius: 0.08, fill: { color: ultimo ? S.text2 : S.background2 }, line: { color: ultimo ? S.text2 : S.background2 }, objectName: `Paso ${n}` });
        s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 2.6, w: 0.62, h: 0.62, fill: { color: ultimo ? S.accent2 : S.text2 }, line: { color: ultimo ? S.accent2 : S.text2 }, objectName: `Circulo ${n}` });
        tx(s, n, { x: x + 0.25, y: 2.6, w: 0.62, h: 0.62, fontSize: 15, bold: true, color: ultimo ? S.text2 : S.background1, align: 'center', valign: 'middle' });
        tx(s, t, { x: x + 0.25, y: 3.4, w: w - 0.45, h: 0.45, fontSize: 15, bold: true, color: ultimo ? S.background1 : S.text2 });
        tx(s, d, { x: x + 0.25, y: 3.9, w: w - 0.45, h: 1.7, fontSize: 14, color: ultimo ? S.background1 : S.text1 });
    });
    tx(s, 'Stack: Next.js + Supabase (PostgreSQL 16) + servicio Python/FastAPI con FAISS. Los métodos numéricos están implementados a mano en JavaScript, sin librerías.', { x: 0.6, y: 6.0, w: 12.1, h: 0.6, fontSize: 14, italic: true, color: S.text1, transparency: 25 });
    s.addNotes('El paso 5 es el que corresponde a esta materia: todo el módulo de métodos numéricos está escrito por nosotros, sin dependencias, en web/src/lib/numerics.');
}

// ================= 4. Datos =================
pres.addSection({ title: 'Métodos' });
{
    const s = content('3. De la asistencia a una serie numérica', 'Métodos');
    lead(s, 'Caso de estudio: grupo de 35 alumnos, 3 sesiones por semana (lunes, miércoles y viernes), 48 sesiones programadas; se analizan las primeras 8 semanas.');
    card(s, 0.6, 2.3, 5.7, 3.95, 'Definiciones');
    tx(s, [
        { text: 'Tasa semanal', options: { bold: true, color: S.text2, breakLine: true } },
        { text: 'r(w) = Σ ausentes / Σ inscritos', options: { fontFace: 'Cambria', italic: true, fontSize: 17, breakLine: true, paraSpaceAfter: 10 } },
        { text: 'Faltas equivalentes', options: { bold: true, color: S.text2, breakLine: true } },
        { text: 'F = ausencias + ⌊retardos / 3⌋', options: { fontFace: 'Cambria', italic: true, fontSize: 17, breakLine: true, paraSpaceAfter: 10 } },
        { text: 'Acumulado (% del periodo)', options: { bold: true, color: S.text2, breakLine: true } },
        { text: 'A = 100 · Σ (aus + ret/3) / inscritos / 48', options: { fontFace: 'Cambria', italic: true, fontSize: 17, breakLine: true, paraSpaceAfter: 10 } },
        { text: 'Se pierde el derecho a examen si F > 20 % de las sesiones programadas.', options: { fontSize: 14 } },
    ], { x: 0.85, y: 2.5, w: 5.3, h: 3.6, fontSize: 15 });
    const filas = [['Semana', ...T.semanas.map(String)], ['Ausentes', ...T.semanas.map((w) => String(AUS[w].reduce((a, b) => a + b, 0)))],
        ['Tasa %', ...T.tasas.map((t) => pct(t))], ['Acum. %', ...C.acumulado.valores.map((v) => fx(v, 2))]];
    table(s, filas.map((r, i) => r.map((c, j) => ({ text: c, options: i === 0 ? HEAD : { align: 'center', bold: j === 0, color: j === 0 ? S.text2 : S.text1 } }))), { x: 6.7, y: 2.3, w: 6.03, colW: [1.23, ...Array(8).fill(0.6)], rowH: 0.5, fontSize: 13 });
    tx(s, 'Cada sesión además tiene 1 retardo. El viernes concentra más ausencias (se ve en la sección 10).', { x: 6.7, y: 4.55, w: 6.03, h: 0.7, fontSize: 14, color: S.text1, transparency: 25 });
    tx(s, 'Todos los resultados de esta presentación salen de ejecutar analizarGrupo() de SUSAN sobre estos datos.', { x: 6.7, y: 5.35, w: 6.03, h: 0.8, fontSize: 14, bold: true, color: S.text2 });
    s.addNotes('Antes de aplicar métodos hay que convertir la asistencia en números: la tasa semanal y el acumulado. La tabla es el caso de estudio que vamos a seguir en toda la presentación.');
}

// ================= 5. Mapa de métodos =================
{
    const s = content('4. Métodos numéricos implementados', 'Métodos');
    const rows = [
        ['Familia', 'Métodos', 'Para qué se usa en SUSAN'],
        ['Sistemas lineales', 'Gauss con pivoteo parcial, LU (PA = LU), número de condición', 'Resolver las ecuaciones normales de la regresión'],
        ['Regresión', 'Mínimos cuadrados lineal y polinomial, r², r² ajustado, AIC', 'Tendencia y curvatura del ausentismo'],
        ['Interpolación', 'Lagrange, diferencias divididas de Newton, spline cúbico natural', 'Rellenar semanas sin clase'],
        ['Suavizado', 'Promedio móvil simple, exponencial y ponderado', 'Ver la tendencia sin ruido'],
        ['Derivación', 'Diferencias finitas (adelante, atrás, centrales), Richardson', 'Tasa de cambio por semana'],
        ['Integración', 'Trapecio, Simpson 1/3 y 3/8, Romberg', 'Ausentismo acumulado como área'],
        ['Raíces', 'Bisección, falsa posición, secante, Newton-Raphson', 'Semana en que se cruza el límite'],
        ['Estadística', 'z-score, Pearson, autocorrelación, CUSUM, EWMA', 'Cambios de nivel y alumnos atípicos'],
    ];
    table(s, rows.map((r, i) => r.map((c, j) => ({ text: c, options: i === 0 ? { ...HEAD, align: j === 0 ? 'center' : 'left' } : { align: 'left', bold: j === 0, color: j === 0 ? S.text2 : S.text1 } }))),
        { x: 0.6, y: 1.4, w: 12.13, colW: [2.2, 5.33, 4.6], rowH: 0.52, fontSize: 14 });
    s.addNotes('Son ocho familias de métodos del temario. Cada una tiene un uso concreto dentro del sistema; no son ejercicios sueltos.');
}

// ================= 6. Regresión =================
{
    const s = content('5. Mínimos cuadrados: la tendencia', 'Métodos');
    tx(s, [
        { text: 'Modelo', options: { bold: true, color: S.text2, breakLine: true } },
        { text: 'r(w) = β₀ + β₁·w', options: { fontFace: 'Cambria', italic: true, fontSize: 18, breakLine: true, paraSpaceAfter: 8 } },
        { text: 'Ecuaciones normales', options: { bold: true, color: S.text2, breakLine: true } },
        { text: '(X', options: { fontFace: 'Cambria', italic: true, fontSize: 18 } }, { text: 'T', options: { fontFace: 'Cambria', italic: true, fontSize: 18, superscript: true } }, { text: 'X) β = X', options: { fontFace: 'Cambria', italic: true, fontSize: 18 } }, { text: 'T', options: { fontFace: 'Cambria', italic: true, fontSize: 18, superscript: true } }, { text: 'y', options: { fontFace: 'Cambria', italic: true, fontSize: 18, breakLine: true } },
        { text: 'resueltas con eliminación de Gauss con pivoteo parcial.', options: { fontSize: 14, breakLine: true, paraSpaceAfter: 14 } },
    ], { x: 0.6, y: 1.45, w: 4.6, h: 2.6, fontSize: 16 });
    const stats = [[`+${fx(T.pendientePuntosPorSemana, 2)}`, 'puntos % por semana (pendiente β₁)'], [fx(AJ.r2, 3), 'r²: la recta explica el 99.5 % de la variación'], [`${pct(AJ.intercepto)} %`, 'intercepto β₀']];
    stats.forEach(([v, l], i) => {
        const y = 4.0 + i * 0.9;
        tx(s, v, { x: 0.6, y, w: 1.9, h: 0.75, fontSize: 30, bold: true, color: i === 0 ? S.accent4 : S.text2, valign: 'middle' });
        tx(s, l, { x: 2.55, y, w: 2.7, h: 0.75, fontSize: 14, valign: 'middle' });
    });
    s.addChart(pres.charts.LINE, [
        { name: 'Tasa observada', labels: T.semanas.map((w) => `S${w}`), values: T.tasas.map((t) => +pct(t, 2)) },
        { name: 'Ajuste lineal', labels: T.semanas.map((w) => `S${w}`), values: T.semanas.map((w) => +pct(AJ.intercepto + AJ.pendiente * w, 2)) },
    ], { ...chartBase('Ausentismo semanal (%)'), x: 5.6, y: 1.4, w: 7.13, h: 5.2, chartColors: [NAVY, GOLD], lineSize: 2.5, lineDataSymbol: 'circle', lineDataSymbolSize: 8,
        valAxisMinVal: 0, valAxisMaxVal: 20, valAxisMajorUnit: 5, objectName: 'Grafica regresion' });
    s.addNotes(`La pendiente dice que cada semana el ausentismo sube ${fx(T.pendientePuntosPorSemana, 2)} puntos porcentuales; con r² = ${fx(AJ.r2, 3)} la tendencia es clara. SUSAN la clasifica como "al alza" porque supera el umbral de ±0.25 pp por semana.`);
}

// ================= 7. Selección de modelo y proyección =================
{
    const s = content('6. ¿Recta o parábola? Validación cruzada', 'Métodos');
    lead(s, 'Se ajustan polinomios de grado 1 y 2 y se elige con el error de validación cruzada leave-one-out (LOO). La parábola solo gana si mejora el error al menos 2 %.');
    const rows = [['Modelo', 'r²', 'r² ajust.', 'AIC', 'RMSE LOO'],
        ['Grado 1 (recta)', fx(c1.r2, 4), fx(c1.r2Ajustado, 4), fx(c1.aic, 1), `${pct(c1.errorLOO, 2)} pp`],
        ['Grado 2 (parábola)', fx(c2.r2, 4), fx(c2.r2Ajustado, 4), fx(c2.aic, 1), `${pct(c2.errorLOO, 2)} pp`]];
    table(s, rows.map((r, i) => r.map((c, j) => ({ text: c, options: i === 0 ? HEAD : { align: j === 0 ? 'left' : 'center', bold: i === 1, color: i === 1 ? S.text2 : S.text1, fill: { color: i === 1 ? TINT : 'FFFFFF' } } }))),
        { x: 0.6, y: 2.25, w: 5.6, colW: [1.9, 0.9, 0.95, 0.85, 1.0], rowH: 0.48 });
    tx(s, [
        { text: 'Gana la recta. ', options: { bold: true, color: S.text2 } },
        { text: 'La parábola tiene un r² apenas mayor, pero predice peor los datos que no vio (LOO) y su AIC es más alto: está sobreajustando.' },
    ], { x: 0.6, y: 3.85, w: 5.6, h: 1.1, fontSize: 15 });
    tx(s, [
        { text: 'Intervalo de predicción al 95 %', options: { bold: true, color: S.text2, breakLine: true } },
        ...[['ŷ ± t·s·√(1 + φ', 0], ['T', 1], ['(X', 0], ['T', 1], ['X)', 0], ['−1', 1], ['φ)', 0]].map(([t, sup]) => ({ text: t, options: { fontFace: 'Cambria', italic: true, fontSize: 17, superscript: !!sup } })),
    ], { x: 0.6, y: 5.1, w: 5.6, h: 1.0, fontSize: 15 });
    const sem = Array.from({ length: 16 }, (_, i) => i + 1);
    const pmap = Object.fromEntries(P.puntos.map((p) => [p.semana, p]));
    const val = (w, k) => (pmap[w] ? +pct(pmap[w][k], 2) : (w === 8 && k === 'valor' ? +pct(T.tasas[7], 2) : null));
    s.addChart(pres.charts.LINE, [
        { name: 'Observada', labels: sem.map((w) => `S${w}`), values: sem.map((w) => (w <= 8 ? +pct(T.tasas[w - 1], 2) : null)) },
        { name: 'Proyección', labels: sem.map((w) => `S${w}`), values: sem.map((w) => (w >= 8 ? (w === 8 ? +pct(T.tasas[7], 2) : val(w, 'valor')) : null)) },
        { name: 'Límite inferior 95 %', labels: sem.map((w) => `S${w}`), values: sem.map((w) => val(w, 'inferior')) },
        { name: 'Límite superior 95 %', labels: sem.map((w) => `S${w}`), values: sem.map((w) => val(w, 'superior')) },
    ], { ...chartBase('Proyección del ausentismo semanal (%)'), x: 6.6, y: 2.2, w: 6.13, h: 4.45, chartColors: [NAVY, GOLD, '9CA3AF', '9CA3AF'], lineSize: 2, lineDataSymbol: 'none',
        displayBlanksAs: 'gap', valAxisMinVal: 0, valAxisMaxVal: 40, valAxisMajorUnit: 10, objectName: 'Grafica proyeccion' });
    s.addNotes('Aquí aplicamos un criterio de modelado: no basta con el r² más alto. La validación cruzada deja fuera un punto a la vez y mide qué tan bien se predice; la recta gana, así que la proyección es lineal con su intervalo de 95 %.');
}

// ================= 8. Raíces =================
{
    const s = content('7. Cruce del límite: bisección vs Newton', 'Métodos');
    lead(s, `Se ajusta el acumulado A(t) con un polinomio y se resuelve f(t) = A(t) − 20 = 0. Un barrido con paso de 0.25 semanas encuentra el intervalo [15.75, 16.0].`);
    const nt = C.newton.traza; const bt = C.biseccion.traza;
    tx(s, 'Bisección', { x: 0.6, y: 2.2, w: 5.8, h: 0.4, fontSize: 18, bold: true, color: S.text2 });
    table(s, [['Iter.', 't', 'f(t)', 'Error'], ...[...bt.slice(0, 3), bt[bt.length - 1]].map((r) => [r.iter, fx(r.x, 6), r.fx.toExponential(2), r.error.toExponential(1)])],
        { x: 0.6, y: 2.65, w: 5.8, colW: [0.9, 1.7, 1.6, 1.6] });
    tx(s, 'Newton-Raphson', { x: 6.93, y: 2.2, w: 5.8, h: 0.4, fontSize: 18, bold: true, color: S.text2 });
    table(s, [['Iter.', 't', 'f(t)', 'Error'], ...nt.map((r) => [r.iter, fx(r.x, 9), r.fx.toExponential(2), r.error.toExponential(1)])],
        { x: 6.93, y: 2.65, w: 5.8, colW: [0.9, 1.9, 1.5, 1.5] });
    tx(s, 't(k+1) = t(k) − f(t(k)) / f′(t(k)), con derivada analítica', { x: 6.93, y: 4.25, w: 5.8, h: 0.4, fontFace: 'Cambria', italic: true, fontSize: 15 });
    const stats = [[`${bt.length}`, 'iteraciones de bisección (convergencia lineal)'], [`${nt.length}`, 'iteraciones de Newton (convergencia cuadrática)'], [`${fx(C.t, 2)}`, `semanas: el grupo cruza el 20 % en la semana ${C.semana} de 16`]];
    stats.forEach(([v, l], i) => {
        const x = 0.6 + i * 4.18;
        card(s, x, 4.95, 3.95, 1.6, `Dato raiz ${i}`);
        tx(s, v, { x: x + 0.25, y: 5.05, w: 3.5, h: 0.75, fontSize: 36, bold: true, color: i === 2 ? S.accent4 : S.text2 });
        tx(s, l, { x: x + 0.25, y: 5.8, w: 3.5, h: 0.65, fontSize: 14 });
    });
    s.addNotes(`Los dos métodos llegan a la misma raíz, t ≈ ${fx(C.t, 4)}. Bisección es segura pero lenta: divide el intervalo a la mitad ${bt.length} veces. Newton usa la derivada y en ${nt.length} iteraciones ya tiene error del orden de 1e-12. SUSAN usa bisección como resultado y Newton como contraste. La alerta para el docente: "cruce proyectado en la semana ${C.semana}".`);
}

// ================= 9. Interpolación =================
{
    const s = content('8. Interpolación: semanas sin clase', 'Métodos');
    lead(s, 'Si una semana se suspende (puente, evento, paro), la serie tiene un hueco. Para suavizar y detectar cambios se rellena con un spline cúbico natural; la regresión usa solo semanas reales.');
    const tr = R5.suavizado.tasasRellenas;
    s.addChart(pres.charts.LINE, [
        { name: 'Semanas observadas', labels: tr.map((_, i) => `S${i + 1}`), values: R5.tendencia.tasas.map((t) => (t == null ? null : +pct(t, 2))) },
        { name: 'Spline cúbico natural', labels: tr.map((_, i) => `S${i + 1}`), values: tr.map((t, i) => (i >= 3 && i <= 5 ? +pct(t, 2) : null)) },
    ], { ...chartBase('Semana 5 suspendida: valor interpolado (%)'), x: 0.6, y: 2.3, w: 6.6, h: 4.3, chartColors: [NAVY, GOLD], lineSize: 2.5, lineDataSymbol: 'circle', lineDataSymbolSize: 8,
        displayBlanksAs: 'gap', valAxisMinVal: 0, valAxisMaxVal: 20, valAxisMajorUnit: 5, objectName: 'Grafica spline' });
    card(s, 7.6, 2.3, 5.13, 1.75, 'Dato spline');
    tx(s, `${pct(spline5, 2)} %`, { x: 7.85, y: 2.4, w: 4.6, h: 0.8, fontSize: 40, bold: true, color: S.text2 });
    tx(s, `valor estimado para la semana 5; el real era ${pct(T.tasas[4], 2)} % (error de ${fx(Math.abs(spline5 - T.tasas[4]) * 100, 2)} pp).`, { x: 7.85, y: 3.2, w: 4.6, h: 0.75, fontSize: 14 });
    tx(s, [
        { text: '¿Por qué spline y no un polinomio de grado alto?', options: { bold: true, color: S.text2, breakLine: true } },
        { text: 'Con muchos nodos, Lagrange oscila en los extremos (fenómeno de Runge). El spline une cúbicas por tramos con primera y segunda derivada continuas y S″ = 0 en los extremos.', options: { breakLine: true, paraSpaceAfter: 8 } },
        { text: 'Lagrange y diferencias divididas de Newton también están implementados; las pruebas comprueban que dan el mismo polinomio.' },
    ], { x: 7.6, y: 4.3, w: 5.13, h: 2.3, fontSize: 14 });
    s.addNotes('Probamos quitando la semana 5 del caso de estudio. El spline la reconstruye con un error de una fracción de punto porcentual, porque la serie es suave.');
}

// ================= 10. Derivación e integración =================
{
    const s = content('9. Derivación e integración numérica', 'Métodos');
    const sR = rich.find((v) => v.etiqueta === 'Richardson').valor; const sA = rich.find((v) => v.etiqueta === 'analítica').valor;
    const col = (x, titulo, formula, big, lbl, extra) => {
        card(s, x, 1.45, 5.85, 5.15, titulo);
        tx(s, titulo, { x: x + 0.3, y: 1.65, w: 5.25, h: 0.45, fontSize: 20, bold: true, color: S.text2 });
        tx(s, formula, { x: x + 0.3, y: 2.2, w: 5.25, h: 0.9, fontFace: 'Cambria', italic: true, fontSize: 16 });
        tx(s, big, { x: x + 0.3, y: 3.15, w: 5.25, h: 0.9, fontSize: 40, bold: true, color: S.text2 });
        tx(s, lbl, { x: x + 0.3, y: 4.05, w: 5.25, h: 0.6, fontSize: 14 });
        tx(s, extra, { x: x + 0.3, y: 4.75, w: 5.25, h: 1.7, fontSize: 14 });
    };
    col(0.6, 'Derivada: tasa de cambio', "f′(x) ≈ [f(x+h) − f(x−h)] / 2h\nmejorada con extrapolación de Richardson",
        `${fx(sR * 100, 4)} pp/sem`, 'velocidad a la que sube el ausentismo en la semana 8',
        `Valor analítico de la recta: ${fx(sA * 100, 4)} pp/sem. Richardson coincide hasta el error de redondeo (~1e-16). Para cada semana se usan diferencias finitas de tres puntos con nodos no uniformes.`);
    col(6.88, 'Integral: ausentismo acumulado', '∫ r(w) dw ≈ h [ r(1)/2 + r(2) + … + r(7) + r(8)/2 ]\ntrapecio sobre datos; contraste con Romberg',
        `${fx(R.resumen.areaAusentismo, 4)}`, 'tasa·semanas de ausentismo (trapecio, semanas 1 a 8)',
        `Romberg sobre la recta ajustada da ${fx(romb, 4)}. La diferencia (${fx(Math.abs(R.resumen.areaAusentismo - romb), 4)}) es el ruido de los datos que la recta no captura. Simpson 1/3 y 3/8 también están disponibles.`);
    s.addNotes('La derivada responde "qué tan rápido empeora" y la integral "cuánto ausentismo se ha acumulado". El área es útil para comparar grupos aunque tengan distinta forma de curva.');
}

// ================= 11. Patrones =================
{
    const s = content('10. Patrones: día crítico y cambio de nivel', 'Métodos');
    const dias = R.patronSemanal.dias;
    s.addChart(pres.charts.BAR, [{ name: 'Tasa de ausentismo', labels: dias.map((d) => d.nombre), values: dias.map((d) => +pct(d.tasa, 1)) }],
        { ...chartBase('Ausentismo por día de la semana (%)'), showLegend: false, x: 0.6, y: 1.45, w: 6.2, h: 4.4, barDir: 'col', chartColors: [NAVY], invertedColors: [NAVY],
            showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: INK, dataLabelFontSize: 13, dataLabelFontFace: '+mn-lt', dataLabelFormatCode: '0.0', valAxisMinVal: 0, valAxisMaxVal: 20, barGapWidthPct: 80, objectName: 'Grafica dias' });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 5.9, w: 6.2, h: 0.01, fill: { color: S.background1 }, line: { color: S.background1 } });
    tx(s, `${R.patronSemanal.nombreDiaCritico} es el día crítico: ${pct(dias[2].tasa)} % contra ${pct(dias[0].tasa)} % del lunes.`, { x: 0.6, y: 6.0, w: 6.2, h: 0.6, fontSize: 15, bold: true, color: S.text2 });
    tx(s, [
        { text: 'Cambio de nivel con CUSUM', options: { bold: true, color: S.text2, fontSize: 18, breakLine: true } },
        { text: 'S(t) = máx[ 0, S(t−1) + x(t) − μ0 − k ]', options: { fontFace: 'Cambria', italic: true, fontSize: 16, breakLine: true } },
        { text: 'k = 0.5σ, alarma cuando S(t) > h = 4σ; línea base: primer tercio de la serie. Se contrasta con una carta EWMA (λ = 0.3, L = 3).', options: { breakLine: true } },
    ], { x: 7.3, y: 1.5, w: 5.43, h: 2.1, fontSize: 14 });
    card(s, 7.3, 3.85, 5.43, 2.75, 'Resultado CUSUM');
    tx(s, [
        { text: `Semana ${R.cambios.semanaCambio}`, options: { fontSize: 36, bold: true, color: S.text2, breakLine: true } },
        { text: `el ausentismo cambió de nivel (al alza); la alarma se dispara en la semana ${R.cambios.semanaDeteccion}.`, options: { breakLine: true, paraSpaceAfter: 8 } },
        { text: 'Útil para el docente: dice desde cuándo empezó el problema, no solo que existe.', options: { italic: true } },
    ], { x: 7.55, y: 4.0, w: 4.95, h: 2.5, fontSize: 14 });
    s.addNotes('CUSUM acumula las desviaciones sobre la media de referencia; cuando la suma pasa el umbral da la alarma y la semana de cambio es la última en que la suma valía cero.');
}

// ================= 12. Riesgo =================
{
    const s = content('11. Riesgo por alumno (0 a 100)', 'Métodos');
    lead(s, 'Cada alumno recibe un puntaje que suma siete factores acotados. Es explicable: el docente ve qué factor pesa más y una acción sugerida.');
    const rows = [['Factor', 'Máx.', 'Método numérico'],
        ['Distancia al límite', '25', '% de faltas / límite'],
        ['Proyección al cierre', '20', 'Extrapolación con su ritmo propio'],
        ['Pendiente reciente', '15', 'MCO sobre las últimas ≤ 8 sesiones'],
        ['Faltas consecutivas', '15', 'Racha (justificado no la corta)'],
        ['z-score frente al grupo', '10', 'z = (x − μ) / σ'],
        ['Retardos acumulados', '10', 'retardos / (2 · 3)'],
        ['Concentración por día', '5', 'Participación del día dominante']];
    table(s, rows.map((r, i) => r.map((c, j) => ({ text: c, options: i === 0 ? { ...HEAD, align: j === 1 ? 'center' : 'left' } : { align: j === 1 ? 'center' : 'left', bold: j === 1, color: j === 1 ? S.text2 : S.text1 } }))),
        { x: 0.6, y: 2.3, w: 7.6, colW: [2.6, 0.8, 4.2], rowH: 0.47, fontSize: 14 });
    const niveles = [['Alto', '≥ 60 o ya superó el límite', S.accent4], ['Medio', '35 a 59', S.accent2], ['Bajo', '< 35', S.text2]];
    tx(s, 'Nivel de riesgo', { x: 8.7, y: 2.3, w: 4.0, h: 0.45, fontSize: 18, bold: true, color: S.text2 });
    niveles.forEach(([n, r, c], i) => {
        const y = 2.9 + i * 1.2;
        s.addShape(pres.shapes.OVAL, { x: 8.7, y: y + 0.1, w: 0.7, h: 0.7, fill: { color: c }, line: { color: c }, objectName: `Nivel ${n}` });
        tx(s, n, { x: 9.6, y, w: 3.1, h: 0.45, fontSize: 18, bold: true });
        tx(s, `puntaje ${r}`, { x: 9.6, y: y + 0.45, w: 3.1, h: 0.45, fontSize: 14 });
    });
    s.addNotes('Los pesos son heurísticos y están centralizados en un solo archivo para poder ajustarlos. Lo importante es que cada parte del puntaje viene de un método numérico distinto y se puede explicar.');
}

// ================= 13. Verificación =================
pres.addSection({ title: 'Resultados' });
{
    const s = content('12. Verificación y resultados', 'Resultados');
    const big = [['110', 'pruebas automáticas aprobadas (11 archivos, Vitest)'], ['0', 'librerías externas de cálculo: todo implementado a mano'], ['4', 'alertas para el docente en el caso de estudio']];
    big.forEach(([v, l], i) => {
        const y = 1.45 + i * 1.7;
        card(s, 0.6, y, 4.6, 1.5, `Cifra ${i}`);
        tx(s, v, { x: 0.85, y: y + 0.1, w: 1.6, h: 1.3, fontSize: 48, bold: true, color: S.text2, valign: 'middle' });
        tx(s, l, { x: 2.45, y: y + 0.1, w: 2.6, h: 1.3, fontSize: 14, valign: 'middle' });
    });
    tx(s, 'Casos con respuesta conocida', { x: 5.7, y: 1.45, w: 7.0, h: 0.45, fontSize: 18, bold: true, color: S.text2 });
    table(s, [['Prueba', 'Esperado'],
        ['Newton-Raphson sobre x² − 2', '√2 = 1.414213…'],
        ['Bisección sobre cos(x) − x', '0.739085…'],
        ['Simpson de sen(x) en [0, π]', '2'],
        ['Spline en los nudos', 'reproduce los datos'],
        ['Lagrange vs Newton (dif. divididas)', 'mismo polinomio'],
        ['Matriz de Hilbert', 'número de condición alto (mal condicionada)'],
        ['CUSUM con salto sintético', 'detecta la semana del salto']].map((r, i) => r.map((c) => ({ text: c, options: i === 0 ? { ...HEAD, align: 'left' } : { align: 'left' } }))),
    { x: 5.7, y: 1.95, w: 7.03, colW: [3.6, 3.43], rowH: 0.4, fontSize: 13 });
    tx(s, `Alertas del caso: cruce proyectado (semana ${C.semana}), tendencia al alza, cambio de nivel desde la semana ${R.cambios.semanaCambio}, día crítico ${R.patronSemanal.nombreDiaCritico.toLowerCase()}.`, { x: 5.7, y: 5.4, w: 7.03, h: 0.9, fontSize: 14, bold: true, color: S.text2 });
    s.addNotes('Validamos cada método contra problemas cuya respuesta conocemos de clase. Luego el pipeline completo con series creciente, plana y casos degenerados. En la pantalla Analítica de SUSAN el docente ve estos resultados y el procedimiento paso a paso.');
}

// ================= 14. Conclusiones generales =================
pres.addSection({ title: 'Conclusiones' });
{
    const s = content('13. Conclusiones generales', 'Conclusiones');
    const items = [
        ['Los métodos tienen un uso real', 'Cada familia del curso responde una pregunta del docente: hacia dónde va el grupo, cuándo cruza el límite, desde cuándo empeoró y quién está en riesgo.'],
        ['Elegir el método importa', 'Newton converge en 3 iteraciones contra 25 de bisección, pero bisección siempre converge; por eso se usan juntos. Un r² más alto no hace mejor a la parábola: la validación cruzada eligió la recta.'],
        ['Los datos reales son imperfectos', 'Semanas suspendidas, pocos datos y ruido obligaron a interpolar con spline, exigir un mínimo de 4 semanas y reportar intervalos en vez de un solo número.'],
        ['Explicar es parte del resultado', 'El sistema muestra los pasos (tablas, trazas de iteración) para que el docente confíe en la alerta y actúe a tiempo.'],
    ];
    items.forEach(([t, d], i) => {
        const x = 0.6 + (i % 2) * 6.18; const y = 1.45 + Math.floor(i / 2) * 2.6;
        card(s, x, y, 5.95, 2.4, t);
        s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.3, w: 0.55, h: 0.55, fill: { color: S.text2 }, line: { color: S.text2 }, objectName: `Num ${i + 1}` });
        tx(s, String(i + 1), { x: x + 0.3, y: y + 0.3, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: S.background1, align: 'center', valign: 'middle' });
        tx(s, t, { x: x + 1.05, y: y + 0.3, w: 4.65, h: 0.55, fontSize: 18, bold: true, color: S.text2, valign: 'middle' });
        tx(s, d, { x: x + 0.3, y: y + 1.0, w: 5.4, h: 1.3, fontSize: 15 });
    });
    s.addNotes('Cerramos con lo que aprendimos como equipo antes de las conclusiones individuales.');
}

// ================= 15-16. Conclusiones individuales =================
const CONC = [
    'Aprendí que mínimos cuadrados no es solo una fórmula: resolver las ecuaciones normales con Gauss y pivoteo parcial evita errores de redondeo, y el r² junto con la validación cruzada nos dijo cuándo confiar en la tendencia del ausentismo.',
    'Comparar bisección y Newton-Raphson sobre el mismo problema me dejó clara la diferencia entre convergencia lineal y cuadrática. Usarlos juntos da una respuesta rápida y además comprobada, que es lo que necesita una alerta para el docente.',
    'La interpolación fue clave para los datos incompletos. Ver que un polinomio de grado alto oscila y que el spline cúbico natural reconstruye la semana suspendida con poco error me enseñó a escoger el método según la forma de los datos.',
    'Integrar el módulo numérico con la base de datos y la interfaz me mostró que un método solo sirve si sus resultados se explican. Probar cada función contra casos conocidos, como Simpson de sen(x) igual a 2, nos dio confianza en todo el sistema.',
    'La derivación y la integración numérica dieron dos lecturas distintas del mismo dato: qué tan rápido empeora el grupo y cuánto ausentismo lleva acumulado. Richardson y Romberg mostraron cómo mejorar una aproximación sin cambiar los datos.',
    'Con CUSUM y el puntaje de riesgo entendí que la estadística y los métodos numéricos se complementan: no basta con saber que hay ausentismo, hay que saber desde cuándo y quiénes necesitan atención primero para intervenir a tiempo.',
];
[[0, 1, 2], [3, 4, 5]].forEach((grupo, k) => {
    const s = content(`14. Conclusiones por integrante (${k + 1} de 2)`, 'Conclusiones');
    grupo.forEach((idx, i) => {
        const x = 0.6 + i * 4.11;
        card(s, x, 1.45, 3.88, 5.15, NAMES[idx]);
        const ini = NAMES[idx].split(' ').filter((p, j, a) => j === 0 || j === a.length - 2).map((p) => p[0]).join('');
        s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: 1.7, w: 0.75, h: 0.75, fill: { color: S.text2 }, line: { color: S.text2 }, objectName: `Avatar ${idx}` });
        tx(s, ini, { x: x + 0.3, y: 1.7, w: 0.75, h: 0.75, fontSize: 16, bold: true, color: S.background1, align: 'center', valign: 'middle' });
        tx(s, NAMES[idx], { x: x + 1.2, y: 1.65, w: 2.45, h: 0.85, fontSize: 15, bold: true, color: S.text2, valign: 'middle' });
        tx(s, CONC[idx], { x: x + 0.3, y: 2.75, w: 3.3, h: 3.7, fontSize: 16, lineSpacingMultiple: 1.1 });
    });
    s.addNotes('Cada integrante lee o resume su conclusión.');
});

// ================= 17. Referencias =================
{
    const s = content('15. Referencias', 'Conclusiones');
    tx(s, [
        { text: 'Burden, R. L., Faires, J. D. y Burden, A. M. (2017). Análisis numérico (10.ª ed.). Cengage Learning.', options: { breakLine: true, paraSpaceAfter: 12 } },
        { text: 'Chapra, S. C. y Canale, R. P. (2015). Métodos numéricos para ingenieros (7.ª ed.). McGraw-Hill.', options: { breakLine: true, paraSpaceAfter: 12 } },
        { text: 'Montgomery, D. C. (2013). Introduction to Statistical Quality Control (7th ed.). Wiley. (CUSUM y EWMA)', options: { breakLine: true, paraSpaceAfter: 12 } },
        { text: 'Hastie, T., Tibshirani, R. y Friedman, J. (2009). The Elements of Statistical Learning (2nd ed.). Springer. (Validación cruzada)', options: { breakLine: true, paraSpaceAfter: 12 } },
        { text: 'Equipo SUSAN (2026). Módulo de métodos numéricos, web/src/lib/numerics, y especificación del 1er avance del proyecto integrador. UNACH.' },
    ], { x: 0.6, y: 1.5, w: 12.1, h: 4.6, fontSize: 16 });
}

// ================= 18. Cierre =================
{
    const s = pres.addSlide({ masterName: 'CIERRE', sectionTitle: 'Conclusiones' });
    s.addShape(pres.shapes.OVAL, { x: 5.67, y: 0.9, w: 2.0, h: 2.0, fill: { color: S.background1 }, line: { color: S.background1 }, objectName: 'Fondo escudo' });
    s.addImage({ path: path.join(DIR, 'unach.png'), x: 5.92, y: 1.15, w: 1.5, h: 1.5, objectName: 'Escudo cierre', altText: 'Escudo de la UNACH' });
    tx(s, 'Gracias', { x: 1.5, y: 3.2, w: 10.33, h: 1.1, fontSize: 54, bold: true, color: S.background1, align: 'center' });
    tx(s, '¿Preguntas?', { x: 1.5, y: 4.3, w: 10.33, h: 0.6, fontSize: 24, color: S.background1, align: 'center' });
    tx(s, 'SUSAN · Proyecto final de Métodos Numéricos · 3° “N”', { x: 1.5, y: 5.2, w: 10.33, h: 0.4, fontSize: 14, italic: true, color: S.background1, align: 'center', transparency: 20 });
    s.addImage({ path: path.join(DIR, 'jaguar.png'), x: 11.6, y: 5.9, w: 1.1, h: 1.13, objectName: 'Jaguar cierre', altText: 'Mascota jaguar' });
}

await pres.writeFile({ fileName: OUT });
await applyTheme(OUT, THEME);
console.log('ok', OUT);
