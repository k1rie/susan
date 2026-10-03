import { validarNumero } from '../common/validar.js';

const esValor = (v) => typeof v === 'number' && Number.isFinite(v);

function validarSerie(y) {
    if (!Array.isArray(y)) {
        throw new TypeError('y debe ser un arreglo (se admiten null en los huecos).');
    }
    y.forEach((v, i) => {
        if (v !== null && v !== undefined && !esValor(v)) {
            throw new RangeError(`y[${i}] debe ser un número finito o null.`);
        }
    });
}

function validarVentana(ventana) {
    validarNumero(ventana, 'ventana');
    if (!Number.isInteger(ventana) || ventana < 1) {
        throw new RangeError('La ventana debe ser un entero >= 1.');
    }
}

/**
 * Media móvil simple: promedio de las últimas `ventana` observaciones.
 * Devuelve null mientras no haya ventana completa o si la ventana contiene un hueco (null).
 *
 * @param {(number|null)[]} y
 * @param {number} ventana
 * @returns {(number|null)[]}
 */
export function sma(y, ventana) {
    validarSerie(y);
    validarVentana(ventana);
    return y.map((_, i) => {
        if (i < ventana - 1) {
            return null;
        }
        let s = 0;
        for (let j = i - ventana + 1; j <= i; j += 1) {
            if (!esValor(y[j])) {
                return null;
            }
            s += y[j];
        }
        return s / ventana;
    });
}

/**
 * Media móvil ponderada lineal: pesos 1..ventana (el dato más reciente pesa más).
 * WMA_t = Σ k·y_{t-ventana+k} / Σ k.
 *
 * @param {(number|null)[]} y
 * @param {number} ventana
 * @returns {(number|null)[]}
 */
export function wma(y, ventana) {
    validarSerie(y);
    validarVentana(ventana);
    const suma = (ventana * (ventana + 1)) / 2;
    return y.map((_, i) => {
        if (i < ventana - 1) {
            return null;
        }
        let s = 0;
        for (let k = 1; k <= ventana; k += 1) {
            const v = y[i - ventana + k];
            if (!esValor(v)) {
                return null;
            }
            s += k * v;
        }
        return s / suma;
    });
}

/**
 * Factor de suavizado equivalente a una ventana: α = 2/(n+1).
 * @param {number} ventana
 */
export function alfaDesdeVentana(ventana) {
    validarVentana(ventana);
    return 2 / (ventana + 1);
}

/**
 * Media móvil exponencial: S_t = α·y_t + (1-α)·S_{t-1}, con S_0 = primer dato válido.
 * Un hueco (null) deja la salida en null pero conserva el estado previo.
 *
 * @param {(number|null)[]} y
 * @param {number} alfa en (0, 1]
 * @returns {(number|null)[]}
 */
export function ema(y, alfa) {
    validarSerie(y);
    validarNumero(alfa, 'alfa');
    if (alfa <= 0 || alfa > 1) {
        throw new RangeError('alfa debe estar en el intervalo (0, 1].');
    }
    let s = null;
    return y.map((v) => {
        if (!esValor(v)) {
            return null;
        }
        s = s === null ? v : alfa * v + (1 - alfa) * s;
        return s;
    });
}

/**
 * Tabla didáctica t, y, SMA, EMA, WMA.
 *
 * @param {(number|null)[]} y
 * @param {number[]} t
 * @param {{ventana?: number, alfa?: number}} [opciones]
 */
export function tablaSuavizado(y, t, opciones = {}) {
    const ventana = opciones.ventana ?? 3;
    const alfa = opciones.alfa ?? alfaDesdeVentana(ventana);
    const a = sma(y, ventana);
    const b = ema(y, alfa);
    const c = wma(y, ventana);
    return {
        ventana,
        alfa,
        sma: a,
        ema: b,
        wma: c,
        tabla: {
            columnas: ['t', 'y', `SMA(${ventana})`, `EMA(α=${alfa.toFixed(3)})`, `WMA(${ventana})`],
            filas: y.map((v, i) => [t[i], v ?? null, a[i], b[i], c[i]]),
        },
    };
}
