/**
 * Validaciones compartidas por todos los métodos numéricos.
 * Convención: tipo equivocado -> TypeError; valor fuera de dominio -> RangeError (mensajes en español).
 */

/** Épsilon de máquina en doble precisión. */
export const EPS = 2.220446049250313e-16;

/**
 * @typedef {object} Paso
 * Un paso de procedimiento mostrable en la interfaz didáctica.
 * @property {string} titulo
 * @property {string} [texto]
 * @property {{etiqueta: string, valor: number|string|null}[]} [valores]
 * @property {{columnas: string[], filas: (number|string|null)[][]}} [tabla]
 * @property {number[][]} [matriz]
 */

/**
 * @param {unknown} valor
 * @param {string} nombre
 */
export function validarNumero(valor, nombre) {
    if (typeof valor !== 'number') {
        throw new TypeError(`${nombre} debe ser un número.`);
    }
    if (!Number.isFinite(valor)) {
        throw new RangeError(`${nombre} debe ser un número finito.`);
    }
}

/**
 * @param {unknown} v
 * @param {string} nombre
 * @param {number} [minimo]
 */
export function validarVector(v, nombre, minimo = 1) {
    if (!Array.isArray(v)) {
        throw new TypeError(`${nombre} debe ser un arreglo de números.`);
    }
    if (v.length < minimo) {
        throw new RangeError(`${nombre} requiere al menos ${minimo} valor(es); se recibieron ${v.length}.`);
    }
    for (let i = 0; i < v.length; i += 1) {
        validarNumero(v[i], `${nombre}[${i}]`);
    }
}

/**
 * @param {unknown} x
 * @param {unknown} y
 * @param {number} minimo
 * @param {[string, string]} [nombres]
 */
export function validarParejas(x, y, minimo, nombres = ['x', 'y']) {
    validarVector(x, nombres[0], minimo);
    validarVector(y, nombres[1], minimo);
    if (x.length !== y.length) {
        throw new RangeError(`${nombres[0]} y ${nombres[1]} deben tener la misma longitud (${x.length} y ${y.length}).`);
    }
}

/**
 * @param {unknown} f
 * @param {string} [nombre]
 */
export function validarFuncion(f, nombre = 'f') {
    if (typeof f !== 'function') {
        throw new TypeError(`${nombre} debe ser una función.`);
    }
}

/**
 * Valida una matriz cuadrada de números y devuelve su orden.
 * @param {unknown} A
 * @param {string} [nombre]
 * @returns {number}
 */
export function validarMatrizCuadrada(A, nombre = 'A') {
    if (!Array.isArray(A) || A.length === 0) {
        throw new TypeError(`${nombre} debe ser una matriz (arreglo de filas) no vacía.`);
    }
    const n = A.length;
    for (let i = 0; i < n; i += 1) {
        if (!Array.isArray(A[i])) {
            throw new TypeError(`${nombre}[${i}] debe ser un arreglo de números.`);
        }
        if (A[i].length !== n) {
            throw new RangeError(`${nombre} debe ser cuadrada: la fila ${i} tiene ${A[i].length} columnas y se esperaban ${n}.`);
        }
        for (let j = 0; j < n; j += 1) {
            validarNumero(A[i][j], `${nombre}[${i}][${j}]`);
        }
    }
    return n;
}

/**
 * Evalúa f(x) y exige un resultado finito.
 * @param {(x: number) => number} f
 * @param {number} x
 * @returns {number}
 */
export function evaluarFinito(f, x) {
    const v = f(x);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new RangeError(`La función no devolvió un valor finito en x = ${x}.`);
    }
    return v;
}

/** @param {number[][]} M */
export function copiarMatriz(M) {
    return M.map((fila) => fila.slice());
}
