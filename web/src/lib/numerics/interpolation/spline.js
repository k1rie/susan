import { validarNumero, validarParejas } from '../common/validar.js';

/**
 * Spline cúbico natural (S'' = 0 en los extremos). Los momentos M_i = S''(x_i) salen de un sistema
 * tridiagonal que se resuelve con el algoritmo de Thomas:
 *   h_{i-1} M_{i-1} + 2(h_{i-1}+h_i) M_i + h_i M_{i+1} = 6[(y_{i+1}-y_i)/h_i - (y_i-y_{i-1})/h_{i-1}]
 *
 * @param {number[]} xs nodos estrictamente crecientes (>= 2)
 * @param {number[]} ys
 * @returns {{momentos: number[], segmentos: {x0: number, x1: number, a: number, b: number, c: number, d: number}[],
 *   sistema: {inferior: number[], diagonal: number[], superior: number[], derecha: number[]},
 *   evaluar: (x: number, opciones?: {extrapolar?: boolean}) => number,
 *   derivada: (x: number) => number, pasos: import('../common/validar.js').Paso[]}}
 */
export function splineCubicoNatural(xs, ys) {
    validarParejas(xs, ys, 2, ['xs', 'ys']);
    const n = xs.length;
    for (let i = 1; i < n; i += 1) {
        if (!(xs[i] > xs[i - 1])) {
            throw new RangeError('Los nodos x deben ser estrictamente crecientes.');
        }
    }
    const h = [];
    for (let i = 0; i < n - 1; i += 1) {
        h.push(xs[i + 1] - xs[i]);
    }
    const m = n - 2; // incógnitas interiores
    const sistema = { inferior: [], diagonal: [], superior: [], derecha: [] };
    for (let i = 1; i <= m; i += 1) {
        sistema.inferior.push(i === 1 ? 0 : h[i - 1]);
        sistema.diagonal.push(2 * (h[i - 1] + h[i]));
        sistema.superior.push(i === m ? 0 : h[i]);
        sistema.derecha.push(6 * ((ys[i + 1] - ys[i]) / h[i] - (ys[i] - ys[i - 1]) / h[i - 1]));
    }
    const momentos = new Array(n).fill(0);
    if (m > 0) {
        // Algoritmo de Thomas: eliminación hacia adelante y sustitución regresiva en O(n).
        const c = new Array(m).fill(0);
        const d = new Array(m).fill(0);
        c[0] = sistema.superior[0] / sistema.diagonal[0];
        d[0] = sistema.derecha[0] / sistema.diagonal[0];
        for (let i = 1; i < m; i += 1) {
            const den = sistema.diagonal[i] - sistema.inferior[i] * c[i - 1];
            c[i] = sistema.superior[i] / den;
            d[i] = (sistema.derecha[i] - sistema.inferior[i] * d[i - 1]) / den;
        }
        const sol = new Array(m).fill(0);
        sol[m - 1] = d[m - 1];
        for (let i = m - 2; i >= 0; i -= 1) {
            sol[i] = d[i] - c[i] * sol[i + 1];
        }
        for (let i = 0; i < m; i += 1) {
            momentos[i + 1] = sol[i];
        }
    }
    const segmentos = [];
    for (let i = 0; i < n - 1; i += 1) {
        segmentos.push({
            x0: xs[i],
            x1: xs[i + 1],
            a: ys[i],
            b: (ys[i + 1] - ys[i]) / h[i] - (h[i] * (2 * momentos[i] + momentos[i + 1])) / 6,
            c: momentos[i] / 2,
            d: (momentos[i + 1] - momentos[i]) / (6 * h[i]),
        });
    }
    const buscar = (x) => {
        let lo = 0;
        let hi = segmentos.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (x >= segmentos[mid].x0) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        return segmentos[lo];
    };
    const evaluar = (x, opciones = {}) => {
        validarNumero(x, 'x');
        if (!opciones.extrapolar && (x < xs[0] || x > xs[n - 1])) {
            throw new RangeError(`x = ${x} está fuera del rango de interpolación [${xs[0]}, ${xs[n - 1]}].`);
        }
        const s = buscar(x);
        const t = x - s.x0;
        return s.a + t * (s.b + t * (s.c + t * s.d));
    };
    const derivada = (x) => {
        validarNumero(x, 'x');
        const s = buscar(x);
        const t = x - s.x0;
        return s.b + t * (2 * s.c + 3 * t * s.d);
    };
    return {
        momentos,
        segmentos,
        sistema,
        evaluar,
        derivada,
        pasos: [
            {
                titulo: 'Sistema tridiagonal para los momentos M_i = S\'\'(x_i)',
                texto: 'Con M_0 = M_n = 0 (spline natural).',
                tabla: {
                    columnas: ['fila', 'inferior', 'diagonal', 'superior', 'lado derecho'],
                    filas: sistema.diagonal.map((dg, i) => [i + 1, sistema.inferior[i], dg, sistema.superior[i], sistema.derecha[i]]),
                },
            },
            {
                titulo: 'Coeficientes por tramo: S(x) = a + b·t + c·t² + d·t³, t = x - x_i',
                tabla: {
                    columnas: ['tramo', 'x_i', 'x_i+1', 'a', 'b', 'c', 'd'],
                    filas: segmentos.map((s, i) => [i, s.x0, s.x1, s.a, s.b, s.c, s.d]),
                },
            },
        ],
    };
}
