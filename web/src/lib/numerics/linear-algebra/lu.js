import { copiarMatriz, validarMatrizCuadrada, validarVector } from '../common/validar.js';
import { toleranciaSingularidad } from './gauss.js';

/** @typedef {import('../common/validar.js').Paso} Paso */

/**
 * Descomposición LU con pivoteo parcial: P A = L U (L triangular inferior con diagonal 1).
 *
 * @param {number[][]} A
 * @returns {{L: number[][], U: number[][], P: number[][], permutacion: number[], signo: 1|-1, determinante: number, pasos: Paso[]}}
 * @throws {RangeError} si A es singular
 */
export function descomposicionLU(A) {
    const n = validarMatrizCuadrada(A);
    const tol = toleranciaSingularidad(A);
    const U = copiarMatriz(A);
    const L = Array.from({ length: n }, () => new Array(n).fill(0));
    const permutacion = Array.from({ length: n }, (_, i) => i);
    let signo = 1;
    for (let k = 0; k < n; k += 1) {
        let p = k;
        for (let i = k + 1; i < n; i += 1) {
            if (Math.abs(U[i][k]) > Math.abs(U[p][k])) {
                p = i;
            }
        }
        if (Math.abs(U[p][k]) <= tol) {
            throw new RangeError(`La matriz es singular o casi singular: no hay pivote utilizable en la columna ${k + 1}.`);
        }
        if (p !== k) {
            [U[p], U[k]] = [U[k], U[p]];
            [permutacion[p], permutacion[k]] = [permutacion[k], permutacion[p]];
            // Los multiplicadores ya calculados viajan con su fila.
            for (let j = 0; j < k; j += 1) {
                [L[p][j], L[k][j]] = [L[k][j], L[p][j]];
            }
            signo = -signo;
        }
        for (let i = k + 1; i < n; i += 1) {
            const m = U[i][k] / U[k][k];
            L[i][k] = m;
            U[i][k] = 0;
            for (let j = k + 1; j < n; j += 1) {
                U[i][j] -= m * U[k][j];
            }
        }
    }
    for (let i = 0; i < n; i += 1) {
        L[i][i] = 1;
    }
    const P = Array.from({ length: n }, (_, i) => {
        const fila = new Array(n).fill(0);
        fila[permutacion[i]] = 1;
        return fila;
    });
    let determinante = signo;
    for (let i = 0; i < n; i += 1) {
        determinante *= U[i][i];
    }
    /** @type {Paso[]} */
    const pasos = [
        { titulo: 'Matriz de permutación P', matriz: P },
        { titulo: 'Factor L (multiplicadores)', texto: 'Cada l_ik es el multiplicador usado al eliminar.', matriz: copiarMatriz(L) },
        { titulo: 'Factor U (triangular superior)', texto: 'Se cumple P·A = L·U.', matriz: copiarMatriz(U) },
    ];
    return { L, U, P, permutacion, signo, determinante, pasos };
}

/**
 * Resuelve Ax = b con una factorización LU ya calculada (sustitución progresiva y regresiva).
 *
 * @param {{L: number[][], U: number[][], permutacion: number[]}} lu
 * @param {number[]} b
 * @returns {{solucion: number[], y: number[], pasos: Paso[]}}
 */
export function resolverConLU(lu, b) {
    const n = lu.L.length;
    validarVector(b, 'b', n);
    if (b.length !== n) {
        throw new RangeError(`b debe tener ${n} elementos; se recibieron ${b.length}.`);
    }
    const pb = lu.permutacion.map((idx) => b[idx]);
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        let s = pb[i];
        for (let j = 0; j < i; j += 1) {
            s -= lu.L[i][j] * y[j];
        }
        y[i] = s;
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let s = y[i];
        for (let j = i + 1; j < n; j += 1) {
            s -= lu.U[i][j] * x[j];
        }
        x[i] = s / lu.U[i][i];
    }
    return {
        solucion: x,
        y,
        pasos: [
            { titulo: 'Sustitución progresiva L y = P b', valores: y.map((v, i) => ({ etiqueta: `y${i + 1}`, valor: v })) },
            { titulo: 'Sustitución regresiva U x = y', valores: x.map((v, i) => ({ etiqueta: `x${i + 1}`, valor: v })) },
        ],
    };
}
