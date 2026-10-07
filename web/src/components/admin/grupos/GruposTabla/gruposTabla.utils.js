import { periodosCercanos } from '../GrupoForm/grupoForm.utils.js';

/**
 * Opciones del selector de periodo: los cercanos a hoy (siguiente, vigente y tres anteriores), el que esté filtrado y los que traiga la
 * página actual (por si hay grupos de un periodo fuera de ese rango). Más recientes primero.
 */
export function opcionesPeriodo({ hoy, actual, items = [] }) {
    const todos = new Set([...periodosCercanos(hoy), ...(actual ? [actual] : []), ...items.map((g) => g.periodo).filter(Boolean)]);
    return [...todos].sort((a, b) => b.localeCompare(a));
}
