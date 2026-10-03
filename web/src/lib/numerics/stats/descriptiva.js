import { validarNumero, validarParejas, validarVector } from '../common/validar.js';

/** @param {number[]} y */
export function media(y) {
    validarVector(y, 'y', 1);
    return y.reduce((s, v) => s + v, 0) / y.length;
}

/**
 * Varianza muestral (n-1) por defecto; con `{poblacional: true}` divide entre n.
 * Con un solo dato la muestral es 0.
 * @param {number[]} y
 * @param {{poblacional?: boolean}} [opciones]
 */
export function varianza(y, opciones = {}) {
    validarVector(y, 'y', 1);
    if (y.length === 1) {
        return 0;
    }
    const m = media(y);
    const ss = y.reduce((s, v) => s + (v - m) ** 2, 0);
    return ss / (opciones.poblacional ? y.length : y.length - 1);
}

/**
 * @param {number[]} y
 * @param {{poblacional?: boolean}} [opciones]
 */
export function desviacion(y, opciones) {
    return Math.sqrt(varianza(y, opciones));
}

/**
 * Cuantil por interpolación lineal (definición tipo 7: posición p·(n-1)).
 * @param {number[]} y
 * @param {number} p en [0, 1]
 */
export function cuantil(y, p) {
    validarVector(y, 'y', 1);
    validarNumero(p, 'p');
    if (p < 0 || p > 1) {
        throw new RangeError('El cuantil p debe estar en [0, 1].');
    }
    const s = y.slice().sort((a, b) => a - b);
    const pos = p * (s.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * @param {number[]} y
 * @param {number[]} ps
 */
export function cuantiles(y, ps) {
    validarVector(ps, 'ps', 1);
    return ps.map((p) => cuantil(y, p));
}

/** @param {number[]} y */
export function mediana(y) {
    return cuantil(y, 0.5);
}

/**
 * Coeficiente de correlación de Pearson. Devuelve 0 si alguna serie es constante (correlación indefinida).
 * @param {number[]} x
 * @param {number[]} y
 */
export function pearson(x, y) {
    validarParejas(x, y, 2);
    const mx = media(x);
    const my = media(y);
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < x.length; i += 1) {
        sxy += (x[i] - mx) * (y[i] - my);
        sxx += (x[i] - mx) ** 2;
        syy += (y[i] - my) ** 2;
    }
    if (sxx <= 1e-24 || syy <= 1e-24) {
        return 0;
    }
    return sxy / Math.sqrt(sxx * syy);
}

/**
 * Puntajes z = (x - media)/desviación muestral. Con desviación 0 todos los z son 0.
 * @param {number[]} y
 * @returns {number[]}
 */
export function zScore(y) {
    const m = media(y);
    const s = desviacion(y);
    return y.map((v) => (s > 0 ? (v - m) / s : 0));
}

/**
 * Autocorrelación al rezago k: r_k = Σ (y_t - ȳ)(y_{t+k} - ȳ) / Σ (y_t - ȳ)². Serie constante -> 0.
 * @param {number[]} y
 * @param {number} rezago entero en [0, n-1]
 */
export function autocorrelacion(y, rezago) {
    validarVector(y, 'y', 2);
    validarNumero(rezago, 'rezago');
    if (!Number.isInteger(rezago) || rezago < 0 || rezago >= y.length) {
        throw new RangeError(`El rezago debe ser un entero entre 0 y ${y.length - 1}.`);
    }
    const m = media(y);
    let den = 0;
    let num = 0;
    for (let t = 0; t < y.length; t += 1) {
        den += (y[t] - m) ** 2;
        if (t + rezago < y.length) {
            num += (y[t] - m) * (y[t + rezago] - m);
        }
    }
    return den <= 1e-24 ? 0 : num / den;
}

/**
 * Autocorrelaciones de 1 a maxRezago (por omisión n-1 acotado a 10).
 * @param {number[]} y
 * @param {number} [maxRezago]
 */
export function autocorrelaciones(y, maxRezago) {
    validarVector(y, 'y', 2);
    const tope = Math.min(maxRezago ?? 10, y.length - 1);
    return Array.from({ length: tope }, (_, i) => ({ rezago: i + 1, r: autocorrelacion(y, i + 1) }));
}

/** Valores críticos t de dos colas al 95 % para gl = 1..30 (se usa 1.96 si gl > 30). */
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
    2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];

/**
 * Valor crítico t (dos colas, 95 %) tabulado; para gl > 30 usa la aproximación normal 1.96.
 * @param {number} gl grados de libertad (entero >= 1)
 */
export function tCritico95(gl) {
    validarNumero(gl, 'gl');
    if (!Number.isInteger(gl) || gl < 1) {
        throw new RangeError('Los grados de libertad deben ser un entero >= 1.');
    }
    return gl > 30 ? 1.96 : T95[gl - 1];
}
