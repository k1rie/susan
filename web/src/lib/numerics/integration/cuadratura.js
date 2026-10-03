import { evaluarFinito, validarFuncion, validarNumero, validarParejas, validarVector } from '../common/validar.js';

function validarIntervalo(f, a, b, n) {
    validarFuncion(f);
    validarNumero(a, 'a');
    validarNumero(b, 'b');
    validarNumero(n, 'n');
    if (!(b > a)) {
        throw new RangeError('Se requiere a < b.');
    }
    if (!Number.isInteger(n) || n < 1) {
        throw new RangeError('El número de subintervalos n debe ser un entero >= 1.');
    }
}

/**
 * Regla del trapecio compuesta: h/2·[f0 + 2(f1+...+f_{n-1}) + fn]. Error O(h²).
 * @param {(x: number) => number} f
 * @param {number} a
 * @param {number} b
 * @param {number} n subintervalos
 * @returns {{valor: number, n: number, h: number}}
 */
export function trapecioCompuesto(f, a, b, n) {
    validarIntervalo(f, a, b, n);
    const h = (b - a) / n;
    let s = evaluarFinito(f, a) + evaluarFinito(f, b);
    for (let i = 1; i < n; i += 1) {
        s += 2 * evaluarFinito(f, a + i * h);
    }
    return { valor: (h / 2) * s, n, h };
}

/**
 * Simpson 1/3 compuesto: h/3·[f0 + 4·impares + 2·pares + fn]. n par. Error O(h⁴).
 * @param {(x: number) => number} f
 * @param {number} a
 * @param {number} b
 * @param {number} n subintervalos (par)
 * @returns {{valor: number, n: number, h: number}}
 */
export function simpson13(f, a, b, n) {
    validarIntervalo(f, a, b, n);
    if (n % 2 !== 0) {
        throw new RangeError('Simpson 1/3 requiere un número par de subintervalos.');
    }
    const h = (b - a) / n;
    let s = evaluarFinito(f, a) + evaluarFinito(f, b);
    for (let i = 1; i < n; i += 1) {
        s += (i % 2 === 0 ? 2 : 4) * evaluarFinito(f, a + i * h);
    }
    return { valor: (h / 3) * s, n, h };
}

/**
 * Simpson 3/8 compuesto: 3h/8·[f0 + 3(f1+f2+f4+f5+...) + 2(f3+f6+...) + fn]. n múltiplo de 3. Error O(h⁴).
 * @param {(x: number) => number} f
 * @param {number} a
 * @param {number} b
 * @param {number} n subintervalos (múltiplo de 3)
 * @returns {{valor: number, n: number, h: number}}
 */
export function simpson38(f, a, b, n) {
    validarIntervalo(f, a, b, n);
    if (n % 3 !== 0) {
        throw new RangeError('Simpson 3/8 requiere un número de subintervalos múltiplo de 3.');
    }
    const h = (b - a) / n;
    let s = evaluarFinito(f, a) + evaluarFinito(f, b);
    for (let i = 1; i < n; i += 1) {
        s += (i % 3 === 0 ? 2 : 3) * evaluarFinito(f, a + i * h);
    }
    return { valor: (3 * h / 8) * s, n, h };
}

/**
 * Trapecio sobre datos tabulados (nodos no uniformes): Σ (x_{i+1}-x_i)(y_i+y_{i+1})/2.
 * Uso: ausentismo acumulado como área bajo la curva de la tasa semanal.
 *
 * @param {number[]} xs estrictamente crecientes
 * @param {number[]} ys
 * @returns {{valor: number, acumulado: number[]}} `acumulado[i]` = área desde x_0 hasta x_i
 */
export function trapecioDatos(xs, ys) {
    validarParejas(xs, ys, 2, ['xs', 'ys']);
    const acumulado = [0];
    for (let i = 1; i < xs.length; i += 1) {
        if (!(xs[i] > xs[i - 1])) {
            throw new RangeError('Los nodos x deben ser estrictamente crecientes.');
        }
        acumulado.push(acumulado[i - 1] + ((xs[i] - xs[i - 1]) * (ys[i - 1] + ys[i])) / 2);
    }
    return { valor: acumulado[acumulado.length - 1], acumulado };
}

/**
 * Simpson 1/3 sobre datos equiespaciados (n+1 puntos con n par).
 * @param {number[]} ys
 * @param {number} h paso entre datos
 */
export function simpsonDatos(ys, h) {
    validarVector(ys, 'ys', 3);
    validarNumero(h, 'h');
    if (h <= 0) {
        throw new RangeError('El paso h debe ser positivo.');
    }
    const n = ys.length - 1;
    if (n % 2 !== 0) {
        throw new RangeError('Simpson 1/3 requiere un número impar de datos (n par de subintervalos).');
    }
    let s = ys[0] + ys[n];
    for (let i = 1; i < n; i += 1) {
        s += (i % 2 === 0 ? 2 : 4) * ys[i];
    }
    return { valor: (h / 3) * s };
}
