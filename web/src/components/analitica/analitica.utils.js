// Utilidades puras de la pantalla /analitica: formateo, orden y armado de series para las gráficas.
// Las tasas de analizarGrupo vienen en fracción (tendencia/suavizado/proyección) o en % (resumen, cruce).

export const SIN_DATO = '-';

/** Número con `d` decimales, o guion si no es finito. */
export function fmtNum(n, d = 1) {
    return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : SIN_DATO;
}

/** Porcentaje (ya en %) con símbolo. */
export function fmtPct(n, d = 1) {
    return typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(d)} %` : SIN_DATO;
}

/** Número con signo explícito (+0.8 / -0.8). */
export function fmtSigno(n, d = 1) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return SIN_DATO;
    const t = n.toFixed(d);
    return n > 0 && Number(t) !== 0 ? `+${t}` : t;
}

export const ETIQUETA_DIRECCION = { alza: 'Al alza', baja: 'A la baja', estable: 'Estable' };

export const ETIQUETA_NIVEL_ALERTA = { alta: 'Alta', media: 'Media', info: 'Info' };

export const ETIQUETA_NIVEL_RIESGO = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };

const MENSAJE_INSUFICIENTE = 'Datos insuficientes: se requieren al menos 4 semanas con sesiones cerradas.';
export { MENSAJE_INSUFICIENTE };

const VALOR_CRUCE = {
    cruza: (c) => `Semana ${c.semana}`,
    superado: () => 'Ya superado',
    no_cruza: () => 'No cruza',
    insuficiente: () => SIN_DATO,
};

/** Datos para la franja de indicadores (textos ya formateados y cortos). */
export function datosTarjetas({ resumen, proyeccion, cruceLimite, limitePct = 20 }) {
    const suficiente = Boolean(resumen?.suficiente);
    const ultimo = proyeccion?.disponible && proyeccion.puntos?.length ? proyeccion.puntos[proyeccion.puntos.length - 1] : null;
    const evaluados = resumen?.alumnosEvaluados ?? 0;
    const enRiesgo = resumen?.alumnosEnRiesgo ?? 0;
    const superan = resumen?.alumnosSuperanLimite ?? 0;
    return {
        actual: {
            valor: fmtPct(resumen?.tasaActual),
            nota: resumen?.variacionPP == null ? 'Sin semana previa' : `${fmtSigno(resumen.variacionPP)} pp vs. semana previa`,
            tono: resumen?.tasaActual != null && resumen.tasaActual > limitePct ? 'danger' : 'neutral',
        },
        proyeccion: {
            valor: ultimo ? fmtPct(ultimo.valor * 100) : SIN_DATO,
            nota: ultimo ? `Semana ${ultimo.semana} (${fmtPct(ultimo.inferior * 100, 0)} a ${fmtPct(ultimo.superior * 100, 0)})` : suficiente ? 'Sin proyección' : 'Faltan semanas',
            tono: 'neutral',
        },
        cruce: {
            // Valor corto (cabe en la cifra grande); el mensaje completo vive en la gráfica de acumulado.
            valor: VALOR_CRUCE[cruceLimite?.estado] ? VALOR_CRUCE[cruceLimite.estado](cruceLimite) : SIN_DATO,
            nota: cruceLimite?.estado === 'insuficiente' || !cruceLimite ? 'Faltan semanas' : (cruceLimite.estado === 'cruza' ? `Estimada, límite de ${limitePct} %` : `Límite de ${limitePct} %`),
            tono: cruceLimite?.estado === 'superado' ? 'danger' : cruceLimite?.estado === 'cruza' ? 'warning' : 'neutral',
        },
        riesgo: {
            valor: evaluados > 0 ? String(enRiesgo) : SIN_DATO,
            nota: evaluados > 0 ? (superan > 0 ? `de ${evaluados}; ${superan} sobre el límite` : `de ${evaluados} alumnos`) : 'Sin matriz de asistencia',
            tono: superan > 0 ? 'danger' : enRiesgo > 0 ? 'warning' : 'neutral',
        },
    };
}

/** Mezcla por semana las series de la gráfica semanal (valores en %). */
export function construirSerieSemanal({ tendencia, suavizado, proyeccion }) {
    const filas = new Map();
    const fila = (s) => {
        if (!filas.has(s)) filas.set(s, { semana: s });
        return filas.get(s);
    };
    const pct = (v) => (typeof v === 'number' && Number.isFinite(v) ? Number((v * 100).toFixed(3)) : null);
    (tendencia?.semanas || []).forEach((s, i) => {
        fila(s).observada = pct(tendencia.tasas?.[i]);
    });
    (tendencia?.puntosAjustados || []).forEach((p) => {
        fila(p.semana).ajuste = pct(p.valor);
    });
    (suavizado?.semanas || []).forEach((s, i) => {
        const f = fila(s);
        f.sma = pct(suavizado.sma?.[i]);
        f.ema = pct(suavizado.ema?.[i]);
        f.wma = pct(suavizado.wma?.[i]);
    });
    (proyeccion?.puntos || []).forEach((p) => {
        const f = fila(p.semana);
        f.proyeccion = pct(p.valor);
        f.banda = [pct(p.inferior), pct(p.superior)];
    });
    return [...filas.values()].sort((a, b) => a.semana - b.semana);
}

/** Series de la gráfica de acumulado (valores en %). */
export function construirSerieAcumulado(cruceLimite) {
    const filas = new Map();
    const fila = (s) => {
        if (!filas.has(s)) filas.set(s, { semana: s });
        return filas.get(s);
    };
    const r = (v) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(3)) : null);
    const ac = cruceLimite?.acumulado;
    (ac?.semanas || []).forEach((s, i) => {
        fila(s).acumulado = r(ac.valores?.[i]);
    });
    (cruceLimite?.ajuste || []).forEach((p) => {
        fila(p.semana).ajuste = r(p.valor);
    });
    (cruceLimite?.proyeccion || []).forEach((p) => {
        const f = fila(p.semana);
        f.proyeccion = r(p.valor);
        f.banda = [r(p.inferior), r(p.superior)];
    });
    return [...filas.values()].sort((a, b) => a.semana - b.semana);
}

/** Primer y último valor no nulos de una lista paralela a `semanas` (para "va de X a Y"). */
function extremos(semanas = [], valores = []) {
    const idx = valores.map((v, i) => (typeof v === 'number' && Number.isFinite(v) ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 0) return null;
    const i0 = idx[0];
    const i1 = idx[idx.length - 1];
    return { desde: { semana: semanas[i0], valor: valores[i0] }, hasta: { semana: semanas[i1], valor: valores[i1] } };
}

/**
 * Descripción corta bajo el título de la gráfica semanal: dirección y pendiente de la tendencia (antes era una tarjeta).
 * Sin tendencia disponible no hay descripción (la gráfica muestra su aviso de datos insuficientes).
 */
export function descripcionTendencia(tendencia) {
    if (!tendencia?.disponible) return undefined;
    const dir = ETIQUETA_DIRECCION[tendencia.direccion];
    const p = tendencia.pendientePuntosPorSemana;
    const pendiente = Number.isFinite(p) ? `: ${fmtSigno(p, 2)} pp por semana` : '';
    return `${dir ? `Tendencia ${dir.toLowerCase()}` : 'Tendencia'}${pendiente}. Proyección con intervalo de 95\u00a0%.`;
}

/** Texto alternativo de la gráfica semanal: de X % a Y %, tendencia, proyección y cruce del límite. */
export function resumenTextoSerie({ tendencia, resumen, proyeccion, cruceLimite, limitePct = 20 }) {
    if (!tendencia?.disponible) return 'Ausentismo semanal: datos insuficientes para estimar la tendencia.';
    const dir = (ETIQUETA_DIRECCION[tendencia.direccion] || '').toLowerCase();
    const e = extremos(tendencia.semanas, tendencia.tasas);
    const partes = [];
    if (e) partes.push(`el ausentismo va de ${fmtPct(e.desde.valor * 100)} en la semana ${e.desde.semana} a ${fmtPct(e.hasta.valor * 100)} en la semana ${e.hasta.semana}`);
    partes.push(`tendencia ${dir} de ${fmtSigno(tendencia.pendientePuntosPorSemana, 2)} puntos por semana`);
    if (resumen?.tasaActual != null) partes.push(`tasa actual ${fmtPct(resumen.tasaActual)}`);
    const ult = proyeccion?.disponible && proyeccion.puntos?.length ? proyeccion.puntos[proyeccion.puntos.length - 1] : null;
    if (ult) partes.push(`proyección de ${fmtPct(ult.valor * 100)} en la semana ${ult.semana}`);
    if (cruceLimite?.estado === 'cruza') partes.push(`la proyección cruza el límite de ${limitePct} % en la semana ${cruceLimite.semana}`);
    else if (cruceLimite?.estado === 'superado') partes.push(`el límite de ${limitePct} % ya fue superado`);
    return `Ausentismo semanal: ${partes.join('; ')}.`;
}

/** Texto alternativo de la gráfica de acumulado frente al límite. */
export function resumenTextoAcumulado(cruceLimite, limitePct = 20) {
    if (!cruceLimite || cruceLimite.estado === 'insuficiente') return 'Faltas acumuladas: datos insuficientes.';
    const e = extremos(cruceLimite.acumulado?.semanas, cruceLimite.acumulado?.valores);
    const rango = e ? `El promedio de faltas por alumno va de ${fmtPct(e.desde.valor)} en la semana ${e.desde.semana} a ${fmtPct(e.hasta.valor)} en la semana ${e.hasta.semana}. ` : '';
    return `Faltas acumuladas frente al límite de ${limitePct} %. ${rango}Cruce del límite: ${cruceLimite.mensaje}.`;
}

/** Filas del patrón por día (tasa en %). */
export function datosPatron(patronSemanal) {
    return (patronSemanal?.dias || []).map((d) => ({
        dia: d.nombre,
        tasa: d.tasa == null ? null : Number((d.tasa * 100).toFixed(2)),
        sesiones: d.sesiones,
        ausentes: d.ausentes,
        critico: Boolean(d.critico),
    }));
}

/**
 * Filas del patrón para barras apiladas: el día crítico va en su propia serie (otro color y otra etiqueta en la leyenda),
 * así la señal nunca depende solo del color. `tasa` en %; los días sin sesiones quedan nulos.
 */
export function datosPatronBarras(patronSemanal) {
    return datosPatron(patronSemanal).map((d) => ({ dia: d.dia, normal: d.critico ? null : d.tasa, critico: d.critico ? d.tasa : null }));
}

export const CONFIG_PATRON = {
    normal: { label: 'Ausentismo', color: 'var(--chart-1)' },
    critico: { label: 'Día crítico', color: 'var(--ausente)' },
};

/** Texto alternativo del patrón semanal con las cifras de cada día. */
export function resumenTextoPatron(patronSemanal) {
    const dias = datosPatron(patronSemanal);
    if (dias.length === 0) return 'Patrón por día de la semana: sin sesiones cerradas.';
    const lista = dias.map((d) => `${d.dia} ${d.tasa == null ? 'sin datos' : fmtPct(d.tasa)} (${d.ausentes} de ${d.sesiones} sesiones${d.critico ? ', día crítico' : ''})`).join('; ');
    return `Ausentismo por día de la semana: ${lista}.`;
}

// ---- Configuración de colores de las gráficas (solo tokens de globals.css) ----
// `forma` = muestra de la leyenda y el tooltip (ver MuestraSerie): ajuste, proyección e intervalo comparten el azul de
// la gráfica, así que la forma (línea, discontinua, banda) es lo que las distingue, no solo el color.
export const CONFIG_SERIE = {
    observada: { label: 'Observada', color: 'var(--foreground)', forma: 'punto' },
    ajuste: { label: 'Ajuste', color: 'var(--chart-1)', forma: 'linea' },
    proyeccion: { label: 'Proyección', color: 'var(--chart-1)', forma: 'discontinua' },
    banda: { label: 'Intervalo 95 %', color: 'var(--chart-1)', forma: 'banda' },
    sma: { label: 'SMA', color: 'var(--chart-3)', forma: 'linea' },
    ema: { label: 'EMA', color: 'var(--chart-2)', forma: 'linea' },
    wma: { label: 'WMA', color: 'var(--chart-5)', forma: 'linea' },
};

export const CONFIG_ACUMULADO = {
    acumulado: { label: 'Acumulado', color: 'var(--foreground)', forma: 'punto' },
    ajuste: CONFIG_SERIE.ajuste,
    proyeccion: CONFIG_SERIE.proyeccion,
    banda: CONFIG_SERIE.banda,
};

// ---- Riesgo: distribución y ranking ----
export const CONFIG_RIESGO = {
    bajo: { label: 'Bajo', color: 'var(--presente)' },
    medio: { label: 'Medio', color: 'var(--retardo)' },
    alto: { label: 'Alto', color: 'var(--ausente)' },
};

/**
 * Distribución por nivel de riesgo. `items` trae solo medio/alto (analizarGrupo); los de nivel bajo son los evaluados que
 * faltan. Sin `evaluados` (p. ej. sin matriz) solo se cuentan los de la lista.
 * @returns {{ datos: {clave: string, valor: number}[], enRiesgo: number, total: number }}
 */
export function distribucionRiesgo(items = [], evaluados = null) {
    const alto = items.filter((a) => a.nivel === 'alto').length;
    const medio = items.filter((a) => a.nivel === 'medio').length;
    const enRiesgo = alto + medio;
    const total = Number.isFinite(evaluados) && evaluados >= enRiesgo ? evaluados : enRiesgo;
    return {
        datos: [
            { clave: 'bajo', valor: total - enRiesgo },
            { clave: 'medio', valor: medio },
            { clave: 'alto', valor: alto },
        ],
        enRiesgo,
        total,
    };
}

/**
 * Nombre acotado para el eje de las barras (los completos viven en la tabla): si no cabe, la primera palabra entera y las
 * demás como iniciales ("González C. M."); si aun así no cabe, se corta con puntos suspensivos.
 */
export function nombreCorto(nombre, max = 16) {
    const t = String(nombre ?? '').trim().replace(/\s+/g, ' ');
    if (!t) return SIN_DATO;
    if (t.length <= max) return t;
    const [primera, ...resto] = t.split(' ');
    const iniciales = resto.map((p) => `${p[0].toUpperCase()}.`).join(' ');
    const corto = iniciales ? `${primera} ${iniciales}` : primera;
    return corto.length > max ? `${corto.slice(0, max - 1).trimEnd()}…` : corto;
}

export const TOP_RIESGO = 8;

// Ancho máximo (en caracteres) de la etiqueta del eje: el eje Y de GraficaBarras mide 110 px.
const MAX_ETIQUETA = 16;

/**
 * Los `n` alumnos de mayor puntaje para barras horizontales apiladas por nivel (cada nivel su serie y su color).
 * Las etiquetas del eje son únicas y nunca pasan de MAX_ETIQUETA caracteres: si dos nombres cortos chocan se recortan y
 * llevan los últimos 4 de la matrícula ("González C. #3456"); como último recurso, un número de orden.
 */
export function topRiesgo(items = [], n = TOP_RIESGO) {
    const orden = ordenarRiesgo(items, 'puntaje', 'desc').slice(0, n);
    const bases = orden.map((a) => nombreCorto(a.nombre, MAX_ETIQUETA));
    const cuenta = new Map();
    bases.forEach((b) => cuenta.set(b, (cuenta.get(b) || 0) + 1));
    const usadas = new Set();
    return orden.map((a, i) => {
        let alumno = bases[i];
        if (cuenta.get(alumno) > 1) {
            const sufijo = ` #${String(a.matricula ?? a.idAlumno ?? '?').slice(-4)}`;
            alumno = `${nombreCorto(a.nombre, MAX_ETIQUETA - sufijo.length)}${sufijo}`;
        }
        const etiqueta = alumno;
        for (let k = 2; usadas.has(alumno); k += 1) {
            const numero = ` (${k})`;
            alumno = `${etiqueta.slice(0, MAX_ETIQUETA - numero.length).trimEnd()}${numero}`;
        }
        usadas.add(alumno);
        const puntaje = typeof a.puntaje === 'number' && Number.isFinite(a.puntaje) ? a.puntaje : 0;
        return { alumno, alto: a.nivel === 'alto' ? puntaje : null, medio: a.nivel === 'alto' ? null : puntaje };
    });
}

