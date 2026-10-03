import { describe, expect, it } from 'vitest';
import {
    autocorrelacion, autocorrelaciones, cuantil, cuantiles, cusum, desviacion, ewmaControl,
    media, mediana, pearson, tCritico95, varianza, zScore,
} from './index.js';

describe('estadística descriptiva', () => {
    const y = [2, 4, 4, 4, 5, 5, 7, 9];

    it('media, varianza y desviación', () => {
        expect(media(y)).toBe(5);
        expect(varianza(y, { poblacional: true })).toBe(4);
        expect(desviacion(y, { poblacional: true })).toBe(2);
        expect(varianza(y)).toBeCloseTo(32 / 7, 12);
        expect(varianza([3])).toBe(0);
    });

    it('mediana y cuantiles (interpolación lineal)', () => {
        expect(mediana(y)).toBe(4.5);
        expect(mediana([3, 1, 2])).toBe(2);
        expect(cuantil([1, 2, 3, 4, 5], 0.25)).toBe(2);
        expect(cuantiles([1, 2, 3, 4, 5], [0, 1])).toEqual([1, 5]);
        expect(() => cuantil(y, 1.2)).toThrow(RangeError);
    });

    it('Pearson: correlación perfecta, inversa y serie constante', () => {
        expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12);
        expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 12);
        expect(pearson([1, 2, 3], [5, 5, 5])).toBe(0);
    });

    it('z-score tiene media 0 y desviación 1', () => {
        const z = zScore(y);
        expect(media(z)).toBeCloseTo(0, 12);
        expect(desviacion(z)).toBeCloseTo(1, 12);
        expect(zScore([3, 3, 3])).toEqual([0, 0, 0]);
    });

    it('autocorrelación: rezago 0 es 1; serie alternante es negativa', () => {
        expect(autocorrelacion([1, 2, 3, 4], 0)).toBeCloseTo(1, 12);
        expect(autocorrelacion([1, -1, 1, -1, 1, -1], 1)).toBeLessThan(-0.7);
        expect(autocorrelacion([2, 2, 2], 1)).toBe(0);
        expect(autocorrelaciones([1, 2, 3, 4, 5], 2).length).toBe(2);
        expect(() => autocorrelacion([1, 2], 5)).toThrow(RangeError);
    });

    it('valida entradas y valor t', () => {
        expect(() => media([])).toThrow(RangeError);
        expect(() => media('x')).toThrow(TypeError);
        expect(tCritico95(2)).toBe(4.303);
        expect(tCritico95(100)).toBe(1.96);
        expect(() => tCritico95(0)).toThrow(RangeError);
    });
});

describe('detección de cambios', () => {
    // Nivel ~0.05 con pequeña oscilación y salto a ~0.15 desde el índice 10.
    const ruido = [0.01, -0.01, 0.005, -0.005, 0.01, -0.01, 0.0, 0.005, -0.005, 0.0];
    const serie = [...ruido.map((r) => 0.05 + r), ...ruido.map((r) => 0.15 + r)];

    it('CUSUM detecta el salto sintético y lo ubica cerca de la semana de cambio', () => {
        const r = cusum(serie);
        expect(r.cambios.length).toBe(1);
        expect(r.cambios[0].direccion).toBe('alza');
        expect(r.cambios[0].inicio).toBeGreaterThanOrEqual(9);
        expect(r.cambios[0].inicio).toBeLessThanOrEqual(11);
        expect(r.cambios[0].indice).toBeGreaterThanOrEqual(10);
        expect(r.traza.length).toBe(serie.length);
    });

    it('CUSUM detecta una baja', () => {
        const r = cusum(serie.map((v) => 0.2 - v));
        expect(r.cambios[0].direccion).toBe('baja');
    });

    it('CUSUM no alarma en una serie estable ni en una constante', () => {
        expect(cusum(ruido.map((r) => 0.05 + r)).cambios).toEqual([]);
        expect(cusum([0.1, 0.1, 0.1, 0.1, 0.1]).cambios).toEqual([]);
    });

    it('EWMA alarma después del salto', () => {
        const r = ewmaControl(serie);
        expect(r.alarmas.length).toBeGreaterThan(0);
        expect(Math.min(...r.alarmas)).toBeGreaterThanOrEqual(10);
        expect(ewmaControl(ruido.map((x) => 0.05 + x)).alarmas).toEqual([]);
    });

    it('valida parámetros', () => {
        expect(() => cusum([1])).toThrow(RangeError);
        expect(() => cusum(serie, { hSigmas: 0 })).toThrow(RangeError);
        expect(() => ewmaControl(serie, { lambda: 0 })).toThrow(RangeError);
        expect(() => ewmaControl(serie, { L: -1 })).toThrow(RangeError);
    });
});
