import { compararFechas, esFechaISO, formatearFechaCorta } from '@/lib/formularios/fechas.js';

/** Atajo listo para usar: la fecha de hoy (la del navegador o la que pase la pantalla en `hoy`). */
export const ATAJO_HOY = { label: 'Hoy', valor: ({ hoy }) => hoy };

/** true si la fecha cabe en [min, max]; un extremo vacío o inválido no acota. */
export function dentroDelIntervalo(fecha, { min, max } = {}) {
    if (esFechaISO(min) && compararFechas(fecha, min) < 0) return false;
    if (esFechaISO(max) && compararFechas(fecha, max) > 0) return false;
    return true;
}

/**
 * Calcula los atajos a mostrar. Cada atajo es { label, valor } y `valor` es una fecha AAAA-MM-DD o una función
 * ({ actual, hoy }) => fecha (para cosas como «+1 año» respecto a OTRO campo, la función cierra sobre ese valor).
 * Se OCULTAN los atajos que dan una fecha inválida o fuera de [min, max]: un botón que no se puede aplicar solo confunde.
 */
export function resolverAtajos(atajos, { actual, hoy, min, max }) {
    return (atajos ?? [])
        .map((a) => ({ label: a.label, fecha: typeof a.valor === 'function' ? a.valor({ actual, hoy }) : a.valor }))
        .filter((a) => esFechaISO(a.fecha) && dentroDelIntervalo(a.fecha, { min, max }));
}

/** Mensaje de validación de una fecha suelta (para `Field error`), o null si es válida. */
export function validarFecha(valor, { min, max, requerida = false } = {}) {
    if (!valor) return requerida ? 'Elige una fecha.' : null;
    if (!esFechaISO(valor)) return 'Escribe una fecha válida.';
    if (esFechaISO(min) && compararFechas(valor, min) < 0) return `La fecha no puede ser anterior al ${formatearFechaCorta(min)}.`;
    if (esFechaISO(max) && compararFechas(valor, max) > 0) return `La fecha no puede ser posterior al ${formatearFechaCorta(max)}.`;
    return null;
}
