import { evaluarFinito, validarFuncion, validarNumero } from '../common/validar.js';

/**
 * Extrapolación de Richardson sobre la diferencia central D(h) = (f(x+h) - f(x-h))/(2h), cuyo error es
 * O(h²) con solo potencias pares. Se reduce h a la mitad en cada fila y se eliminan los términos de error:
 *   R[i][j] = (4^j·R[i][j-1] - R[i-1][j-1]) / (4^j - 1)
 *
 * @param {(x: number) => number} f
 * @param {number} x
 * @param {{h?: number, niveles?: number}} [opciones]
 * @returns {{valor: number, error: number, tabla: number[][], h: number, niveles: number, pasos: import('../common/validar.js').Paso[]}}
 */
export function richardson(f, x, opciones = {}) {
    validarFuncion(f);
    validarNumero(x, 'x');
    const h = opciones.h ?? 0.5;
    const niveles = opciones.niveles ?? 5;
    validarNumero(h, 'h');
    if (h <= 0) {
        throw new RangeError('El paso inicial h debe ser positivo.');
    }
    if (!Number.isInteger(niveles) || niveles < 2 || niveles > 12) {
        throw new RangeError('Los niveles deben ser un entero entre 2 y 12.');
    }
    const tabla = [];
    for (let i = 0; i < niveles; i += 1) {
        const hi = h / 2 ** i;
        const fila = [(evaluarFinito(f, x + hi) - evaluarFinito(f, x - hi)) / (2 * hi)];
        for (let j = 1; j <= i; j += 1) {
            const c = 4 ** j;
            fila.push((c * fila[j - 1] - tabla[i - 1][j - 1]) / (c - 1));
        }
        tabla.push(fila);
    }
    const ult = niveles - 1;
    const valor = tabla[ult][ult];
    const error = Math.abs(valor - tabla[ult - 1][ult - 1]);
    return {
        valor,
        error,
        tabla,
        h,
        niveles,
        pasos: [{
            titulo: 'Tabla de Richardson para f\'(x)',
            texto: 'La columna 0 es la diferencia central con h/2^i; cada columna siguiente elimina un orden de error.',
            tabla: {
                columnas: ['h', ...tabla.map((_, j) => `R(j=${j})`)],
                filas: tabla.map((fila, i) => [h / 2 ** i, ...tabla.map((_, j) => (j < fila.length ? fila[j] : null))]),
            },
            valores: [{ etiqueta: 'f\'(x)', valor }, { etiqueta: 'error estimado', valor: error }],
        }],
    };
}
