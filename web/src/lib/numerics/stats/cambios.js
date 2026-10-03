import { validarNumero, validarVector } from '../common/validar.js';
import { desviacion, media } from './descriptiva.js';

/**
 * Línea base (media y sigma) estimada con el primer tercio de la serie (mín. 3 datos, o todos si hay menos).
 * Si la base es constante se usa la desviación de toda la serie; si ésta también es 0 no hay variación que detectar.
 */
function lineaBase(y, opciones) {
    const nBase = Math.min(y.length, Math.max(3, Math.floor(y.length / 3)));
    const base = y.slice(0, nBase);
    const objetivo = opciones.objetivo ?? media(base);
    let sigma = opciones.sigma ?? desviacion(base);
    if (!(sigma > 0)) {
        sigma = desviacion(y);
    }
    return { objetivo, sigma, nBase };
}

/**
 * CUSUM tabular bilateral:
 *   S+_t = max(0, S+_{t-1} + (y_t - μ0) - k),   S-_t = max(0, S-_{t-1} - (y_t - μ0) - k)
 * con k = kSigmas·σ y alarma cuando S± > h = hSigmas·σ. El inicio estimado del cambio es el último instante
 * en que la suma valía 0.
 *
 * @param {number[]} y
 * @param {{objetivo?: number, sigma?: number, kSigmas?: number, hSigmas?: number}} [opciones]
 * @returns {{objetivo: number, sigma: number, k: number, h: number,
 *   cambios: {indice: number, inicio: number, direccion: 'alza'|'baja'}[],
 *   traza: {iter: number, x: number, fx: number, error: number, sPos: number, sNeg: number}[]}}
 *   En `traza`, x = y_t, fx = S+ y error = S- (columnas homogéneas con las demás trazas).
 */
export function cusum(y, opciones = {}) {
    validarVector(y, 'y', 2);
    const kSigmas = opciones.kSigmas ?? 0.5;
    const hSigmas = opciones.hSigmas ?? 4;
    validarNumero(kSigmas, 'kSigmas');
    validarNumero(hSigmas, 'hSigmas');
    if (kSigmas < 0 || hSigmas <= 0) {
        throw new RangeError('kSigmas debe ser >= 0 y hSigmas > 0.');
    }
    const lb = lineaBase(y, opciones);
    const { sigma } = lb;
    const { objetivo } = lb;
    const k = kSigmas * sigma;
    const h = hSigmas * sigma;
    const cambios = [];
    const traza = [];
    if (!(sigma > 0)) {
        // Serie sin variación: nada que detectar.
        y.forEach((v, t) => traza.push({ iter: t, x: v, fx: 0, error: 0, sPos: 0, sNeg: 0 }));
        return { objetivo, sigma, k, h, cambios, traza };
    }
    let sPos = 0;
    let sNeg = 0;
    let inicioPos = 0;
    let inicioNeg = 0;
    // Tras una alarma la suma sigue acumulando (el nivel nuevo persiste) pero esa dirección no vuelve a
    // alarmar hasta que su suma regrese a 0; así un solo salto produce una sola alarma.
    let bloqueoPos = false;
    let bloqueoNeg = false;
    for (let t = 0; t < y.length; t += 1) {
        const d = y[t] - objetivo;
        if (sPos === 0) {
            inicioPos = t;
            bloqueoPos = false;
        }
        if (sNeg === 0) {
            inicioNeg = t;
            bloqueoNeg = false;
        }
        sPos = Math.max(0, sPos + d - k);
        sNeg = Math.max(0, sNeg - d - k);
        traza.push({ iter: t, x: y[t], fx: sPos, error: sNeg, sPos, sNeg });
        if (sPos > h && !bloqueoPos) {
            cambios.push({ indice: t, inicio: inicioPos, direccion: 'alza' });
            bloqueoPos = true;
        }
        if (sNeg > h && !bloqueoNeg) {
            cambios.push({ indice: t, inicio: inicioNeg, direccion: 'baja' });
            bloqueoNeg = true;
        }
    }
    return { objetivo, sigma, k, h, cambios, traza };
}

/**
 * Carta EWMA: z_t = λ·y_t + (1-λ)·z_{t-1}, z_0 = μ0. Límites de control
 *   μ0 ± L·σ·sqrt( λ/(2-λ)·(1-(1-λ)^{2t}) ). Es más sensible que CUSUM a cambios pequeños y sostenidos.
 *
 * @param {number[]} y
 * @param {{objetivo?: number, sigma?: number, lambda?: number, L?: number}} [opciones]
 * @returns {{objetivo: number, sigma: number, lambda: number, L: number, alarmas: number[],
 *   traza: {iter: number, x: number, fx: number, error: number, limiteInferior: number, limiteSuperior: number}[]}}
 *   En `traza`, x = y_t, fx = z_t y error = |z_t - μ0|.
 */
export function ewmaControl(y, opciones = {}) {
    validarVector(y, 'y', 2);
    const lambda = opciones.lambda ?? 0.3;
    const L = opciones.L ?? 3;
    validarNumero(lambda, 'lambda');
    validarNumero(L, 'L');
    if (lambda <= 0 || lambda > 1) {
        throw new RangeError('lambda debe estar en el intervalo (0, 1].');
    }
    if (L <= 0) {
        throw new RangeError('L debe ser positivo.');
    }
    const { objetivo, sigma } = lineaBase(y, opciones);
    let z = objetivo;
    const traza = [];
    const alarmas = [];
    for (let t = 0; t < y.length; t += 1) {
        z = lambda * y[t] + (1 - lambda) * z;
        const ancho = L * sigma * Math.sqrt((lambda / (2 - lambda)) * (1 - (1 - lambda) ** (2 * (t + 1))));
        traza.push({ iter: t, x: y[t], fx: z, error: Math.abs(z - objetivo), limiteInferior: objetivo - ancho, limiteSuperior: objetivo + ancho });
        if (sigma > 0 && (z > objetivo + ancho || z < objetivo - ancho)) {
            alarmas.push(t);
        }
    }
    return { objetivo, sigma, lambda, L, alarmas, traza };
}
