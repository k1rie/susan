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

/** Datos para las cuatro tarjetas. Devuelve textos ya formateados. */
export function datosTarjetas({ resumen, tendencia, proyeccion, cruceLimite, limitePct = 20 }) {
    const suficiente = Boolean(resumen?.suficiente);
    const ultimo = proyeccion?.disponible && proyeccion.puntos?.length ? proyeccion.puntos[proyeccion.puntos.length - 1] : null;
    return {
        actual: {
            valor: fmtPct(resumen?.tasaActual),
            nota: resumen?.variacionPP == null ? 'Sin semana previa para comparar' : `${fmtSigno(resumen.variacionPP)} pp frente a la semana previa`,
            tono: resumen?.tasaActual != null && resumen.tasaActual > limitePct ? 'danger' : 'neutral',
        },
        tendencia: {
            valor: tendencia?.disponible ? `${fmtSigno(tendencia.pendientePuntosPorSemana, 2)} pp/sem` : SIN_DATO,
            nota: tendencia?.disponible ? ETIQUETA_DIRECCION[tendencia.direccion] || SIN_DATO : suficiente ? SIN_DATO : MENSAJE_INSUFICIENTE,
            tono: tendencia?.direccion === 'alza' ? 'warning' : 'neutral',
        },
        proyeccion: {
            valor: ultimo ? fmtPct(ultimo.valor * 100) : SIN_DATO,
            nota: ultimo
                ? `Semana ${ultimo.semana}: entre ${fmtPct(ultimo.inferior * 100)} y ${fmtPct(ultimo.superior * 100)}`
                : proyeccion?.mensaje || MENSAJE_INSUFICIENTE,
            tono: 'neutral',
        },
        cruce: {
            valor: cruceLimite?.mensaje || SIN_DATO,
            nota: cruceLimite?.estado === 'cruza' ? `Límite de ${limitePct} % de faltas equivalentes` : cruceLimite?.estado === 'insuficiente' ? MENSAJE_INSUFICIENTE : `Límite de ${limitePct} %`,
            tono: cruceLimite?.estado === 'superado' ? 'danger' : cruceLimite?.estado === 'cruza' ? 'warning' : 'neutral',
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

/** Texto de resumen para aria-label de las gráficas. */
export function resumenTextoSerie({ tendencia, resumen }) {
    if (!tendencia?.disponible) return 'Ausentismo semanal: datos insuficientes para estimar la tendencia.';
    const dir = (ETIQUETA_DIRECCION[tendencia.direccion] || '').toLowerCase();
    return `Ausentismo semanal, tendencia ${dir} de ${fmtSigno(tendencia.pendientePuntosPorSemana, 2)} puntos por semana; tasa actual ${fmtPct(resumen?.tasaActual)}.`;
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

const ORDEN_NIVEL = { alto: 2, medio: 1, bajo: 0 };

const VALOR_ORDEN = {
    puntaje: (a) => a.puntaje,
    nombre: (a) => (a.nombre || '').toLowerCase(),
    nivel: (a) => ORDEN_NIVEL[a.nivel] ?? -1,
    faltasEq: (a) => a.faltasEq,
    faltasRestantes: (a) => a.faltasRestantes,
    cruce: (a) => a.semanaCruceEstimada,
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
