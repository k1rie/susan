// Geometría de la barra de la ventana de tolerancia (RN-06). Solo presentación: las fases las decide el servidor.

const acotar = (n) => Math.min(100, Math.max(0, n));

/**
 * Posiciones en % (0-100) sobre la ventana completa: `actual` = minuto actual, `presente` = fin del tramo de puntualidad.
 * Sin tolerancia válida (> 0) devuelve `total: null` y la barra no se dibuja.
 */
export function geometriaVentana(sesion) {
    const minuto = Number(sesion?.minuto_actual);
    const total = Number(sesion?.tolerancia_min);
    const limite = Number(sesion?.limite_presente_min);
    if (!Number.isFinite(total) || total <= 0) return { total: null, minuto: null, limite: null, actual: 0, presente: 0 };
    return {
        total,
        minuto: Number.isFinite(minuto) ? minuto : null,
        limite: Number.isFinite(limite) ? limite : null,
        actual: Number.isFinite(minuto) ? acotar((minuto / total) * 100) : 0,
        presente: Number.isFinite(limite) ? acotar((limite / total) * 100) : 0,
    };
}
