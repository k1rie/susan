// Validación de cliente de parametros (la definitiva es del servidor) y avisos de parametros criticos.

export const AVISOS_CRITICOS = {
    umbral_similitud: 'Aplica a las capturas siguientes; las detecciones ya registradas conservan su validez.',
    min_detecciones_validas: 'Aplica a las capturas siguientes; las detecciones ya registradas conservan su validez.',
    intervalo_muestreo_seg: 'Solo afecta a las sesiones que se programen después de este cambio.',
    dimension_vector: 'Cambiar la dimensión exige cambiar el modelo y reconstruir el índice completo.',
};

export function esCritico(clave) {
    return Object.hasOwn(AVISOS_CRITICOS, clave);
}

/** Devuelve el mensaje de error o null si el texto es un valor valido para el parametro. */
export function validarValor(parametro, texto) {
    const t = String(texto ?? '').trim();
    if (t === '') return 'El valor no puede estar en blanco.';
    const tipo = parametro.tipo;
    if (tipo === 'entero' || tipo === 'decimal' || tipo === 'numerico') {
        if (tipo === 'entero' ? !/^-?\d+$/.test(t) : !/^-?\d+([.,]\d+)?$/.test(t)) {
            return tipo === 'entero' ? 'Debe ser un número entero.' : 'Debe ser un número.';
        }
        const n = Number(t.replace(',', '.'));
        const min = parametro.minimo != null ? Number(parametro.minimo) : null;
        const max = parametro.maximo != null ? Number(parametro.maximo) : null;
        if ((min != null && n < min) || (max != null && n > max)) return `Fuera de rango: ${textoRango(parametro)}.`;
    }
    return null;
}

export function textoRango(p) {
    const u = p.unidad ? ` ${p.unidad}` : '';
    if (p.minimo != null && p.maximo != null) return `de ${p.minimo} a ${p.maximo}${u}`;
    if (p.minimo != null) return `mínimo ${p.minimo}${u}`;
    if (p.maximo != null) return `máximo ${p.maximo}${u}`;
    return u.trim() || 'sin rango';
}

const fechaCorta = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('es-MX') : null;
};

/**
 * Línea de ayuda de una fila en una sola frase corta: "decimal · de 0.5 a 0.999 score · modificado 12/03/2026 por ana@x".
 * El tipo y el rango ayudan a teclear un valor válido; la última modificación solo se añade si existe.
 */
export function resumenParametro(p) {
    const partes = [p.tipo, textoRango(p)].filter(Boolean);
    const f = fechaCorta(p.fecha_actualizacion);
    if (f) partes.push(`modificado ${f}${p.actualizado_por?.correo ? ` por ${p.actualizado_por.correo}` : ''}`);
    return partes.join(' · ');
}

/** "12 parámetros, 4 críticos": encabezado corto de la lista. */
export function resumenLista(items = []) {
    const lista = items || [];
    const criticos = lista.filter((p) => esCritico(p.clave)).length;
    const n = lista.length;
    return `${n} parámetro${n === 1 ? '' : 's'}${criticos ? `, ${criticos} crítico${criticos === 1 ? '' : 's'}` : ''}`;
}
