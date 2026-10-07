import { compararFechas, diasEntre, esFechaISO, formatearFechaCorta, sumarDias } from '@/lib/formularios/fechas.js';
import { dentroDelIntervalo } from '../CampoFecha/campoFecha.utils.js';

/** Atajo de rango: los últimos `n` días contando hoy («Últimos 7 días»). */
export const rangoUltimosDias = (n, label = `Últimos ${n} días`) => ({
    label,
    valor: ({ hoy }) => ({ desde: sumarDias(hoy, -(n - 1)), hasta: hoy }),
});

/** Atajo de rango: hoy y los `n - 1` días siguientes. */
export const rangoProximosDias = (n, label = `Próximos ${n} días`) => ({
    label,
    valor: ({ hoy }) => ({ desde: hoy, hasta: sumarDias(hoy, n - 1) }),
});

export const ATAJOS_RANGO = [rangoUltimosDias(7), rangoUltimosDias(30)];

/** Días del rango contando ambos extremos (1 oct a 1 oct = 1 día); null si falta alguno o están invertidos. */
export function diasDelRango(desde, hasta) {
    if (!esFechaISO(desde) || !esFechaISO(hasta) || compararFechas(desde, hasta) > 0) return null;
    return diasEntre(desde, hasta) + 1;
}

/** «1 oct 2026 al 30 oct 2026 · 30 días» (cadena vacía si el rango no es válido). */
export function resumenDelRango(desde, hasta) {
    const dias = diasDelRango(desde, hasta);
    if (dias === null) return '';
    return `${formatearFechaCorta(desde)} al ${formatearFechaCorta(hasta)} · ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/**
 * Validación cruzada del par: devuelve { desde?, hasta?, rango? } con el mensaje de cada problema (objeto vacío = válido).
 *   desde > hasta                -> rango
 *   fuera de [min, max]          -> desde / hasta
 *   más de `maxDias` de largo    -> rango
 *   falta alguno y `requerido`   -> desde / hasta
 */
export function validarRango({ desde, hasta }, { min, max, maxDias, requerido = false } = {}) {
    const e = {};
    if (!desde && requerido) e.desde = 'Elige la fecha inicial.';
    if (!hasta && requerido) e.hasta = 'Elige la fecha final.';
    if (desde && !dentroDelIntervalo(desde, { min })) e.desde = `La fecha inicial no puede ser anterior al ${formatearFechaCorta(min)}.`;
    if (hasta && !dentroDelIntervalo(hasta, { max })) e.hasta = `La fecha final no puede ser posterior al ${formatearFechaCorta(max)}.`;
    if (esFechaISO(desde) && esFechaISO(hasta)) {
        if (compararFechas(desde, hasta) > 0) e.rango = 'La fecha inicial debe ser anterior o igual a la final.';
        else if (maxDias != null && diasDelRango(desde, hasta) > maxDias) e.rango = `El rango no puede pasar de ${maxDias} días.`;
    }
    return e;
}

/** Atajos de rango visibles: resueltos con el contexto y sin los que caen fuera de [min, max] o salen invertidos. */
export function resolverAtajosRango(atajos, { hoy, actual, min, max }) {
    return (atajos ?? [])
        .map((a) => ({ label: a.label, rango: typeof a.valor === 'function' ? a.valor({ actual, hoy }) : a.valor }))
        .filter(
            (a) =>
                a.rango &&
                diasDelRango(a.rango.desde, a.rango.hasta) !== null &&
                dentroDelIntervalo(a.rango.desde, { min, max }) &&
                dentroDelIntervalo(a.rango.hasta, { min, max }),
        );
}