/** Tendencia reciente de faltas de un alumno a partir de su factor `pendienteReciente` (pp por sesión; ±0.5 = estable). */
export function tendenciaAlumno(alumno) {
    const f = (alumno?.factores || []).find((x) => x.id === 'pendienteReciente');
    const v = f?.valor;
    if (typeof v !== 'number' || !Number.isFinite(v)) return { direccion: null, etiqueta: SIN_DATO, valor: null };
    const direccion = v > 0.5 ? 'alza' : v < -0.5 ? 'baja' : 'estable';
    return { direccion, etiqueta: ETIQUETA_DIRECCION[direccion], valor: v };
}

/** Texto alternativo del ranking de riesgo: nombres completos con puntaje y nivel. */
export function resumenTextoTop(items = [], n = TOP_RIESGO) {
    const orden = ordenarRiesgo(items, 'puntaje', 'desc').slice(0, n);
    if (orden.length === 0) return 'Ningún alumno en riesgo con los datos actuales.';
    const lista = orden.map((a) => `${a.nombre || SIN_DATO} ${fmtNum(a.puntaje, 0)} de 100 (${(ETIQUETA_NIVEL_RIESGO[a.nivel] || a.nivel || '').toLowerCase()})`).join('; ');
    return `Alumnos de mayor riesgo, de ${orden.length} de ${items.length}: ${lista}.`;
}

