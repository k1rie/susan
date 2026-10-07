// Utilidades puras de BarraFiltros.

export function esVacio(valor) {
    return Array.isArray(valor) ? valor.length === 0 : valor == null || valor === '';
}

export function valorVacio(filtro) {
    return filtro.multiple ? [] : '';
}

// Etiqueta legible de un valor de filtro según sus opciones (cae al propio valor si no está en la lista).
export function etiquetaDe(filtro, valor) {
    return filtro.options?.find((o) => String(o.value) === String(valor))?.label ?? String(valor);
}

// Un chip por cada valor activo: un filtro simple aporta uno y uno múltiple, uno por opción elegida.
export function chipsActivos(filtros) {
    const chips = [];
    for (const f of filtros) {
        if (esVacio(f.value)) continue;
        const valores = Array.isArray(f.value) ? f.value : [f.value];
        for (const v of valores) chips.push({ clave: `${f.name}:${v}`, filtro: f, valor: v, texto: etiquetaDe(f, v) });
    }
    return chips;
}

// Quita un solo valor de un filtro (en uno múltiple deja el resto).
export function valorSinElegir(filtro, valor) {
    if (!Array.isArray(filtro.value)) return '';
    return filtro.value.filter((v) => String(v) !== String(valor));
}
