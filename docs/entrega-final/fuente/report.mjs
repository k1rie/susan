import fs from 'fs';
import path from 'path';
import { analizarGrupo, ajustePolinomial } from '/Users/diegoguerrero/Developer/SUSAN/web/src/lib/numerics/index.js';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = process.argv[2];
const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(DIR, f)).toString('base64')}`;

// ---------- caso de estudio (mismo que la presentacion) ----------
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
const OPC = { limitePct: 20, sesionesProgramadas: 48, retardosPorAusencia: 3 };
const R = analizarGrupo({ serie, ...OPC });
const R5 = analizarGrupo({ serie: serie.filter((s) => s.fecha < fe(5, 1) || s.fecha >= fe(6, 1)), ...OPC });
const T = R.tendencia; const AJ = T.ajuste; const P = R.proyeccion; const C = R.cruceLimite;
const proc = (id) => R.procedimientos.find((p) => p.id === id);
const paso = (id, t) => proc(id).pasos.find((p) => p.titulo.startsWith(t));
const sumas = Object.fromEntries(paso('regresion', 'Sumas').valores.map((v) => [v.etiqueta, v.valor]));
const etapa1 = paso('regresion', 'Etapa 1').matriz;
const suav = paso('suavizado', 'Medias').tabla.filas;
const cus = paso('cambio-nivel', 'CUSUM').tabla.filas;
const ew = paso('cambio-nivel', 'EWMA').tabla.filas;
const area = paso('derivacion-integracion', 'Área').tabla.filas;
const rich = paso('derivacion-integracion', 'Tabla de Richardson').tabla.filas;
const dfin = paso('derivacion-integracion', 'Tasa de cambio por semana').tabla.filas;
const cusumP = R.cambios.cusum; const ewP = R.cambios.ewma;
// ajuste cuadratico del acumulado expresado en t (el modulo trabaja en variable centrada u = (t - c) / s)
const q = ajustePolinomial(C.acumulado.semanas, C.acumulado.valores, 2);
const [k0, k1, k2] = q.coeficientes; const m = q.centro; const sc = q.escala;
const a2 = k2 / (sc * sc); const a1 = k1 / sc - 2 * k2 * m / (sc * sc); const a0 = k0 - k1 * m / sc + k2 * m * m / (sc * sc);
const spline5 = R5.suavizado.tasasRellenas[4];
const NAMES = ['Casanova Pérez Gabriela', 'Escobar Domínguez Josué Gabriel', 'Gómez Delgado Ades Yasir',
    'González Guerrero Diego Enrique', 'Peña Morales José Manuel', 'Pérez Hernández Alan Eduardo'];

const pc = (x, d = 2) => (x * 100).toFixed(d);
const n = (x, d = 4) => (x == null ? '—' : Number(x).toFixed(d));
const ex = (x, d = 2) => {
    if (x === 0) return '0';
    const [mant, e] = x.toExponential(d).split('e');
    return `${mant}×10<sup>${Number(e)}</sup>`;
};
const tabla = (cols, filas, cls = '') => `<table class="${cls}"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${
    filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
// Numeracion automatica: las expresiones del template se evaluan en el orden del documento.
let FN = 0;
const fig = (svg, _num, txt) => `<figure>${svg}<figcaption>Figura ${++FN}. ${txt}</figcaption></figure>`;
const foto = (f, txt, cls = 'captura') => fig(`<img class="${cls}" src="data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(path.join(DIR, f)).toString('base64')}" alt="${txt}"/>`, 0, txt);

// ---------- graficas SVG ----------
const NAVY = '#0B2461'; const GOLD = '#C8920E'; const GRIS = '#9CA3AF'; const ROJO = '#B42318';
function lineas({ xs, series, ymax, ymin = 0, paso, w = 620, h = 270, etiquetaX = (x) => `S${x}`, ref }) {
    const L = 48; const Rm = 16; const Tp = 14; const B = 54;
    const X = (x) => L + ((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * (w - L - Rm);
    const Y = (y) => Tp + (1 - (y - ymin) / (ymax - ymin)) * (h - Tp - B);
    let g = '';
    for (let i = 0; ymin + i * paso <= ymax + 1e-9; i += 1) {
        const y = +(ymin + i * paso).toFixed(6);
        g += `<line x1="${L}" x2="${w - Rm}" y1="${Y(y)}" y2="${Y(y)}" stroke="#E5E7EB"/><text x="${L - 8}" y="${Y(y) + 4}" text-anchor="end">${y}</text>`;
    }
    xs.forEach((x) => { g += `<text x="${X(x)}" y="${h - B + 18}" text-anchor="middle">${etiquetaX(x)}</text>`; });
    if (ref) g += `<line x1="${L}" x2="${w - Rm}" y1="${Y(ref.y)}" y2="${Y(ref.y)}" stroke="${ROJO}" stroke-dasharray="6 4" stroke-width="1.5"/><text x="${w - Rm}" y="${Y(ref.y) - 6}" text-anchor="end" fill="${ROJO}">${ref.label}</text>`;
    series.forEach((s) => {
        const pts = s.data.filter(([, y]) => y != null);
        g += `<polyline fill="none" stroke="${s.color}" stroke-width="${s.ancho || 2.2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} points="${pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}"/>`;
        if (s.puntos) pts.forEach(([x, y]) => { g += `<circle cx="${X(x)}" cy="${Y(y)}" r="3.6" fill="${s.color}"/>`; });
    });
    let lx = L;
    const ley = series.filter((s) => s.nombre).map((s) => {
        const it = `<line x1="${lx}" x2="${lx + 22}" y1="${h - 12}" y2="${h - 12}" stroke="${s.color}" stroke-width="2.5" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/><text x="${lx + 28}" y="${h - 8}">${s.nombre}</text>`;
        lx += 40 + s.nombre.length * 6.3; return it;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" class="graf">${g}${ley}</svg>`;
}
function barras({ etiquetas, valores, ymax, paso, w = 420, h = 240, resaltar }) {
    const L = 40; const B = 30; const Tp = 18; const ancho = (w - L - 10) / etiquetas.length;
    const Y = (y) => Tp + (1 - y / ymax) * (h - Tp - B);
    let g = '';
    for (let y = 0; y <= ymax; y += paso) g += `<line x1="${L}" x2="${w - 10}" y1="${Y(y)}" y2="${Y(y)}" stroke="#E5E7EB"/><text x="${L - 8}" y="${Y(y) + 4}" text-anchor="end">${y}</text>`;
    etiquetas.forEach((e, i) => {
        const x = L + i * ancho + ancho * 0.22; const bw = ancho * 0.56; const v = valores[i];
        g += `<rect x="${x}" y="${Y(v)}" width="${bw}" height="${Y(0) - Y(v)}" fill="${i === resaltar ? GOLD : NAVY}" rx="2"/>`
            + `<text x="${x + bw / 2}" y="${Y(v) - 6}" text-anchor="middle" font-weight="700">${v.toFixed(1)} %</text>`
            + `<text x="${x + bw / 2}" y="${h - 10}" text-anchor="middle">${e}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" class="graf">${g}</svg>`;
}

const sem = T.semanas;
const g1 = lineas({ xs: sem, ymax: 20, paso: 5, series: [
    { nombre: 'Tasa observada (%)', color: NAVY, puntos: true, data: sem.map((w, i) => [w, T.tasas[i] * 100]) },
    { nombre: 'Ajuste por mínimos cuadrados', color: GOLD, dash: '6 4', data: sem.map((w) => [w, (AJ.intercepto + AJ.pendiente * w) * 100]) }] });
const pm = Object.fromEntries(P.puntos.map((p) => [p.semana, p]));
const s16 = Array.from({ length: 16 }, (_, i) => i + 1);
const g2 = lineas({ xs: s16, ymax: 40, paso: 10, series: [
    { nombre: 'Observada', color: NAVY, puntos: true, data: sem.map((w, i) => [w, T.tasas[i] * 100]) },
    { nombre: 'Proyección lineal', color: GOLD, data: [[8, T.tasas[7] * 100], ...s16.filter((w) => pm[w]).map((w) => [w, pm[w].valor * 100])] },
    { nombre: 'Intervalo 95 %', color: GRIS, dash: '4 3', ancho: 1.5, data: s16.filter((w) => pm[w]).map((w) => [w, pm[w].inferior * 100]) },
    { color: GRIS, dash: '4 3', ancho: 1.5, data: s16.filter((w) => pm[w]).map((w) => [w, pm[w].superior * 100]) }] });
const g3 = lineas({ xs: s16, ymax: 25, paso: 5, ref: { y: 20, label: 'Límite 20 %' }, series: [
    { nombre: 'Acumulado observado (%)', color: NAVY, puntos: true, data: C.acumulado.semanas.map((w, i) => [w, C.acumulado.valores[i]]) },
    { nombre: 'Ajuste cuadrático', color: GOLD, dash: '6 4', data: Array.from({ length: 61 }, (_, i) => 1 + i * 0.25).map((t) => [t, a0 + a1 * t + a2 * t * t]) }] });
const tr5 = R5.suavizado.tasasRellenas;
const g4 = lineas({ xs: sem, ymax: 20, paso: 5, series: [
    { nombre: 'Semanas con clase', color: NAVY, puntos: true, data: R5.tendencia.tasas.map((t, i) => [i + 1, t == null ? null : t * 100]).filter(([x]) => x <= 4) },
    { color: NAVY, puntos: true, data: R5.tendencia.tasas.map((t, i) => [i + 1, t == null ? null : t * 100]).filter(([x]) => x >= 6) },
    { nombre: 'Tramo del spline (semana 5 estimada)', color: GOLD, dash: '6 4', puntos: true, data: [[4, tr5[3] * 100], [5, tr5[4] * 100], [6, tr5[5] * 100]] }] });
const g5 = lineas({ xs: sem, ymax: 20, paso: 5, series: [
    { nombre: 'Tasa', color: GRIS, puntos: true, data: suav.map((f) => [f[0], f[1] * 100]) },
    { nombre: 'SMA(3)', color: NAVY, data: suav.filter((f) => f[2] != null).map((f) => [f[0], f[2] * 100]) },
    { nombre: 'EMA(α = 0.5)', color: GOLD, data: suav.map((f) => [f[0], f[3] * 100]) }] });
const g6 = lineas({ xs: sem, ymax: 0.3, paso: 0.1, ref: { y: cusumP.h, label: `h = ${cusumP.h.toFixed(4)}` }, etiquetaX: (x) => `S${x}`, series: [
    { nombre: 'S⁺ (CUSUM superior)', color: NAVY, puntos: true, data: cus.map((f) => [f[0], f[2]]) }] });
const dias = R.patronSemanal.dias;
const g7 = barras({ etiquetas: dias.map((d) => d.nombre), valores: dias.map((d) => d.tasa * 100), ymax: 20, paso: 5, resaltar: 2 });

// ---------- portada ----------
const portada = `<section class="portada">
<svg class="fondo" viewBox="0 0 850 1100" preserveAspectRatio="none">
  <rect width="850" height="1100" fill="${NAVY}"/>
  <path d="M850,0 L408,0 C420,40 432,120 428,150 C420,185 395,190 330,190 L210,190 Q108,190 108,292 L108,1100 L850,1100 Z" fill="#fff"/>
  <path d="M185,1100 C200,1030 300,1022 520,1026 C700,1030 820,1050 850,1100 Z" fill="${NAVY}"/>
  <circle cx="120" cy="125" r="96" fill="#fff"/><circle cx="110" cy="1015" r="78" fill="#fff"/>
</svg>
<img class="escudo" src="${img('unach.png')}" alt="Escudo UNACH"/>
<img class="jaguar" src="${img('jaguar.png')}" alt="Jaguar"/>
<div class="uni">Benemérita Universidad<br/>Autónoma de Chiapas<div class="lema">Por La Conciencia De La Necesidad De Servir</div></div>
<div class="datos">
  <p><b>FACULTAD y LICENCIATURA:</b><br/>Escuela de Tecnologías Digitales Aplicadas, Campus I<br/>(Ingeniería en Desarrollo y Tecnologías de Software)</p>
  <p><b>NOMBRE DE LA MATERIA:</b><br/>Métodos Numéricos</p>
  <p><b>NOMBRE DE LA ACTIVIDAD:</b><br/>Proyecto Final: SUSAN<br/>Registro digital de asistencia con análisis numérico del ausentismo</p>
  <p><b>INTEGRANTES DEL EQUIPO:</b><br/>${NAMES.join('<br/>')}</p>
  <p><b>NOMBRE DEL CATEDRÁTICO:</b><br/>Mtro. Octavio Morales Jiménez</p>
  <p><b>SEMESTRE:</b> 3° <b>| GRADO:</b> “N”</p>
  <p><b>FECHA Y LUGAR DE ENTREGA:</b><br/>Noviembre 11, 2026. Tuxtla Gutiérrez, Chiapas, México</p>
</div>
</section>`;

const bt = C.biseccion.traza; const nt = C.newton.traza;
const sR = R.procedimientos.find((p) => p.id === 'derivacion-integracion').pasos.find((p) => p.titulo.startsWith('Tasa de cambio en la')).valores;
const [c1, c2] = P.candidatos;

const CONC = [
    'Aprendí que mínimos cuadrados no es solo una fórmula: resolver las ecuaciones normales con eliminación de Gauss y pivoteo parcial evita errores de redondeo, y el coeficiente r² junto con la validación cruzada nos dijo cuándo podíamos confiar en la tendencia del ausentismo. También entendí que un modelo con más parámetros no siempre es mejor; la parábola tenía un r² mayor y aun así predecía peor.',
    'Comparar bisección y Newton-Raphson sobre el mismo problema me dejó clara la diferencia entre convergencia lineal y cuadrática: 25 iteraciones contra 3 para llegar a la misma raíz. Usarlos juntos da una respuesta rápida y además comprobada, que es justo lo que necesita una alerta que va a leer un docente. El barrido previo para encontrar el intervalo fue tan importante como el método.',
    'La interpolación fue clave para manejar datos incompletos. Ver que un polinomio de grado alto oscila entre los nodos y que el spline cúbico natural reconstruye la semana suspendida con un error menor a medio punto porcentual me enseñó a escoger el método según la forma de los datos y no por costumbre. Comprobar que Lagrange y Newton dan el mismo polinomio también reforzó la teoría vista en clase.',
    'Integrar el módulo numérico con la base de datos y la interfaz me mostró que un método solo sirve si sus resultados se pueden explicar. Por eso cada función devuelve sus pasos y trazas. Probar cada método contra casos con respuesta conocida, como Simpson de sen(x) en [0, π] igual a 2 o Newton sobre x² − 2, nos dio confianza en todo el sistema antes de aplicarlo a datos de asistencia.',
    'La derivación y la integración numérica dieron dos lecturas distintas del mismo dato: qué tan rápido empeora el grupo y cuánto ausentismo lleva acumulado. La extrapolación de Richardson y el método de Romberg mostraron cómo mejorar una aproximación sin pedir más datos, solo combinando resultados con distintos tamaños de paso. Fue la parte donde más se notó la relación entre el error de truncamiento y el paso h.',
    'Con CUSUM y el puntaje de riesgo entendí que la estadística y los métodos numéricos se complementan: no basta con saber que hay ausentismo, hay que saber desde cuándo empezó y qué alumnos necesitan atención primero. Diseñar un puntaje explicable, donde cada factor sale de un método distinto, me hizo pensar en cómo presentar los números para que el docente pueda actuar a tiempo.',
];

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>SUSAN · Reporte final de Métodos Numéricos</title>
<style>
@page { size: Letter; margin: 0.8in 0.95in 0.85in; @bottom-right { content: counter(page); font: 9pt Arial; color: #6B7280; } }
@page portada { margin: 0; @bottom-right { content: none; } }
* { box-sizing: border-box; }
body { font-family: Arial, 'Liberation Sans', Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.55; color: #222; margin: 0; }
.portada { page: portada; position: relative; width: 8.5in; height: 11in; page-break-after: always; overflow: hidden; }
.portada .fondo { position: absolute; inset: 0; width: 100%; height: 100%; }
.portada .escudo { position: absolute; left: 0.5in; top: 0.55in; width: 1.4in; }
.portada .jaguar { position: absolute; left: 0.47in; top: 9.5in; width: 1.27in; }
.portada .uni { position: absolute; left: 4.45in; top: 0.28in; width: 3.9in; font-size: 23pt; font-weight: 700; line-height: 1.12; color: #111; }
.portada .lema { font-size: 11pt; font-style: italic; font-weight: 700; margin-top: 8px; padding-left: 0.08in; }
.portada .datos { position: absolute; left: 1.45in; top: 2.0in; width: 6.7in; text-align: center; font-size: 11pt; line-height: 1.6; }
.portada .datos p { margin: 0 0 11px; text-align: center; }
h1 { color: ${NAVY}; font-size: 19pt; margin: 0 0 6px; }
.sub { color: #6B7280; font-size: 11pt; text-align: justify; margin: 0 0 18px; }
h2 { color: ${NAVY}; font-size: 14pt; margin: 22px 0 10px; padding-bottom: 6px; border-bottom: 1.2px solid ${NAVY}; page-break-after: avoid; }
h3 { color: ${NAVY}; font-size: 11.5pt; margin: 16px 0 6px; page-break-after: avoid; }
p { text-align: justify; margin: 0 0 9px; }
ul, ol { margin: 0 0 9px; padding-left: 22px; } li { margin-bottom: 3px; }
.eq { font-family: 'Times New Roman', Times, serif; font-size: 13pt; text-align: center; margin: 8px 0 12px; }
table { border-collapse: collapse; margin: 8px auto 14px; font-size: 9.5pt; page-break-inside: avoid; }
th { background: ${NAVY}; color: #fff; font-weight: 700; padding: 5px 9px; border: 1px solid #C9D2E3; }
td { padding: 4px 9px; border: 1px solid #C9D2E3; text-align: center; }
table.izq td { text-align: left; } table.ancha { width: 100%; }
figure { margin: 10px 0 14px; text-align: center; page-break-inside: avoid; }
img.captura { width: 100%; border: 1px solid #D1D5DB; border-radius: 4px; }
img.logo { width: 4.6in; }
img.movil { width: 2.1in; border: 1px solid #D1D5DB; border-radius: 10px; }
figcaption { font-size: 8.5pt; color: #6B7280; margin-top: 4px; }
.graf { max-width: 100%; height: auto; font: 10px Arial, sans-serif; fill: #374151; }
.nota { background: #F1F4F9; border-left: 4px solid ${NAVY}; padding: 9px 13px; font-size: 9.5pt; margin: 10px 0 14px; page-break-inside: avoid; }
.nota p { margin: 0; }
.integrante { margin-bottom: 12px; page-break-inside: avoid; }
.integrante b { color: ${NAVY}; }
.salto { page-break-before: always; }
.ref p { padding-left: 28px; text-indent: -28px; text-align: left; }
</style></head><body>
${portada}

<h1>Proyecto Final — SUSAN: análisis numérico del ausentismo</h1>
<p class="sub">Sistema centralizado de registro digital de asistencia académica con reconocimiento facial y análisis del ausentismo mediante sistemas lineales, mínimos cuadrados, interpolación, derivación e integración numérica, búsqueda de raíces y control estadístico.</p>

<h2>1. Introducción</h2>
<p>En la mayoría de las aulas el pase de lista sigue siendo manual: el docente nombra a cada alumno, anota el resultado en una lista impresa y al final del periodo vuelve a capturar los conteos. Con 5 minutos por sesión, 3 sesiones por semana y 16 semanas, el pase de lista consume alrededor de <b>4 horas de clase por grupo al semestre</b>. Además, el registro en papel no permite ver tendencias: el alumno no sabe cuántas faltas lleva hasta que es tarde y el docente no detecta a tiempo a quién se está alejando del aula.</p>
<p>SUSAN resuelve las dos partes del problema. Primero, registra la asistencia automáticamente con una cámara en el aula y un servicio de reconocimiento facial. Segundo, convierte ese registro en series numéricas y les aplica los métodos vistos en el curso para responder preguntas concretas: ¿el ausentismo del grupo va al alza?, ¿en qué semana alcanzará el límite reglamentario?, ¿desde cuándo empeoró?, ¿qué alumnos están en riesgo? Este reporte se centra en la segunda parte, el análisis numérico.</p>

<h2>2. Objetivos</h2>
<p><b>Objetivo general.</b> Reducir el tiempo de pase de lista con un registro digital y generar historiales consolidados que, analizados con métodos numéricos, identifiquen patrones de ausentismo para orientar la intervención docente oportuna.</p>
<p><b>Objetivos específicos.</b></p>
<ul>
<li>Implementar, sin librerías externas, los métodos numéricos del curso: sistemas lineales, regresión, interpolación, suavizado, derivación, integración y búsqueda de raíces.</li>
<li>Medir la tendencia semanal del ausentismo de cada grupo y elegir el modelo de proyección con validación cruzada.</li>
<li>Estimar la semana en que el grupo alcanzará el límite de 20 % de faltas, contrastando bisección y Newton-Raphson.</li>
<li>Detectar cambios de nivel, días críticos y alumnos en riesgo, y mostrar el procedimiento de cada cálculo al docente.</li>
</ul>

<h2>3. Descripción del sistema</h2>
<p>El flujo de SUSAN tiene cinco etapas. (1) <b>Captura:</b> la cámara del aula toma fotografías durante la ventana de tolerancia. (2) <b>Reconocimiento:</b> cada rostro se convierte en un vector de 512 dimensiones y se busca en un índice FAISS con los alumnos inscritos. (3) <b>Asistencia:</b> varias lecturas del mismo alumno en capturas distintas confirman su presencia; los casos dudosos pasan a revisión del docente. (4) <b>Serie:</b> PostgreSQL consolida cada sesión (inscritos, presentes, ausentes, retardos, justificados). (5) <b>Análisis numérico:</b> el módulo <code>web/src/lib/numerics</code> procesa la serie y genera tendencia, proyección, cruce del límite, cambios de nivel y riesgo por alumno, que el docente consulta en la pantalla «Analítica».</p>
<p>La aplicación está construida con Next.js (interfaz y servidor), Supabase sobre PostgreSQL 16 (base de datos, autenticación y almacenamiento) y un servicio en Python/FastAPI con FAISS para el reconocimiento. El módulo de métodos numéricos está escrito en JavaScript puro, con funciones deterministas que validan su entrada y devuelven su procedimiento (pasos, tablas y trazas de iteración) para fines didácticos.</p>

${foto('informe-assets/logo-full.png', 'Logotipo de SUSAN: escudo de la UNACH, nombre del sistema y escudo de la FCA C-I, como aparece en la pantalla de inicio de sesión.', 'logo')}
<h3>3.1 Interfaz del software</h3>
<p>La interfaz usa un lienzo crema con paneles blancos, la tipografía Hanken Grotesk y estados de asistencia siempre con texto y color. Las gráficas están hechas a mano, sin librerías, y cada pantalla abre con sus cifras clave. Las capturas corresponden al escenario de demostración, con datos de prueba.</p>
${foto('capturas/pantalla-login-pasa-lista.jpg', 'Inicio de sesión. El acceso es por rol (administrador, docente o alumno).')}
${foto('capturas/pantalla-home-docente.jpg', 'Panel del docente: sesiones del día, botón «Abrir y pasar lista», pendientes de revisión y alertas de alumnos cerca del límite.')}
${foto('capturas/pantalla-pasar-lista-maqueta.jpg', 'Pasar lista: la cámara captura al grupo y cada alumno reconocido se marca presente.')}
${foto('capturas/pantalla-revision-caso.jpg', 'Revisión: los casos dudosos llegan al docente con el score de cada lectura.')}
${foto('capturas/pantalla-analitica-3a.jpg', 'Analítica: aquí se muestran los resultados de los métodos numéricos de la sección 5 (tendencia, proyección, cruce del límite, alertas y riesgo).')}
${foto('capturas/pantalla-reportes-3a.jpg', 'Reportes: asistencia acumulada, faltas por alumno contra el límite y exportación a CSV o PDF.')}
${foto('capturas/pantalla-alumno-limite.jpg', 'Vista del alumno: su porcentaje de asistencia y el aviso cuando se acerca al límite.')}
${foto('capturas/movil-home-docente.jpg', 'La misma aplicación en un teléfono.', 'movil')}

<h2>4. Datos y definiciones</h2>
<p>Para ilustrar cada método se usa un caso de estudio: un grupo de <b>35 alumnos</b> con 3 sesiones por semana (lunes, miércoles y viernes), <b>48 sesiones programadas</b> en el semestre y 8 semanas observadas. Cada sesión tiene además un retardo. Todos los valores de este reporte se obtuvieron ejecutando la función <code>analizarGrupo()</code> de SUSAN sobre estos datos.</p>
<p class="eq">r(w) = Σ ausentes / Σ inscritos &nbsp;&nbsp;&nbsp;&nbsp; A(w) = 100 · Σ (ausentes + retardos/3) / inscritos / 48</p>
<p>La <b>tasa semanal</b> r(w) es la fracción de inasistencias de la semana w. El <b>acumulado</b> A(w) es el porcentaje promedio de faltas equivalentes que lleva un alumno respecto al periodo completo (3 retardos equivalen a una falta). El alumno pierde el derecho a examen si sus faltas equivalentes superan el 20 % de las sesiones programadas.</p>
${tabla(['Semana', ...sem], [
    ['Ausentes', ...sem.map((w) => AUS[w].reduce((a, b) => a + b, 0))],
    ['Tasa r(w) %', ...T.tasas.map((t) => pc(t))],
    ['Acumulado A(w) %', ...C.acumulado.valores.map((v) => v.toFixed(2))]])}
<p>Con menos de 4 semanas observadas el sistema marca los datos como insuficientes y no calcula tendencia ni proyección; el patrón por día y el riesgo por alumno sí se calculan.</p>

<h2>5. Desarrollo: métodos numéricos aplicados</h2>
${tabla(['Familia', 'Métodos implementados', 'Uso en SUSAN'], [
    ['Sistemas lineales', 'Gauss con pivoteo parcial, factorización LU (PA = LU), número de condición', 'Ecuaciones normales de la regresión'],
    ['Regresión', 'Mínimos cuadrados lineal y polinomial, r², r² ajustado, AIC', 'Tendencia y curvatura'],
    ['Interpolación', 'Lagrange, diferencias divididas de Newton, spline cúbico natural', 'Semanas sin clase'],
    ['Suavizado', 'Medias móviles simple (SMA), exponencial (EMA) y ponderada (WMA)', 'Tendencia sin ruido'],
    ['Derivación', 'Diferencias finitas hacia adelante, atrás y centrales; Richardson', 'Tasa de cambio'],
    ['Integración', 'Trapecio, Simpson 1/3 y 3/8, Romberg', 'Ausentismo acumulado'],
    ['Raíces', 'Bisección, falsa posición, secante, Newton-Raphson', 'Semana de cruce del límite'],
    ['Estadística', 'Media, varianza, z-score, Pearson, autocorrelación, CUSUM, EWMA', 'Cambios de nivel y riesgo']], 'izq ancha')}

<h3>5.1 Sistemas de ecuaciones lineales y mínimos cuadrados</h3>
<p>La tendencia se modela con una recta r(w) = a + b·w. Minimizar la suma de los cuadrados de los residuos lleva a las ecuaciones normales, un sistema lineal de 2×2 que SUSAN resuelve con eliminación de Gauss y pivoteo parcial:</p>
<p class="eq">n·a + (Σw)·b = Σr &nbsp;&nbsp;&nbsp;&nbsp; (Σw)·a + (Σw²)·b = Σw·r</p>
<p>Con los datos del caso: n = ${sumas.n}, Σw = ${sumas['Σx']}, Σw² = ${sumas['Σx²']}, Σr = ${n(sumas['Σy'], 6)} y Σw·r = ${n(sumas['Σxy'], 6)}. Como |36| &gt; |8|, el pivoteo parcial intercambia las filas antes de eliminar (multiplicador m<sub>21</sub> = 0.2222), lo que reduce el error de redondeo:</p>
${tabla(['', 'a', 'b', 'término independiente'], [['Fila 1 (pivote)', etapa1[0][0], etapa1[0][1], n(etapa1[0][2], 6)], ['Fila 2 (eliminada)', 0, n(etapa1[1][1], 4), n(etapa1[1][2], 6)]])}
<p>La sustitución regresiva da <b>a = ${n(AJ.intercepto, 5)}</b> y <b>b = ${n(AJ.pendiente, 5)}</b>, con <b>r² = ${n(AJ.r2, 4)}</b> y error estándar ${n(AJ.errorEstandar, 5)}. La pendiente indica que el ausentismo sube <b>${n(T.pendientePuntosPorSemana, 2)} puntos porcentuales por semana</b>; como supera el umbral de ±0.25 pp/semana, el sistema clasifica la tendencia como «al alza».</p>
${fig(g1, 1, 'Tasa semanal de ausentismo y recta ajustada por mínimos cuadrados.')}

<h3>5.2 Selección del modelo y proyección</h3>
<p>Además de la recta se ajusta una parábola (grado 2). Para elegir entre ambas no basta el r², que siempre crece al agregar parámetros. SUSAN usa <b>validación cruzada leave-one-out</b>: ajusta el modelo dejando fuera una semana a la vez, predice esa semana y calcula la raíz del error cuadrático medio (RMSE LOO). La parábola solo se elige si mejora ese error en al menos 2 %.</p>
${tabla(['Modelo', 'r²', 'r² ajustado', 'AIC', 'Error estándar', 'RMSE LOO'], [
    ['Grado 1 (recta)', n(c1.r2), n(c1.r2Ajustado), n(c1.aic, 2), n(c1.errorEstandar, 5), n(c1.errorLOO, 5)],
    ['Grado 2 (parábola)', n(c2.r2), n(c2.r2Ajustado), n(c2.aic, 2), n(c2.errorEstandar, 5), n(c2.errorLOO, 5)]])}
<p>La parábola tiene un r² ligeramente mayor, pero su r² ajustado es menor, su AIC es mayor y predice peor los datos que no vio (RMSE LOO ${n(c2.errorLOO, 5)} contra ${n(c1.errorLOO, 5)}): está sobreajustando. Se elige la recta. La proyección incluye un intervalo de predicción al 95 %:</p>
<p class="eq">ŷ ± t<sub>0.025, n−p</sub> · s · √(1 + φ<sup>T</sup>(X<sup>T</sup>X)<sup>−1</sup>φ)</p>
${fig(g2, 2, `Proyección lineal de la tasa semanal hasta la semana 16 con su intervalo de predicción al 95 %. En la semana 9 se espera ${pc(pm[9].valor, 1)} % [${pc(pm[9].inferior, 1)} %, ${pc(pm[9].superior, 1)} %].`)}

<h3>5.3 Búsqueda de raíces: semana de cruce del límite</h3>
<p>Para estimar cuándo el grupo alcanzará el límite se ajusta el acumulado A(t) (en este caso el modelo elegido es cuadrático, r² = ${n(q.r2, 5)}) y se resuelve la ecuación no lineal:</p>
<p class="eq">f(t) = A(t) − 20 = 0, &nbsp;&nbsp; A(t) ≈ ${n(a0, 4)} + ${n(a1, 4)}·t + ${n(a2, 4)}·t²</p>
<p>Un barrido con paso de 0.25 semanas encuentra el primer cambio de signo de f en el intervalo [15.75, 16.0]. Sobre ese intervalo se aplica <b>bisección</b>, que siempre converge porque conserva el cambio de signo, y se contrasta con <b>Newton-Raphson</b> usando la derivada analítica del polinomio, A′(t) = ${n(a1, 4)} + ${n(2 * a2, 4)}·t:</p>
<p class="eq">t<sub>k+1</sub> = t<sub>k</sub> − f(t<sub>k</sub>) / f′(t<sub>k</sub>)</p>
${tabla(['Iteración', 't (bisección)', 'f(t)', 'Error'], [...bt.slice(0, 5), { gap: true }, ...bt.slice(-2)].map((r) => (r.gap ? ['…', '…', '…', '…'] : [r.iter, n(r.x, 9), ex(r.fx), ex(r.error, 1)])))}
${tabla(['Iteración', 't (Newton-Raphson)', 'f(t)', 'Error'], nt.map((r) => [r.iter, n(r.x, 12), ex(r.fx), ex(r.error, 1)]))}
<p>Ambos métodos llegan a la misma raíz, <b>t ≈ ${n(C.t, 6)}</b>. Bisección necesitó <b>${bt.length} iteraciones</b> (convergencia lineal: el error se divide entre 2 en cada paso), mientras que Newton-Raphson necesitó <b>${nt.length}</b> (convergencia cuadrática: el número de cifras correctas se duplica aproximadamente en cada iteración, de 10<sup>−2</sup> a 10<sup>−5</sup> y a 10<sup>−12</sup>). La semana reportada es ⌈t⌉ = <b>${C.semana}</b>: si nada cambia, el grupo promedio alcanzará el límite en la última semana del periodo.</p>
${fig(g3, 3, 'Acumulado de faltas equivalentes, ajuste cuadrático y límite de 20 %. La intersección es la raíz de f(t).')}

<h3>5.4 Interpolación: semanas sin clase</h3>
<p>Cuando una semana se suspende (día festivo, evento, paro) la serie queda con un hueco. Para el suavizado y el control de cambios, que necesitan puntos equiespaciados, SUSAN rellena el hueco con un <b>spline cúbico natural</b>: cúbicas por tramos con primera y segunda derivada continuas y S″ = 0 en los extremos, lo que lleva a un sistema tridiagonal. La regresión y la proyección usan solo las semanas observadas.</p>
<p>Para probarlo se eliminó la semana 5 del caso de estudio. El spline estimó <b>${pc(spline5)} %</b> cuando el valor real era ${pc(T.tasas[4])} %, un error de ${(Math.abs(spline5 - T.tasas[4]) * 100).toFixed(2)} puntos porcentuales. Se prefirió el spline sobre un polinomio interpolante de grado alto porque este último oscila entre los nodos (fenómeno de Runge). Los métodos de Lagrange y de diferencias divididas de Newton también están implementados y las pruebas verifican que producen el mismo polinomio.</p>
${fig(g4, 4, 'Semana 5 suspendida: el tramo dorado es el spline cúbico natural que la estima.')}

<h3>5.5 Suavizado</h3>
<p>Para ver la tendencia sin el ruido de semana a semana se calculan tres medias móviles con ventana 3: simple (SMA), ponderada (WMA, pesos 1, 2, 3) y exponencial (EMA, α = 2/(n+1) = 0.5, donde EMA<sub>t</sub> = α·r<sub>t</sub> + (1 − α)·EMA<sub>t−1</sub>).</p>
${tabla(['Semana', 'Tasa %', 'SMA(3) %', 'WMA(3) %', 'EMA %'], suav.map((f) => [f[0], pc(f[1]), f[2] == null ? '—' : pc(f[2]), f[4] == null ? '—' : pc(f[4]), pc(f[3])]))}
${fig(g5, 5, 'Tasa semanal suavizada con SMA y EMA. La EMA reacciona antes a los cambios recientes.')}

<h3>5.6 Derivación numérica</h3>
<p>La tasa de cambio por semana se obtiene con diferencias finitas de tres puntos (centrales en el interior; hacia adelante y hacia atrás en los extremos), escritas para nodos no uniformes por si falta alguna semana:</p>
${tabla(['Semana', ...dfin.map((f) => f[0])], [['pp/semana', ...dfin.map((f) => n(f[1], 2))]])}
<p>Para la derivada del ajuste en la última semana se usa la <b>extrapolación de Richardson</b>: se calcula la diferencia central con h, h/2, h/4, h/8 y cada columna elimina un orden del error de truncamiento.</p>
${tabla(['h', 'R(j=0)', 'R(j=1)', 'R(j=2)', 'R(j=3)'], rich.map((f) => [f[0], ...f.slice(1).map((v) => (v == null ? '' : n(v, 10)))]))}
<p>El resultado, ${n(sR[0].valor * 100, 6)} pp/semana, coincide con la derivada analítica de la recta (${n(sR[1].valor * 100, 6)}) hasta el error de redondeo, del orden de 10<sup>−16</sup>.</p>

<h3>5.7 Integración numérica</h3>
<p>El área bajo la curva de la tasa semanal mide el ausentismo acumulado del grupo en tasa·semanas y sirve para comparar grupos aunque sus curvas tengan formas distintas. Sobre los datos observados se usa la regla del trapecio compuesta; sobre la recta ajustada se contrasta con Simpson 1/3 y con Romberg:</p>
<p class="eq">∫<sub>1</sub><sup>8</sup> r(w) dw ≈ (h/2) [ r<sub>1</sub> + 2r<sub>2</sub> + … + 2r<sub>7</sub> + r<sub>8</sub> ]</p>
${tabla(['Método', 'Sobre', 'Valor (tasa·semanas)'], [['Trapecio compuesto', 'datos observados', n(area[0][1], 6)], ['Simpson 1/3 (n = 14)', 'recta ajustada', n(area[1][1], 6)], ['Romberg', 'recta ajustada', n(area[2][1], 6)]])}
<p>Simpson y Romberg coinciden exactamente porque integran un polinomio de grado 1, que ambos métodos integran sin error de truncamiento (Romberg converge desde la primera fila). La diferencia de ${n(Math.abs(area[0][1] - area[2][1]), 4)} con el trapecio sobre los datos es el ruido de las observaciones respecto a la recta.</p>

<h3>5.8 Control estadístico: cambio de nivel y día crítico</h3>
<p>Para saber <i>desde cuándo</i> empeoró el grupo se aplica una carta <b>CUSUM</b> tabular. Con la línea base del primer tercio de la serie (μ<sub>0</sub> = ${n(cusumP.objetivo, 4)}, σ = ${n(cusumP.sigma, 4)}) se acumulan las desviaciones con holgura k = 0.5σ y se da la alarma cuando S⁺ supera h = 4σ:</p>
<p class="eq">S⁺<sub>t</sub> = máx[ 0, S⁺<sub>t−1</sub> + r<sub>t</sub> − μ<sub>0</sub> − k ]</p>
${tabla(['Semana', ...cus.map((f) => f[0])], [['Tasa', ...cus.map((f) => n(f[1], 4))], ['S⁺', ...cus.map((f) => n(f[2], 4))]])}
<p>S⁺ supera h = ${n(cusumP.h, 4)} en la semana <b>${R.cambios.semanaDeteccion}</b>; el cambio se fecha en la semana <b>${R.cambios.semanaCambio}</b>, la primera en que S⁺ deja de valer cero y empieza a crecer. Una carta EWMA (λ = 0.3, L = 3) confirma el cambio con alarmas en las semanas ${ewP.alarmas.join(', ')}.</p>
${fig(g6, 6, 'Estadístico CUSUM superior y umbral de alarma h.')}
<p>El patrón semanal agrupa las sesiones por día. En el caso, el viernes concentra más ausencias que el resto y el sistema lo marca como <b>día crítico</b>:</p>
${fig(g7, 7, `Tasa de ausentismo por día: ${dias.map((d) => `${d.nombre.toLowerCase()} ${pc(d.tasa, 1)} %`).join(', ')}.`)}

<h3>5.9 Puntaje de riesgo por alumno</h3>
<p>Cada alumno recibe un puntaje de 0 a 100 que suma siete factores acotados. Cada factor sale de un método distinto, de modo que el docente puede ver cuál pesa más y recibe una acción sugerida.</p>
${tabla(['Factor', 'Puntos máx.', 'Cálculo'], [
    ['Distancia al límite', 25, '25 · mín(1, % faltas / límite)'],
    ['Proyección al cierre', 20, 'Extrapolación con el ritmo propio del alumno'],
    ['Pendiente reciente', 15, 'Mínimos cuadrados sobre las últimas ≤ 8 sesiones'],
    ['Faltas consecutivas', 15, '15 · mín(1, racha / 3)'],
    ['z-score frente al grupo', 10, '10 · acot(z / 2, 0, 1), z = (x − μ) / σ'],
    ['Retardos acumulados', 10, '10 · mín(1, retardos / 6)'],
    ['Concentración por día', 5, 'Participación del día con más faltas']], 'izq')}
<p>El nivel es <b>alto</b> si el puntaje es ≥ 60 o el alumno ya superó el límite, <b>medio</b> si es ≥ 35 y <b>bajo</b> en otro caso. Los pesos son heurísticos y están centralizados en un solo archivo para poder calibrarlos.</p>

<h2>6. Implementación y verificación</h2>
<p>El módulo vive en <code>web/src/lib/numerics/</code>, con una carpeta por familia (linear-algebra, regression, interpolation, smoothing, differentiation, integration, rootfinding, stats, forecast, risk y analysis). Cada carpeta incluye un README con la fórmula, supuestos y complejidad, y sus pruebas automáticas. La función <code>analizarGrupo()</code> integra todos los métodos; nunca falla por datos pobres (series cortas, huecos o grupos sin ausencias) y solo lanza error ante argumentos inválidos.</p>
<p>Las pruebas comparan cada método contra problemas con respuesta conocida y después prueban el análisis completo con series creciente, plana y casos degenerados. La ejecución actual reporta <b>110 pruebas aprobadas en 11 archivos</b> (Vitest).</p>
${tabla(['Prueba', 'Resultado esperado'], [
    ['Newton-Raphson sobre x² − 2', '√2 = 1.41421356…'],
    ['Bisección sobre cos(x) − x', '0.73908513…'],
    ['Simpson 1/3 de sen(x) en [0, π]', '2'],
    ['Spline cúbico natural', 'reproduce los nudos'],
    ['Lagrange contra diferencias divididas de Newton', 'mismo polinomio'],
    ['Sistema 3×3 con Gauss y con LU', 'misma solución'],
    ['Matriz de Hilbert', 'número de condición alto'],
    ['CUSUM sobre un salto sintético', 'detecta la semana del salto']], 'izq')}

<h2>7. Resultados</h2>
<p>Para el grupo del caso de estudio, el análisis numérico produce cuatro alertas que el docente ve en la pantalla «Analítica»:</p>
<ol>
<li><b>Tendencia al alza:</b> +${n(T.pendientePuntosPorSemana, 2)} pp por semana (r² = ${n(AJ.r2, 3)}).</li>
<li><b>Cruce proyectado:</b> el acumulado alcanzaría el 20 % en la semana ${C.semana} (t ≈ ${n(C.t, 2)}).</li>
<li><b>Cambio de nivel:</b> al alza desde la semana ${R.cambios.semanaCambio}, detectado en la ${R.cambios.semanaDeteccion}.</li>
<li><b>Día crítico:</b> ${R.patronSemanal.nombreDiaCritico.toLowerCase()}, con ${pc(dias[2].tasa, 1)} % de ausentismo frente a ${pc(dias[0].tasa, 1)} % del lunes.</li>
</ol>
<div class="nota"><p>El cruce en la semana 16 es una proyección del grupo promedio, no de cada alumno. Por eso el sistema también evalúa a cada alumno con su propio ritmo en el puntaje de riesgo: un alumno con más faltas que el promedio puede cruzar el límite semanas antes.</p></div>

<h2>8. Conclusiones generales</h2>
<p>Los métodos numéricos del curso tienen un uso real dentro del sistema: cada familia responde una pregunta concreta del docente. La regresión dice hacia dónde va el grupo, la búsqueda de raíces cuándo se cruza el límite, CUSUM desde cuándo empeoró y el puntaje de riesgo quién necesita atención primero.</p>
<p>Elegir el método importa tanto como aplicarlo. Newton-Raphson converge en 3 iteraciones contra 25 de bisección, pero bisección garantiza la convergencia; por eso se usan juntos. Un r² más alto no hizo mejor a la parábola: la validación cruzada eligió la recta. Los datos reales son imperfectos, y por ello hubo que interpolar semanas suspendidas, exigir un mínimo de 4 semanas y reportar intervalos en lugar de un solo número.</p>
<p>Por último, explicar es parte del resultado. Cada cálculo devuelve sus pasos y trazas para que el docente pueda confiar en la alerta y actuar a tiempo, que es el objetivo del proyecto.</p>

<h2>9. Conclusiones por integrante</h2>
${NAMES.map((nm, i) => `<div class="integrante"><p><b>${nm}.</b> ${CONC[i]}</p></div>`).join('')}

<h2>10. Referencias</h2>
<div class="ref">
<p>Burden, R. L., Faires, J. D. y Burden, A. M. (2017). <i>Análisis numérico</i> (10.ª ed.). Cengage Learning.</p>
<p>Chapra, S. C. y Canale, R. P. (2015). <i>Métodos numéricos para ingenieros</i> (7.ª ed.). McGraw-Hill.</p>
<p>Hastie, T., Tibshirani, R. y Friedman, J. (2009). <i>The Elements of Statistical Learning</i> (2nd ed.). Springer.</p>
<p>Montgomery, D. C. (2013). <i>Introduction to Statistical Quality Control</i> (7th ed.). Wiley.</p>
<p>Equipo SUSAN (2026). <i>Módulo de métodos numéricos</i> (web/src/lib/numerics) y <i>1er avance del proyecto integrador</i>. Universidad Autónoma de Chiapas.</p>
</div>
</body></html>`;
fs.writeFileSync(OUT, html);
console.log('ok', OUT, { a0, a1, a2, r2: q.r2 });
