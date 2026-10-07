// Índices de los elementos que se pueden activar (los deshabilitados se saltan con el teclado).
export function indicesHabilitados(items) {
    return items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i !== -1);
}

// Siguiente índice habilitado en la dirección `paso` (+1 / -1), dando la vuelta al llegar al borde. Sin habilitados devuelve -1.
export function moverIndice(items, actual, paso) {
    const lista = indicesHabilitados(items);
    if (lista.length === 0) return -1;
    const pos = lista.indexOf(actual);
    if (pos === -1) return paso > 0 ? lista[0] : lista[lista.length - 1];
    return lista[(pos + paso + lista.length) % lista.length];
}

function sinAcentos(texto) {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Búsqueda por primera letra: el siguiente elemento habilitado, después del actual, cuyo texto empieza con la tecla.
export function indicePorLetra(items, actual, tecla) {
    const letra = sinAcentos(tecla);
    const habilitados = indicesHabilitados(items);
    if (habilitados.length === 0) return -1;
    const orden = [...habilitados.filter((i) => i > actual), ...habilitados.filter((i) => i <= actual)];
    return orden.find((i) => sinAcentos(items[i].label).startsWith(letra)) ?? -1;
}

// Posición fija (position: fixed) del menú respecto del botón: debajo si cabe y, si no cabe y hay más lugar arriba, encima. `alinear`
// 'end' pega el borde derecho del menú al del botón; 'start', el izquierdo. Nunca sale del ancho de la pantalla.
export function posicionMenu(rect, { viewport, altoMenu, anchoMenu = 176, alinear = 'end', margen = 4, borde = 8 }) {
    const espacioAbajo = viewport.alto - rect.bottom;
    const arriba = espacioAbajo < altoMenu + margen && rect.top > espacioAbajo;
    const vertical = arriba ? { bottom: viewport.alto - rect.top + margen } : { top: rect.bottom + margen };
    const horizontal =
        alinear === 'start'
            ? { left: Math.max(borde, Math.min(rect.left, viewport.ancho - anchoMenu - borde)) }
            : { right: Math.max(borde, Math.min(viewport.ancho - rect.right, viewport.ancho - anchoMenu - borde)) };
    return { ...vertical, ...horizontal };
}
