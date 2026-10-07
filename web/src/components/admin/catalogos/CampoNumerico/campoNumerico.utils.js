// Funciones puras del campo numérico con «−» y «+» (capacidad, créditos, horas por semana).

/** Deja solo dígitos y recorta al largo máximo (pegar «  1 200 » da «1200»). */
export function limpiarDigitos(texto, maxDigitos = 4) {
    return String(texto ?? '').replace(/\D/g, '').slice(0, maxDigitos);
}

/**
 * Valor tras pulsar «+» (paso > 0) o «−» (paso < 0). Un campo vacío o fuera de rango arranca en el límite más cercano en vez de
 * quedarse en «NaN»: vacío + «+» da `min` (o `inicio`), vacío + «−» da `min`; por encima del máximo baja a `max`.
 */
export function pasarValor(texto, paso, { min = 0, max = 9999, inicio } = {}) {
    const actual = Number(String(texto ?? '').trim());
    if (String(texto ?? '').trim() === '' || !Number.isFinite(actual)) return String(paso > 0 && inicio != null ? inicio : min);
    return String(Math.min(max, Math.max(min, actual + paso)));
}
