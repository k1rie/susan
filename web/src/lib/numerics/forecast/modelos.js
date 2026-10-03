import { validarNumero, validarParejas } from '../common/validar.js';
import { eliminacionGaussiana } from '../linear-algebra/gauss.js';
import { ajustePolinomial } from '../regression/minimosCuadrados.js';
import { tCritico95 } from '../stats/descriptiva.js';

/**
 * @typedef {object} Candidato
 * @property {number} grado
 * @property {import('../regression/minimosCuadrados.js').AjustePolinomial} ajuste
 * @property {number} r2
 * @property {number|null} r2Ajustado
 * @property {number} aic
 * @property {number|null} errorEstandar
 * @property {number|null} errorLOO  RMSE de validación cruzada dejando uno fuera (null si no se puede calcular)
 */

/**
 * Error de validación cruzada leave-one-out (RMSE): se reajusta el modelo sin el punto i y se mide el error
 * al predecir ese punto. Penaliza el sobreajuste sin necesidad de un conjunto de prueba aparte.
 */
function errorLeaveOneOut(x, y, grado) {
    const n = x.length;
    if (n - 1 < grado + 1) {
        return null;
    }
    let ss = 0;
    for (let i = 0; i < n; i += 1) {
        const xs = x.filter((_, j) => j !== i);
        const ys = y.filter((_, j) => j !== i);
        try {
            const m = ajustePolinomial(xs, ys, grado);
            ss += (y[i] - m.predecir(x[i])) ** 2;
        } catch {
            return null;
        }
    }
    return Math.sqrt(ss / n);
}

/**
 * Ajusta un polinomio por grado candidato (por omisión lineal y cuadrático) y calcula sus métricas.
 * Omite los grados para los que no hay suficientes puntos.
 *
 * @param {number[]} x
 * @param {number[]} y
 * @param {{grados?: number[]}} [opciones]
 * @returns {Candidato[]}
 */
export function ajustarCandidatos(x, y, opciones = {}) {
    validarParejas(x, y, 2);
    const grados = opciones.grados ?? [1, 2];
    const salida = [];
    for (const grado of grados) {
        if (x.length < grado + 1) {
            continue;
        }
        const ajuste = ajustePolinomial(x, y, grado);
        salida.push({
            grado,
            ajuste,
            r2: ajuste.r2,
            r2Ajustado: ajuste.r2Ajustado,
            aic: ajuste.aic,
            errorEstandar: ajuste.errorEstandar,
            errorLOO: errorLeaveOneOut(x, y, grado),
        });
    }
    if (salida.length === 0) {
        throw new RangeError('No hay suficientes puntos para ajustar ningún modelo candidato.');
    }
    return salida;
}

/**
 * Elige el modelo por parsimonia + validación cruzada: se parte del de menor grado y se pasa a uno de mayor grado
 * solo si su error LOO es al menos `1 - margen` (2 % por omisión) menor y la mejora supera 1e-9.
 * Si no hay LOO calculable (muy pocos puntos) se queda con el de menor grado.
 *
 * @param {Candidato[]} candidatos
 * @param {{margen?: number}} [opciones]
 * @returns {{elegido: Candidato, razon: string}}
 */
export function elegirModelo(candidatos, opciones = {}) {
    const margen = opciones.margen ?? 0.98;
    let elegido = candidatos[0];
    for (const c of candidatos.slice(1)) {
        if (c.errorLOO !== null && elegido.errorLOO !== null
            && c.errorLOO < elegido.errorLOO * margen && elegido.errorLOO - c.errorLOO > 1e-9) {
            elegido = c;
        }
    }
    const razon = elegido.errorLOO === null
        ? `Se usa el modelo de grado ${elegido.grado} (pocos datos para validación cruzada).`
        : `Modelo de grado ${elegido.grado}: menor error de validación cruzada (RMSE LOO = ${elegido.errorLOO.toPrecision(4)}) con preferencia por el más simple.`;
    return { elegido, razon };
}

/**
 * Intervalo de predicción aproximado al 95 % para un punto x0:
 *   ŷ ± t·s·sqrt(1 + h0),  h0 = φ(x0)ᵀ (XᵀX)⁻¹ φ(x0)
 * donde φ es el vector de potencias de la variable escalada. Es aproximado (supone errores normales e independientes).
 *
 * @param {import('../regression/minimosCuadrados.js').AjustePolinomial} ajuste
 * @param {number} x0
 * @returns {{valor: number, inferior: number, superior: number, semiancho: number}}
 */
export function intervaloPrediccion(ajuste, x0) {
    validarNumero(x0, 'x0');
    const valor = ajuste.predecir(x0);
    const s = ajuste.errorEstandar;
    const gl = ajuste.n - ajuste.parametros;
    if (s === null || gl < 1 || s === 0) {
        return { valor, inferior: valor, superior: valor, semiancho: 0 };
    }
    const u = (x0 - ajuste.centro) / ajuste.escala;
    const phi = Array.from({ length: ajuste.parametros }, (_, k) => u ** k);
    const z = eliminacionGaussiana(ajuste.matrizNormal, phi).solucion;
    const h0 = phi.reduce((acc, v, k) => acc + v * z[k], 0);
    const semiancho = tCritico95(gl) * s * Math.sqrt(1 + Math.max(0, h0));
    return { valor, inferior: valor - semiancho, superior: valor + semiancho, semiancho };
}
