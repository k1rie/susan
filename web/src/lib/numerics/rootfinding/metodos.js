import { evaluarFinito, validarFuncion, validarNumero } from '../common/validar.js';
import { derivadaFuncion } from '../differentiation/diferencias.js';

/**
 * @typedef {object} ResultadoRaiz
 * @property {number} raiz
 * @property {number} iteraciones
 * @property {boolean} convergio
 * @property {number} error  último error absoluto estimado
 * @property {{iter: number, x: number, fx: number, error: number}[]} traza
 */

function opcionesComunes(opciones = {}) {
    const tolerancia = opciones.tolerancia ?? 1e-10;
    const maxIter = opciones.maxIter ?? 100;
    validarNumero(tolerancia, 'tolerancia');
    if (tolerancia <= 0) {
        throw new RangeError('La tolerancia debe ser positiva.');
    }
    if (!Number.isInteger(maxIter) || maxIter < 1) {
        throw new RangeError('maxIter debe ser un entero >= 1.');
    }
    return { tolerancia, maxIter };
}

function validarCorchete(f, a, b) {
    validarFuncion(f);
    validarNumero(a, 'a');
    validarNumero(b, 'b');
    if (!(a < b)) {
        throw new RangeError('Se requiere a < b.');
    }
    const fa = evaluarFinito(f, a);
    const fb = evaluarFinito(f, b);
    if (fa * fb > 0) {
        throw new RangeError(`El intervalo [${a}, ${b}] no encierra una raíz: f(a) y f(b) deben tener signos opuestos.`);
    }
    return { fa, fb };
}

/**
 * Bisección: se parte [a, b] por la mitad y se conserva el subintervalo donde f cambia de signo.
 * Error = semiancho del intervalo; convergencia lineal garantizada (1 bit por iteración).
 *
 * @param {(x: number) => number} f
 * @param {number} a
 * @param {number} b
 * @param {{tolerancia?: number, maxIter?: number}} [opciones]
 * @returns {ResultadoRaiz}
 * @throws {RangeError} si f(a) y f(b) tienen el mismo signo
 */
export function biseccion(f, a, b, opciones) {
    const { tolerancia, maxIter } = opcionesComunes(opciones);
    let { fa, fb } = validarCorchete(f, a, b);
    const traza = [];
    if (fa === 0 || fb === 0) {
        const raiz = fa === 0 ? a : b;
        traza.push({ iter: 0, x: raiz, fx: 0, error: 0 });
        return { raiz, iteraciones: 0, convergio: true, error: 0, traza };
    }
    let lo = a;
    let hi = b;
    let x = a;
    let error = Infinity;
    for (let k = 1; k <= maxIter; k += 1) {
        x = (lo + hi) / 2;
        const fx = evaluarFinito(f, x);
        error = (hi - lo) / 2;
        traza.push({ iter: k, x, fx, error });
        if (fx === 0 || error < tolerancia) {
            return { raiz: x, iteraciones: k, convergio: true, error, traza };
        }
        if (fa * fx < 0) {
            hi = x;
            fb = fx;
        } else {
            lo = x;
            fa = fx;
        }
    }
    return { raiz: x, iteraciones: maxIter, convergio: false, error, traza };
}

/**
 * Falsa posición (regula falsi): la raíz de la secante entre (a, f(a)) y (b, f(b)) reemplaza al extremo
 * del mismo signo. Mantiene el corchete; error = |x_k - x_{k-1}|.
 *
 * @param {(x: number) => number} f
 * @param {number} a
 * @param {number} b
 * @param {{tolerancia?: number, maxIter?: number}} [opciones]
 * @returns {ResultadoRaiz}
 */
