// Texto corto de una fila de alumno (funciones puras). Sirve para la línea bajo el nombre cuando las columnas del desglose
// no caben: así ninguna cifra queda visible solo a 1280 px o más.

const NBSP = '\u00a0';

/**
 * Desglose compacto de la asistencia: "5 pres., 0 ret., 1 aus." Justificadas y pendientes se añaden solo si no son cero
 * (casi siempre lo son y alargarían la línea para nada). Entre la cifra y su etiqueta va un espacio de no separación para
 * que, al envolver la línea en pantallas angostas, no quede un número huérfano al final de un renglón.
 */
export function desgloseCorto(a) {
    const n = (v) => Number(v) || 0;
    const partes = [`${n(a?.presentes)}${NBSP}pres.`, `${n(a?.retardos)}${NBSP}ret.`, `${n(a?.ausencias)}${NBSP}aus.`];
    if (n(a?.justificadas) > 0) partes.push(`${n(a.justificadas)}${NBSP}just.`);
    if (n(a?.pendientes) > 0) partes.push(`${n(a.pendientes)}${NBSP}pend.`);
    return partes.join(', ');
}

/** Faltas que le quedan antes del límite, o null si el reporte no las trae (grupo sin sesiones). */
export function faltasRestantes(a) {
    const v = a?.faltas_restantes_antes_limite;
    return v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);
}
