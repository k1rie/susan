// Utilidades puras de las correcciones recientes (bitácora de los últimos 30 días).
const ORDEN = ['presente', 'retardo', 'ausente', 'justificado', 'pendiente'];

/** Cuántas correcciones terminaron en cada estado: [{ clave, valor }] solo con valor > 0 y estados conocidos, en orden fijo. */
export function distribucionCorrecciones(items) {
    const cuenta = {};
    for (const c of Array.isArray(items) ? items : []) {
        if (ORDEN.includes(c?.estado_nuevo)) cuenta[c.estado_nuevo] = (cuenta[c.estado_nuevo] ?? 0) + 1;
    }
    return ORDEN.filter((k) => cuenta[k] > 0).map((k) => ({ clave: k, valor: cuenta[k] }));
}

/** Cuántas fueron automáticas (plazo vencido) y cuántas las hizo una persona. */
export function conteoAutomaticas(items) {
    const lista = Array.isArray(items) ? items : [];
    const automaticas = lista.filter((c) => c?.automatica).length;
    return { automaticas, manuales: lista.length - automaticas };
}

/** Quién hizo la corrección, en una palabra. */
export function autorCorreccion(c) {
    if (c?.automatica) return 'Automática';
    return c?.usuario?.rol === 'docente' ? 'Docente' : (c?.usuario?.rol ?? '-');
}
