// Lógica pura de la cola de revisión: pestañas, claves de caso y selección del siguiente.

export const PESTANAS = ['pendientes', 'justificantes', 'correcciones'];

/** Campo de la respuesta de la cola por pestaña. */
export const CAMPO_LISTA = {
    pendientes: 'pendientes',
    justificantes: 'justificantes',
    correcciones: 'correcciones_recientes',
};

/** Campo contador por pestaña. */
export const CAMPO_CONTADOR = {
    pendientes: 'pendientes',
    justificantes: 'justificantes',
    correcciones: 'correcciones_recientes',
};

const CAMPO_ID = {
    pendientes: 'id_asistencia',
    justificantes: 'id_justificante',
    correcciones: 'id_bitacora',
};

export function normalizarPestana(valor) {
    return PESTANAS.includes(valor) ? valor : 'pendientes';
}

export function normalizarCaso(valor) {
    const n = Number(valor);
    return Number.isInteger(n) && n > 0 ? n : null;
}

export function idDeCaso(pestana, item) {
    return item?.[CAMPO_ID[pestana]] ?? null;
}

/** Une la lista base con las páginas extra sin repetir casos. */
export function unirListas(pestana, base = [], extra = []) {
    const vistos = new Set(base.map((i) => idDeCaso(pestana, i)));
    return [...base, ...extra.filter((i) => !vistos.has(idDeCaso(pestana, i)))];
}

/**
 * Caso a seleccionar tras resolver: el primero de la lista nueva que seguía al resuelto en la anterior;
 * si no hay, el primero; si la lista quedó vacía, null.
 */
export function siguienteCaso(pestana, listaAnterior = [], idResuelto, listaNueva = []) {
    if (listaNueva.length === 0) return null;
    const ids = new Set(listaNueva.map((i) => idDeCaso(pestana, i)));
    const pos = listaAnterior.findIndex((i) => idDeCaso(pestana, i) === idResuelto);
    for (let k = pos + 1; pos >= 0 && k < listaAnterior.length; k += 1) {
        const id = idDeCaso(pestana, listaAnterior[k]);
        if (ids.has(id)) return id;
    }
    return idDeCaso(pestana, listaNueva[0]);
}

export function urlRevision(ruta, pestana, caso) {
    const q = new URLSearchParams();
    q.set('pestana', pestana);
    if (caso) q.set('caso', String(caso));
    return `${ruta}?${q.toString()}`;
}

export const VACIOS = {
    pendientes: 'No tienes casos pendientes',
    justificantes: 'No hay justificantes por resolver',
    correcciones: 'Aún no hay correcciones en los últimos 30 días',
};
