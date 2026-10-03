import { validarNumero, validarParejas } from '../common/validar.js';
import { eliminacionGaussiana } from '../linear-algebra/gauss.js';
import { aic, errorEstandar, r2, r2Ajustado, residuos, sumaCuadradosResiduos } from './metricas.js';

/** @typedef {import('../common/validar.js').Paso} Paso */

/**
 * @typedef {object} AjusteLineal
 * @property {number} intercepto  a en y = a + b x
 * @property {number} pendiente   b
 * @property {number} r2
 * @property {number|null} r2Ajustado
 * @property {number|null} errorEstandar
 * @property {number} sse
 * @property {number} n
 * @property {number[]} ajustados
 * @property {number[]} residuos
 * @property {number[][]} matrizNormal
 * @property {number[]} terminosIndependientes
 * @property {(x: number) => number} predecir
 * @property {Paso[]} pasos
 */

/**
 * Mínimos cuadrados lineales con las ecuaciones normales escritas explícitamente:
 *   n·a  + Σx·b  = Σy
 *   Σx·a + Σx²·b = Σxy
 * resueltas con eliminación gaussiana con pivoteo.
 *
 * @param {number[]} x
 * @param {number[]} y
 * @returns {AjusteLineal}
 * @throws {RangeError} si hay menos de 2 puntos o todos los x son iguales
 */
export function ajusteLineal(x, y) {
    validarParejas(x, y, 2);
    const n = x.length;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < n; i += 1) {
        sx += x[i];
        sy += y[i];
        sxx += x[i] * x[i];
        sxy += x[i] * y[i];
    }
    const determinante = n * sxx - sx * sx;
    if (determinante <= 1e-12 * Math.max(n * sxx, 1e-300)) {
        throw new RangeError('Todos los valores de x son iguales (o casi): no se puede ajustar una recta.');
    }
    const matrizNormal = [[n, sx], [sx, sxx]];
    const terminosIndependientes = [sy, sxy];
    const gauss = eliminacionGaussiana(matrizNormal, terminosIndependientes);
    const [intercepto, pendiente] = gauss.solucion;
    const ajustados = x.map((v) => intercepto + pendiente * v);
    const sse = sumaCuadradosResiduos(y, ajustados);
    const r2v = r2(y, ajustados);
    /** @type {Paso[]} */
    const pasos = [
        {
            titulo: 'Sumas necesarias',
            valores: [
                { etiqueta: 'n', valor: n }, { etiqueta: 'Σx', valor: sx }, { etiqueta: 'Σy', valor: sy },
                { etiqueta: 'Σx²', valor: sxx }, { etiqueta: 'Σxy', valor: sxy },
            ],
        },
        {
            titulo: 'Ecuaciones normales',
            texto: 'n·a + Σx·b = Σy ;  Σx·a + Σx²·b = Σxy',
            matriz: matrizNormal.map((fila, i) => [...fila, terminosIndependientes[i]]),
        },
        ...gauss.pasos,
        {
            titulo: 'Resultado',
            texto: 'Recta ajustada y = a + b·x.',
            valores: [
                { etiqueta: 'a (intercepto)', valor: intercepto }, { etiqueta: 'b (pendiente)', valor: pendiente },
                { etiqueta: 'R²', valor: r2v }, { etiqueta: 'SSE', valor: sse },
            ],
        },
    ];
    return {
        intercepto,
        pendiente,
        r2: r2v,
        r2Ajustado: r2Ajustado(r2v, n, 1),
        errorEstandar: errorEstandar(sse, n, 2),
        sse,
        n,
        ajustados,
        residuos: residuos(y, ajustados),
        matrizNormal,
        terminosIndependientes,
        predecir: (xv) => intercepto + pendiente * xv,
        pasos,
    };
}

/**
 * @typedef {object} AjustePolinomial
 * @property {number} grado
 * @property {number[]} coeficientes  c0..cg en la variable escalada u = (x - centro)/escala
 * @property {number} centro
 * @property {number} escala
 * @property {number} n
 * @property {number} parametros
 * @property {number} r2
 * @property {number|null} r2Ajustado
 * @property {number|null} errorEstandar
 * @property {number} sse
 * @property {number} aic
 * @property {number[]} ajustados
 * @property {number[]} residuos
 * @property {number[][]} matrizNormal   (XᵀX) en la variable escalada
 * @property {number[]} terminosIndependientes
 * @property {(x: number) => number} predecir
 * @property {(x: number) => number} derivada  f'(x) en la variable original
 * @property {Paso[]} pasos
 */

