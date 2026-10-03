import { validarNumero, validarParejas } from '../common/validar.js';
import { validarNodosDistintos } from './lagrange.js';

/**
 * Diferencias divididas de Newton:
 *   f[xi..xi+k] = (f[xi+1..xi+k] - f[xi..xi+k-1]) / (x_{i+k} - x_i)
 *   P(x) = f[x0] + f[x0,x1](x-x0) + f[x0,x1,x2](x-x0)(x-x1) + ...
 *
 * @param {number[]} xs nodos distintos
 * @param {number[]} ys
 * @returns {{coeficientes: number[], tabla: number[][], evaluar: (x: number) => number, pasos: import('../common/validar.js').Paso[]}}
 *   `tabla[k][i]` = f[x_i..x_{i+k}] (columna k, fila i).
 */
export function newtonDiferenciasDivididas(xs, ys) {
    validarParejas(xs, ys, 2, ['xs', 'ys']);
    validarNodosDistintos(xs);
    const n = xs.length;
    const tabla = [ys.slice()];
    for (let k = 1; k < n; k += 1) {
        const previa = tabla[k - 1];
        const col = [];
        for (let i = 0; i < n - k; i += 1) {
            col.push((previa[i + 1] - previa[i]) / (xs[i + k] - xs[i]));
        }
        tabla.push(col);
    }
    const coeficientes = tabla.map((col) => col[0]);
    const evaluar = (x) => {
        validarNumero(x, 'x');
        // Esquema anidado (Horner generalizado): menos operaciones y más estable.
        let r = coeficientes[n - 1];
        for (let k = n - 2; k >= 0; k -= 1) {
            r = r * (x - xs[k]) + coeficientes[k];
        }
        return r;
    };
    const filas = xs.map((xi, i) => [xi, ...tabla.map((col) => (i < col.length ? col[i] : null))]);
    return {
        coeficientes,
        tabla,
        evaluar,
        pasos: [{
            titulo: 'Tabla de diferencias divididas de Newton',
            texto: 'Los coeficientes del polinomio son la primera fila de cada columna.',
            tabla: { columnas: ['x_i', 'f[x_i]', ...tabla.slice(1).map((_, k) => `orden ${k + 1}`)], filas },
            valores: coeficientes.map((c, k) => ({ etiqueta: `a${k}`, valor: c })),
        }],
    };
}