export function falsaPosicion(f, a, b, opciones) {
    const { tolerancia, maxIter } = opcionesComunes(opciones);
    let { fa, fb } = validarCorchete(f, a, b);
    const traza = [];
    if (fa === 0 || fb === 0) {
        const raiz = fa === 0 ? a : b;
        traza.push({ iter: 0, x: raiz, fx: 0, error: 0 });
        return { raiz, iteraciones: 0, convergio: true, error: 0, traza };
    }
    let lo = a;
    let hi = b;
    let previo = a;
    let x = a;
    let error = Infinity;
    for (let k = 1; k <= maxIter; k += 1) {
        x = (lo * fb - hi * fa) / (fb - fa);
        const fx = evaluarFinito(f, x);
        error = k === 1 ? Math.abs(hi - lo) : Math.abs(x - previo);
        traza.push({ iter: k, x, fx, error });
        if (fx === 0 || (k > 1 && error < tolerancia) || Math.abs(fx) < tolerancia * 1e-3) {
            return { raiz: x, iteraciones: k, convergio: true, error, traza };
        }
        previo = x;
        if (fa * fx < 0) {
            hi = x;
            fb = fx;
        } else {
            lo = x;
            fa = fx;
        }
    }
    return { raiz: x, iteraciones: maxIter, convergio: false, error, traza };
}

/**
 * Método de la secante: x_{k+1} = x_k - f(x_k)(x_k - x_{k-1})/(f(x_k) - f(x_{k-1})). No exige corchete ni derivada;
 * orden de convergencia ≈ 1.618.
 *
 * @param {(x: number) => number} f
 * @param {number} x0
 * @param {number} x1
 * @param {{tolerancia?: number, maxIter?: number}} [opciones]
 * @returns {ResultadoRaiz}
 * @throws {RangeError} si f(x_k) = f(x_{k-1}) (división entre cero)
 */
export function secante(f, x0, x1, opciones) {
    const { tolerancia, maxIter } = opcionesComunes(opciones);
    validarFuncion(f);
    validarNumero(x0, 'x0');
    validarNumero(x1, 'x1');
    if (x0 === x1) {
        throw new RangeError('Los dos puntos iniciales deben ser distintos.');
    }
    let xa = x0;
    let xb = x1;
    let fa = evaluarFinito(f, xa);
    let fb = evaluarFinito(f, xb);
    const traza = [];
    let error = Infinity;
    for (let k = 1; k <= maxIter; k += 1) {
        if (fb === fa) {
            throw new RangeError('La secante es horizontal (f(x_k) = f(x_{k-1})): no se puede continuar. Cambie los puntos iniciales.');
        }
        const x = xb - (fb * (xb - xa)) / (fb - fa);
        const fx = evaluarFinito(f, x);
        error = Math.abs(x - xb);
        traza.push({ iter: k, x, fx, error });
        xa = xb;
        fa = fb;
        xb = x;
        fb = fx;
        if (fx === 0 || error < tolerancia) {
            return { raiz: x, iteraciones: k, convergio: true, error, traza };
        }
    }
    return { raiz: xb, iteraciones: maxIter, convergio: false, error, traza };
}

/**
 * Newton-Raphson: x_{k+1} = x_k - f(x_k)/f'(x_k). Convergencia cuadrática cerca de una raíz simple.
 * La derivada es analítica (`opciones.df`) o, si no se da, central numérica con paso `opciones.h`.
 *
 * @param {(x: number) => number} f
 * @param {number} x0
 * @param {{df?: (x: number) => number, h?: number, tolerancia?: number, maxIter?: number}} [opciones]
 * @returns {ResultadoRaiz}
 * @throws {RangeError} si la derivada se anula
 */
export function newtonRaphson(f, x0, opciones = {}) {
    const { tolerancia, maxIter } = opcionesComunes(opciones);
    validarFuncion(f);
    validarNumero(x0, 'x0');
    if (opciones.df !== undefined) {
        validarFuncion(opciones.df, 'df');
    }
    const derivada = opciones.df ?? ((x) => derivadaFuncion(f, x, { h: opciones.h ?? 1e-6 }));
    let x = x0;
    const traza = [];
    let error = Infinity;
    for (let k = 1; k <= maxIter; k += 1) {
        const fx = evaluarFinito(f, x);
        const dfx = evaluarFinito(derivada, x);
        if (Math.abs(dfx) < 1e-14) {
            throw new RangeError(`La derivada es cero (o casi) en x = ${x}: Newton-Raphson no puede continuar. Pruebe otro punto inicial.`);
        }
        const siguiente = x - fx / dfx;
        error = Math.abs(siguiente - x);
        x = siguiente;
        traza.push({ iter: k, x, fx: evaluarFinito(f, x), error });
        if (error < tolerancia) {
            return { raiz: x, iteraciones: k, convergio: true, error, traza };
        }
    }
    return { raiz: x, iteraciones: maxIter, convergio: false, error, traza };
}
