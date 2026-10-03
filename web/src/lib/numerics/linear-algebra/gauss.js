import { EPS, copiarMatriz, validarMatrizCuadrada, validarVector } from '../common/validar.js';

/** @typedef {import('../common/validar.js').Paso} Paso */

/** Tolerancia de singularidad relativa a la escala de la matriz. */
function tolerancia(A) {
    let escala = 0;
    for (const fila of A) {
        for (const v of fila) {
            escala = Math.max(escala, Math.abs(v));
        }
    }
    return A.length * EPS * (escala || 1);
}

/**
 * Eliminación gaussiana con pivoteo parcial y sustitución regresiva.
 * Muestra cada etapa (matriz aumentada, intercambios, multiplicadores) en `pasos`.
 *
 * @param {number[][]} A matriz cuadrada n x n
 * @param {number[]} b términos independientes (n)
 * @returns {{solucion: number[], determinante: number, matrizTriangular: number[][], pasos: Paso[]}}
 * @throws {RangeError} si la matriz es singular (pivote nulo)
 */
export function eliminacionGaussiana(A, b) {
    const n = validarMatrizCuadrada(A);
    validarVector(b, 'b', n);
    if (b.length !== n) {
        throw new RangeError(`b debe tener ${n} elementos; se recibieron ${b.length}.`);
    }
    const tol = tolerancia(A);
    const M = A.map((fila, i) => [...fila, b[i]]);
    /** @type {Paso[]} */
    const pasos = [{
        titulo: 'Matriz aumentada [A | b]',
        texto: 'Se parte del sistema Ax = b escrito como matriz aumentada.',
        matriz: copiarMatriz(M),
    }];
    let signo = 1;
    for (let k = 0; k < n; k += 1) {
        // Pivoteo parcial: el mayor |a_ik| de la columna evita dividir entre números pequeños.
        let p = k;
        for (let i = k + 1; i < n; i += 1) {
            if (Math.abs(M[i][k]) > Math.abs(M[p][k])) {
                p = i;
            }
        }
        if (Math.abs(M[p][k]) <= tol) {
            throw new RangeError(`La matriz es singular o casi singular: no hay pivote utilizable en la columna ${k + 1}.`);
        }
        if (p !== k) {
            [M[p], M[k]] = [M[k], M[p]];
            signo = -signo;
        }
        const multiplicadores = [];
        for (let i = k + 1; i < n; i += 1) {
            const m = M[i][k] / M[k][k];
            multiplicadores.push({ etiqueta: `m${i + 1}${k + 1}`, valor: m });
            M[i][k] = 0;
            for (let j = k + 1; j <= n; j += 1) {
                M[i][j] -= m * M[k][j];
            }
        }
        pasos.push({
            titulo: `Etapa ${k + 1}: pivote ${M[k][k].toPrecision(6)}${p !== k ? ` (se intercambian filas ${k + 1} y ${p + 1})` : ''}`,
            texto: 'Se anulan los elementos bajo el pivote restando m_ik veces la fila pivote.',
            valores: multiplicadores,
            matriz: copiarMatriz(M),
        });
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let s = M[i][n];
        for (let j = i + 1; j < n; j += 1) {
            s -= M[i][j] * x[j];
        }
        x[i] = s / M[i][i];
    }
    pasos.push({
        titulo: 'Sustitución regresiva',
        texto: 'Se resuelve desde la última ecuación hacia la primera.',
        valores: x.map((v, i) => ({ etiqueta: `x${i + 1}`, valor: v })),
    });
    let determinante = signo;
    for (let i = 0; i < n; i += 1) {
        determinante *= M[i][i];
    }
    return { solucion: x, determinante, matrizTriangular: M, pasos };
}

export { tolerancia as toleranciaSingularidad };
