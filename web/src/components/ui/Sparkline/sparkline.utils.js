// Funciones puras del Sparkline: limpieza de la serie y dominio del eje y. Sin DOM.

/**
 * Deja solo los números reales de la serie, en orden. Descarta null, undefined, '', booleanos, NaN e Infinity; acepta cadenas
 * numéricas ("12.5": así llegan los numeric de PostgreSQL). Ojo: Number(null) es 0, por eso no basta con Number.isFinite(Number(v)).
 */
export function limpiarSerie(valores) {
    if (!Array.isArray(valores)) return [];
    return valores
        .filter((v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)))
        .map(Number);
}

/** Hay línea que dibujar solo con 2 o más puntos reales. */
export function serieDibujable(valores) {
    return limpiarSerie(valores).length >= 2;
}

/**
 * Dominio [min, max] del eje y. `min` y `max` fijos (si vienen) mandan sobre los datos; si no, el rango de los datos. Si el dominio queda
 * plano (todos los valores iguales y sin límites fijos), se abre ±1 para que la línea caiga al centro y no pegada al borde inferior.
 * Un dominio invertido se ordena.
 */
export function dominioSerie(nums, min, max) {
    const fijo = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
    let lo = fijo(min) ?? Math.min(...nums);
    let hi = fijo(max) ?? Math.max(...nums);
    if (lo > hi) [lo, hi] = [hi, lo];
    if (lo === hi) return [lo - 1, hi + 1];
    return [lo, hi];
}

/** Id válido dentro de url(#...) a partir de un useId (React 19.2 devuelve "_r_0_"; las versiones previas traían ":r0:" o "«r0»"). */
export function idSvg(idReact, sufijo) {
    return `sparkline-${String(idReact).replace(/[^A-Za-z0-9_-]/g, '')}-${sufijo}`;
}
