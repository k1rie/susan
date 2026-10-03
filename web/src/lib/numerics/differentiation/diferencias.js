import { evaluarFinito, validarFuncion, validarNumero, validarParejas } from '../common/validar.js';

function validarIndice(xs, i, minimo, maximo) {
    if (!Number.isInteger(i) || i < minimo || i > maximo) {
        throw new RangeError(`El índice ${i} está fuera del rango permitido [${minimo}, ${maximo}] para este esquema.`);
    }
}

function validarNodos(xs, ys) {
    validarParejas(xs, ys, 2, ['xs', 'ys']);
    for (let i = 1; i < xs.length; i += 1) {
        if (!(xs[i] > xs[i - 1])) {
            throw new RangeError('Los nodos x deben ser estrictamente crecientes.');
        }
    }
}

/**
 * Diferencia hacia adelante (primer orden): f'(x_i) ≈ (y_{i+1} - y_i)/(x_{i+1} - x_i). Admite nodos no uniformes.
 * @param {number[]} xs
 * @param {number[]} ys
 * @param {number} i
 */
export function diferenciaAdelante(xs, ys, i) {
    validarNodos(xs, ys);
    validarIndice(xs, i, 0, xs.length - 2);
    return (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
}

/**
 * Diferencia hacia atrás (primer orden): f'(x_i) ≈ (y_i - y_{i-1})/(x_i - x_{i-1}).
 * @param {number[]} xs
 * @param {number[]} ys
 * @param {number} i
 */
export function diferenciaAtras(xs, ys, i) {
    validarNodos(xs, ys);
    validarIndice(xs, i, 1, xs.length - 1);
    return (ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1]);
}

/**
 * Diferencia central de segundo orden con nodos no uniformes (h1 = x_i - x_{i-1}, h2 = x_{i+1} - x_i):
 *   f'(x_i) ≈ -h2/(h1(h1+h2))·y_{i-1} + (h2-h1)/(h1·h2)·y_i + h1/(h2(h1+h2))·y_{i+1}
 * Con h1 = h2 = h se reduce a (y_{i+1} - y_{i-1})/(2h). Es exacta para parábolas.
 *
 * @param {number[]} xs
 * @param {number[]} ys
 * @param {number} i
 */
export function diferenciaCentral(xs, ys, i) {
    validarNodos(xs, ys);
    validarIndice(xs, i, 1, xs.length - 2);
    const h1 = xs[i] - xs[i - 1];
    const h2 = xs[i + 1] - xs[i];
    return (-h2 / (h1 * (h1 + h2))) * ys[i - 1]
        + ((h2 - h1) / (h1 * h2)) * ys[i]
        + (h1 / (h2 * (h1 + h2))) * ys[i + 1];
}

/**
 * Derivada en el nodo `ie` de la parábola que pasa por tres puntos (esquema de tres puntos general,
 * sirve para los extremos con diferencias unilaterales de segundo orden).
 */
function derivadaTresPuntos(x, y, ie) {
    const [x0, x1, x2] = x;
    const [y0, y1, y2] = y;
    const xe = x[ie];
    return y0 * ((2 * xe - x1 - x2) / ((x0 - x1) * (x0 - x2)))
        + y1 * ((2 * xe - x0 - x2) / ((x1 - x0) * (x1 - x2)))
        + y2 * ((2 * xe - x0 - x1) / ((x2 - x0) * (x2 - x1)));
}

/**
 * Tasa de cambio en todos los nodos de una serie (no uniforme).
 * 'tres-puntos' (por defecto): central de 2.º orden adentro y unilateral de 2.º orden en los extremos
 * (con 2 puntos cae a la pendiente simple). 'simple': adelante en el primero, atrás en el último, central adentro.
 *
 * @param {number[]} xs
 * @param {number[]} ys
 * @param {{esquema?: 'tres-puntos'|'simple'}} [opciones]
 * @returns {number[]}
 */
export function derivadaSerie(xs, ys, opciones = {}) {
    validarNodos(xs, ys);
    const n = xs.length;
    const esquema = opciones.esquema ?? 'tres-puntos';
    if (esquema !== 'tres-puntos' && esquema !== 'simple') {
        throw new RangeError("El esquema debe ser 'tres-puntos' o 'simple'.");
    }
    if (n === 2) {
        const d = diferenciaAdelante(xs, ys, 0);
        return [d, d];
    }
    const salida = new Array(n);
    for (let i = 1; i < n - 1; i += 1) {
        salida[i] = diferenciaCentral(xs, ys, i);
    }
    if (esquema === 'simple') {
        salida[0] = diferenciaAdelante(xs, ys, 0);
        salida[n - 1] = diferenciaAtras(xs, ys, n - 1);
    } else {
        salida[0] = derivadaTresPuntos(xs.slice(0, 3), ys.slice(0, 3), 0);
        salida[n - 1] = derivadaTresPuntos(xs.slice(n - 3), ys.slice(n - 3), 2);
    }
    return salida;
}

/**
 * Derivada numérica de una función con paso h.
 * @param {(x: number) => number} f
 * @param {number} x
 * @param {{h?: number, esquema?: 'adelante'|'atras'|'central'}} [opciones]
 */
export function derivadaFuncion(f, x, opciones = {}) {
    validarFuncion(f);
    validarNumero(x, 'x');
    const h = opciones.h ?? 1e-5;
    const esquema = opciones.esquema ?? 'central';
    validarNumero(h, 'h');
    if (h <= 0) {
        throw new RangeError('El paso h debe ser positivo.');
    }
    if (esquema === 'adelante') {
        return (evaluarFinito(f, x + h) - evaluarFinito(f, x)) / h;
    }
    if (esquema === 'atras') {
        return (evaluarFinito(f, x) - evaluarFinito(f, x - h)) / h;
    }
    if (esquema === 'central') {
        return (evaluarFinito(f, x + h) - evaluarFinito(f, x - h)) / (2 * h);
    }
    throw new RangeError("El esquema debe ser 'adelante', 'atras' o 'central'.");
}
