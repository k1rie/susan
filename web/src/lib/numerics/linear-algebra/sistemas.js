import { validarMatrizCuadrada, validarVector } from '../common/validar.js';
import { eliminacionGaussiana } from './gauss.js';
import { descomposicionLU, resolverConLU } from './lu.js';

/** Norma infinito de una matriz: máxima suma de valores absolutos por fila. */
function normaInfinitoMatriz(A) {
    return Math.max(...A.map((fila) => fila.reduce((s, v) => s + Math.abs(v), 0)));
}

/**
 * Número de condición en norma infinito, cond(A) = ||A|| · ||A^-1||.
 * Valores grandes indican que pequeños errores en los datos se amplifican en la solución.
 *
 * @param {number[][]} A
 * @returns {number}
 * @throws {RangeError} si A es singular
 */
export function numeroCondicion(A) {
    const n = validarMatrizCuadrada(A);
    const lu = descomposicionLU(A);
    // A^-1 se obtiene resolviendo A x = e_j para cada columna de la identidad.
    const inversa = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let j = 0; j < n; j += 1) {
        const e = new Array(n).fill(0);
        e[j] = 1;
        const { solucion } = resolverConLU(lu, e);
        for (let i = 0; i < n; i += 1) {
            inversa[i][j] = solucion[i];
        }
    }
    return normaInfinitoMatriz(A) * normaInfinitoMatriz(inversa);
}

/**
 * Resuelve Ax = b y reporta residuo, condición y advertencias.
 *
 * @param {number[][]} A
 * @param {number[]} b
 * @param {{metodo?: 'lu'|'gauss'}} [opciones]
 * @returns {{solucion: number[], metodo: string, residuo: number, condicion: number, advertencias: string[], determinante: number, pasos: import('../common/validar.js').Paso[]}}
 */
export function resolverSistema(A, b, opciones = {}) {
    const n = validarMatrizCuadrada(A);
    validarVector(b, 'b', n);
    const metodo = opciones.metodo ?? 'lu';
    if (metodo !== 'lu' && metodo !== 'gauss') {
        throw new RangeError("El método debe ser 'lu' o 'gauss'.");
    }
    let solucion;
    let pasos;
    let determinante;
    if (metodo === 'gauss') {
        const r = eliminacionGaussiana(A, b);
        ({ solucion, pasos, determinante } = r);
    } else {
        const lu = descomposicionLU(A);
        const r = resolverConLU(lu, b);
        solucion = r.solucion;
        pasos = [...lu.pasos, ...r.pasos];
        determinante = lu.determinante;
    }
    // Residuo ||Ax - b||_inf: mide cuánto cumple la solución las ecuaciones originales.
    let residuo = 0;
    for (let i = 0; i < n; i += 1) {
        let s = -b[i];
        for (let j = 0; j < n; j += 1) {
            s += A[i][j] * solucion[j];
        }
        residuo = Math.max(residuo, Math.abs(s));
    }
    const condicion = numeroCondicion(A);
    const advertencias = [];
    if (condicion > 1e8) {
        advertencias.push(`Sistema mal condicionado (cond ≈ ${condicion.toExponential(2)}): la solución puede perder varias cifras significativas.`);
    }
    return { solucion, metodo, residuo, condicion, advertencias, determinante, pasos };
}
