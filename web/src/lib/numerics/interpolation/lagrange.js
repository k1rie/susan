import { validarNumero, validarParejas } from '../common/validar.js';

/** Exige abscisas distintas entre sí. */
export function validarNodosDistintos(xs) {
    const vistos = new Set();
    for (const v of xs) {
        if (vistos.has(v)) {
            throw new RangeError(`Los nodos x deben ser distintos; se repite ${v}.`);
        }
        vistos.add(v);
    }
}

/**
 * Interpolación de Lagrange: P(x) = Σ y_i · L_i(x), L_i(x) = Π_{j≠i} (x - x_j)/(x_i - x_j).
 *
 * @param {number[]} xs nodos distintos
 * @param {number[]} ys valores en los nodos
 * @param {number} x punto a evaluar
 * @returns {{valor: number, terminos: {i: number, base: number, aporte: number}[], pasos: import('../common/validar.js').Paso[]}}
 */
export function lagrange(xs, ys, x) {
    validarParejas(xs, ys, 2, ['xs', 'ys']);
    validarNodosDistintos(xs);
    validarNumero(x, 'x');
    const terminos = xs.map((xi, i) => {
        let base = 1;
        for (let j = 0; j < xs.length; j += 1) {
            if (j !== i) {
                base *= (x - xs[j]) / (xi - xs[j]);
            }
        }
        return { i, base, aporte: ys[i] * base };
    });
    const valor = terminos.reduce((s, t) => s + t.aporte, 0);
    return {
        valor,
        terminos,
        pasos: [{
            titulo: `Polinomio de Lagrange de grado ${xs.length - 1} evaluado en x = ${x}`,
            texto: 'P(x) = Σ y_i·L_i(x).',
            tabla: {
                columnas: ['i', 'x_i', 'y_i', 'L_i(x)', 'y_i·L_i(x)'],
                filas: terminos.map((t) => [t.i, xs[t.i], ys[t.i], t.base, t.aporte]),
            },
            valores: [{ etiqueta: 'P(x)', valor }],
        }],
    };
}
