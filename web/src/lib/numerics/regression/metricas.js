import { validarParejas } from '../common/validar.js';

/**
 * Residuos e_i = y_i - ŷ_i.
 * @param {number[]} y
 * @param {number[]} yAjustado
 * @returns {number[]}
 */
export function residuos(y, yAjustado) {
    validarParejas(y, yAjustado, 1, ['y', 'yAjustado']);
    return y.map((v, i) => v - yAjustado[i]);
}

/**
 * Suma de cuadrados de los residuos (SSE).
 * @param {number[]} y
 * @param {number[]} yAjustado
 */
export function sumaCuadradosResiduos(y, yAjustado) {
    return residuos(y, yAjustado).reduce((s, e) => s + e * e, 0);
}

/**
 * Coeficiente de determinación R² = 1 - SSE/SST.
 * Si y es constante (SST = 0) se devuelve 1 cuando el ajuste es exacto y 0 en otro caso.
 *
 * @param {number[]} y
 * @param {number[]} yAjustado
 * @returns {number}
 */
export function r2(y, yAjustado) {
    validarParejas(y, yAjustado, 1, ['y', 'yAjustado']);
    const media = y.reduce((s, v) => s + v, 0) / y.length;
    const sst = y.reduce((s, v) => s + (v - media) ** 2, 0);
    const sse = sumaCuadradosResiduos(y, yAjustado);
    if (sst <= 1e-24) {
        return sse <= 1e-18 ? 1 : 0;
    }
    return 1 - sse / sst;
}

/**
 * R² ajustado = 1 - (1 - R²)(n - 1)/(n - k - 1), con k predictores (el grado).
 * Devuelve null si no hay grados de libertad (n - k - 1 <= 0).
 *
 * @param {number} r2Valor
 * @param {number} n
 * @param {number} k
 * @returns {number|null}
 */
export function r2Ajustado(r2Valor, n, k) {
    const gl = n - k - 1;
    if (gl <= 0) {
        return null;
    }
    return 1 - ((1 - r2Valor) * (n - 1)) / gl;
}

/**
 * Error estándar de la regresión s = sqrt(SSE / (n - p)), con p parámetros.
 * Devuelve null si n <= p.
 *
 * @param {number} sse
 * @param {number} n
 * @param {number} parametros
 * @returns {number|null}
 */
export function errorEstandar(sse, n, parametros) {
    const gl = n - parametros;
    if (gl <= 0) {
        return null;
    }
    return Math.sqrt(sse / gl);
}

/**
 * Criterio de Akaike para errores gaussianos: n·ln(SSE/n) + 2p.
 * Se acota SSE por debajo para que un ajuste exacto no produzca -Infinity.
 *
 * @param {number} n
 * @param {number} sse
 * @param {number} parametros
 */
export function aic(n, sse, parametros) {
    const piso = n * 1e-12;
    return n * Math.log(Math.max(sse, piso) / n) + 2 * parametros;
}