/**
 * Regresión polinomial de grado g por ecuaciones normales (XᵀX c = Xᵀy) y Gauss.
 * La variable se centra y escala (u = (x - x̄)/máx|x - x̄|) para que XᵀX esté bien condicionada;
 * `predecir` y `derivada` reciben x original.
 *
 * @param {number[]} x
 * @param {number[]} y
 * @param {number} grado entero >= 0
 * @returns {AjustePolinomial}
 */
export function ajustePolinomial(x, y, grado) {
    validarNumero(grado, 'grado');
    if (!Number.isInteger(grado) || grado < 0 || grado > 10) {
        throw new RangeError('El grado debe ser un entero entre 0 y 10.');
    }
    validarParejas(x, y, grado + 1);
    const n = x.length;
    const p = grado + 1;
    const centro = x.reduce((s, v) => s + v, 0) / n;
    let escala = Math.max(...x.map((v) => Math.abs(v - centro)));
    if (escala === 0) {
        if (grado > 0) {
            throw new RangeError('Todos los valores de x son iguales: no se puede ajustar un polinomio de grado mayor que 0.');
        }
        escala = 1;
    }
    const u = x.map((v) => (v - centro) / escala);
    // Potencias de u: pot[k] = Σ u^k, para k = 0..2g, y Σ y·u^k.
    const pot = new Array(2 * grado + 1).fill(0);
    const sy = new Array(p).fill(0);
    for (let i = 0; i < n; i += 1) {
        let uk = 1;
        for (let k = 0; k <= 2 * grado; k += 1) {
            pot[k] += uk;
            if (k < p) {
                sy[k] += y[i] * uk;
            }
            uk *= u[i];
        }
    }
    const matrizNormal = Array.from({ length: p }, (_, j) => Array.from({ length: p }, (_, k) => pot[j + k]));
    const gauss = eliminacionGaussiana(matrizNormal, sy);
    const coeficientes = gauss.solucion;
    const evaluar = (uv) => coeficientes.reduceRight((acc, c) => acc * uv + c, 0);
    const predecir = (xv) => evaluar((xv - centro) / escala);
    const derivada = (xv) => {
        const uv = (xv - centro) / escala;
        let d = 0;
        for (let k = p - 1; k >= 1; k -= 1) {
            d = d * uv + k * coeficientes[k];
        }
        return d / escala;
    };
    const ajustados = x.map(predecir);
    const sse = sumaCuadradosResiduos(y, ajustados);
    const r2v = r2(y, ajustados);
    /** @type {Paso[]} */
    const pasos = [
        {
            titulo: `Regresión polinomial de grado ${grado}`,
            texto: `Se centra y escala x: u = (x - ${centro.toPrecision(6)}) / ${escala.toPrecision(6)} para mejorar la condición de XᵀX.`,
            valores: [{ etiqueta: 'n', valor: n }, { etiqueta: 'parámetros', valor: p }],
        },
        {
            titulo: 'Ecuaciones normales XᵀX c = Xᵀy [matriz | términos]',
            matriz: matrizNormal.map((fila, i) => [...fila, sy[i]]),
        },
        ...gauss.pasos,
        {
            titulo: 'Resultado',
            valores: [
                ...coeficientes.map((c, k) => ({ etiqueta: `c${k} (en u)`, valor: c })),
                { etiqueta: 'R²', valor: r2v },
                { etiqueta: 'SSE', valor: sse },
            ],
        },
    ];
    return {
        grado,
        coeficientes,
        centro,
        escala,
        n,
        parametros: p,
        r2: r2v,
        r2Ajustado: r2Ajustado(r2v, n, grado),
        errorEstandar: errorEstandar(sse, n, p),
        sse,
        aic: aic(n, sse, p),
        ajustados,
        residuos: residuos(y, ajustados),
        matrizNormal,
        terminosIndependientes: sy,
        predecir,
        derivada,
        pasos,
    };
}