/** Divide las alertas (de más a menos grave): las `visibles` primeras a la vista, el resto plegado. */
export function partirAlertas(alertas = [], visibles = 3) {
    const orden = { alta: 0, media: 1, info: 2 };
    const lista = [...alertas].sort((a, b) => (orden[a.nivel] ?? 3) - (orden[b.nivel] ?? 3));
    return { principales: lista.slice(0, visibles), resto: lista.slice(visibles) };
}

/** Primera frase de un texto largo y, aparte, el resto (para mostrar lo esencial primero sin perder nada). */
export function dividirTexto(texto, max = 140) {
    const t = String(texto ?? '').trim();
    if (t.length <= max) return { corto: t, resto: '' };
    const m = /^(.+?[.!?])\s+(.*)$/s.exec(t);
    if (m && m[1].length <= max * 1.5) return { corto: m[1], resto: m[2] };
    return { corto: t, resto: '' };
}

const ORDEN_NIVEL = { alto: 2, medio: 1, bajo: 0 };

const VALOR_ORDEN = {
    puntaje: (a) => a.puntaje,
    nombre: (a) => (a.nombre || '').toLowerCase(),
    nivel: (a) => ORDEN_NIVEL[a.nivel] ?? -1,
    faltasEq: (a) => a.faltasEq,
    faltasRestantes: (a) => a.faltasRestantes,
    cruce: (a) => a.semanaCruceEstimada,
    tendencia: (a) => tendenciaAlumno(a).valor,
};

