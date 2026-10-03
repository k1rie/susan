import { describe, expect, it } from 'vitest';
import { alfaDesdeVentana, ema, sma, tablaSuavizado, wma } from './index.js';

describe('suavizado', () => {
    const y = [1, 2, 3, 4, 5];

    it('SMA: promedio de la ventana y null al inicio', () => {
        expect(sma(y, 3)).toEqual([null, null, 2, 3, 4]);
    });

    it('WMA: pesos lineales 1..n', () => {
        const w = wma(y, 3);
        expect(w[2]).toBeCloseTo((1 * 1 + 2 * 2 + 3 * 3) / 6, 12);
        expect(w[4]).toBeCloseTo((3 + 8 + 15) / 6, 12);
    });

    it('EMA: recurrencia y casos límite de alfa', () => {
        const e = ema(y, 0.5);
        expect(e[0]).toBe(1);
        expect(e[1]).toBeCloseTo(1.5, 12);
        expect(e[2]).toBeCloseTo(2.25, 12);
        expect(ema(y, 1)).toEqual(y);
        expect(alfaDesdeVentana(3)).toBe(0.5);
        expect(() => ema(y, 0)).toThrow(RangeError);
        expect(() => ema(y, 1.5)).toThrow(RangeError);
    });

    it('tolera huecos (null)', () => {
        expect(sma([1, null, 3, 4], 2)).toEqual([null, null, null, 3.5]);
        expect(ema([1, null, 3], 0.5)).toEqual([1, null, 2]);
    });

    it('suavizar una constante la deja igual', () => {
        expect(sma([2, 2, 2, 2], 2).slice(1)).toEqual([2, 2, 2]);
    });

    it('valida la ventana y la serie', () => {
        expect(() => sma(y, 0)).toThrow(RangeError);
        expect(() => sma(y, 1.5)).toThrow(RangeError);
        expect(() => sma('x', 2)).toThrow(TypeError);
        expect(() => sma([1, 'a'], 2)).toThrow(RangeError);
    });

    it('arma la tabla didáctica', () => {
        const t = tablaSuavizado(y, [1, 2, 3, 4, 5], { ventana: 3 });
        expect(t.tabla.columnas.length).toBe(5);
        expect(t.tabla.filas.length).toBe(5);
    });
});
