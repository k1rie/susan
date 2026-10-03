import { validarVector } from '../common/validar.js';
import { splineCubicoNatural } from './spline.js';

/**
 * Rellena huecos interiores (null/undefined/NaN) de una serie interpolando con los puntos conocidos
 * (spline cúbico natural si hay >= 3, lineal si hay 2). Los huecos de los extremos NO se extrapolan.
 * Uso: sesiones suspendidas o semanas sin clase dentro de la serie.
 *
 * @param {number[]} xs posiciones (p. ej. semanas), estrictamente crecientes
 * @param {(number|null)[]} ys valores con huecos
 * @returns {{valores: (number|null)[], rellenados: number[], metodo: 'spline'|'lineal'|'ninguno'}}
 */
export function rellenarHuecos(xs, ys) {
    validarVector(xs, 'xs', 0);
    if (!Array.isArray(ys) || ys.length !== xs.length) {
        throw new RangeError('ys debe ser un arreglo de la misma longitud que xs.');
    }
    const esValor = (v) => typeof v === 'number' && Number.isFinite(v);
    const idx = [];
    ys.forEach((v, i) => {
        if (esValor(v)) {
            idx.push(i);
        }
    });
    const valores = ys.map((v) => (esValor(v) ? v : null));
    const rellenados = [];
    if (idx.length < 2) {
        return { valores, rellenados, metodo: 'ninguno' };
    }
    const kx = idx.map((i) => xs[i]);
    const ky = idx.map((i) => ys[i]);
    const spline = splineCubicoNatural(kx, ky);
    const primero = idx[0];
    const ultimo = idx[idx.length - 1];
    for (let i = primero; i <= ultimo; i += 1) {
        if (valores[i] === null) {
            valores[i] = spline.evaluar(xs[i]);
            rellenados.push(i);
        }
    }
    return { valores, rellenados, metodo: idx.length >= 3 ? 'spline' : 'lineal' };
}
