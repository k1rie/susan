// Utilidades puras del panel del docente.

/** Parte una lista en las `max` primeras (visibles) y el resto (plegado en <Detalles>). */
export function partirLista(items, max) {
    const lista = Array.isArray(items) ? items : [];
    const tope = Math.max(0, Number(max) || 0);
    return { visibles: lista.slice(0, tope), resto: lista.slice(tope) };
}
