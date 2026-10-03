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