/** Ordena sin mutar; los valores nulos van siempre al final. */
export function ordenarRiesgo(items, clave = 'puntaje', dir = 'desc') {
    const val = VALOR_ORDEN[clave] || VALOR_ORDEN.puntaje;
    const signo = dir === 'asc' ? 1 : -1;
    return [...(items || [])].sort((a, b) => {
        const va = val(a);
        const vb = val(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (va < vb) return -1 * signo;
        if (va > vb) return 1 * signo;
        return 0;
    });
}

/** Secciones del panel de procedimiento: solo las que traen pasos o traza. */
export function seccionesProcedimiento(procedimientos) {
    return (procedimientos || []).filter((p) => (p.pasos && p.pasos.length) || (p.traza && p.traza.length));
}

/** Columnas de una traza iterativa (claves del primer elemento) con encabezado legible. */
const ENCABEZADOS_TRAZA = { iter: 'Iteración', x: 'x', fx: 'f(x)', error: 'Error', a: 'a', b: 'b', c: 'c', fa: 'f(a)', fb: 'f(b)', fc: 'f(c)', dfx: "f'(x)" };
export function columnasTraza(traza) {
    if (!traza?.length) return [];
    return Object.keys(traza[0]).map((k) => ({ key: k, header: ENCABEZADOS_TRAZA[k] || k }));
}

/** Formatea una celda numérica con hasta 6 cifras significativas. */
export function fmtCelda(v) {
    if (v === null || v === undefined) return SIN_DATO;
    if (typeof v === 'number') {
        if (!Number.isFinite(v)) return String(v);
        if (Number.isInteger(v)) return String(v);
        return String(Number(v.toPrecision(6)));
    }
    return String(v);
}

// ---- CSV del resumen de análisis (UTF-8 con BOM, CRLF, anti inyección de fórmulas) ----
export function escaparCeldaCsv(valor) {
    if (valor === null || valor === undefined) return '';
    let t = typeof valor === 'number' ? (Number.isFinite(valor) ? String(valor) : '') : String(valor);
    if (typeof valor !== 'number' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** CSV con tres bloques: resumen, alertas y alumnos en riesgo. */
export function construirCsvAnalisis(analisis, { grupo = '', periodo = '' } = {}) {
    const L = (celdas) => celdas.map(escaparCeldaCsv).join(',');
    const r = analisis.resumen;
    const lineas = [
        L(['Analisis de ausentismo']),
        L(['Periodo', periodo]),
        L(['Grupo', grupo]),
        L(['Indicador', 'Valor']),
        L(['Tasa de ausentismo actual (%)', r.tasaActual == null ? null : Number(r.tasaActual.toFixed(2))]),
        L(['Variacion semanal (pp)', r.variacionPP == null ? null : Number(r.variacionPP.toFixed(2))]),
        L(['Pendiente de tendencia (pp/semana)', analisis.tendencia.pendientePuntosPorSemana == null ? null : Number(analisis.tendencia.pendientePuntosPorSemana.toFixed(3))]),
        L(['Direccion', ETIQUETA_DIRECCION[analisis.tendencia.direccion] || null]),
        L(['Cruce del limite', analisis.cruceLimite.mensaje]),
        L(['Limite (%)', r.limitePct]),
        L(['Sesiones cerradas', r.sesionesCerradas]),
        L(['Sesiones programadas', r.sesionesProgramadas]),
        L(['Alumnos evaluados', r.alumnosEvaluados]),
        L(['Alumnos en riesgo', r.alumnosEnRiesgo]),
        L(['Alumnos que superan el limite', r.alumnosSuperanLimite]),
        '',
        L(['Alertas']),
        L(['Codigo', 'Nivel', 'Mensaje']),
        ...analisis.alertas.map((a) => L([a.codigo, a.nivel, a.mensaje])),
        '',
        L(['Alumnos en riesgo']),
        L(['Matricula', 'Nombre', 'Puntaje', 'Nivel', 'Faltas equivalentes', 'Faltas restantes', 'Semana estimada de cruce', 'Accion sugerida']),
        ...analisis.alumnosEnRiesgo.map((a) => L([a.matricula, a.nombre, a.puntaje, a.nivel, a.faltasEq, a.faltasRestantes, a.semanaCruceEstimada, a.accion])),
    ];
    return `﻿${lineas.join('\r\n')}\r\n`;
}
