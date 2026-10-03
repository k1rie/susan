import { describe, expect, it } from 'vitest';
import { romberg, simpson13, simpson38, simpsonDatos, trapecioCompuesto, trapecioDatos } from './index.js';

describe('cuadratura compuesta', () => {
    it('Simpson 1/3 de sin en [0, π] es 2', () => {
        expect(simpson13(Math.sin, 0, Math.PI, 20).valor).toBeCloseTo(2, 4);
    });

    it('Simpson 3/8 de sin en [0, π] es 2', () => {
        expect(simpson38(Math.sin, 0, Math.PI, 30).valor).toBeCloseTo(2, 4);
    });

    it('el trapecio converge más lento que Simpson', () => {
        const t = Math.abs(trapecioCompuesto(Math.sin, 0, Math.PI, 20).valor - 2);
        const s = Math.abs(simpson13(Math.sin, 0, Math.PI, 20).valor - 2);
        expect(t).toBeGreaterThan(s);
        expect(t).toBeLessThan(1e-2);
    });

    it('Simpson es exacto para cúbicas; el trapecio para rectas', () => {
        expect(simpson13((x) => x ** 3, 0, 2, 2).valor).toBeCloseTo(4, 12);
        expect(simpson38((x) => x ** 3, 0, 2, 3).valor).toBeCloseTo(4, 12);
        expect(trapecioCompuesto((x) => 2 * x + 1, 0, 3, 1).valor).toBeCloseTo(12, 12);
    });

    it('valida n, intervalo y paridad', () => {
        expect(() => simpson13(Math.sin, 0, 1, 3)).toThrow(RangeError);
        expect(() => simpson38(Math.sin, 0, 1, 4)).toThrow(RangeError);
        expect(() => trapecioCompuesto(Math.sin, 1, 0, 4)).toThrow(RangeError);
        expect(() => trapecioCompuesto(Math.sin, 0, 1, 0)).toThrow(RangeError);
        expect(() => trapecioCompuesto('f', 0, 1, 2)).toThrow(TypeError);
        expect(() => trapecioCompuesto(() => Infinity, 0, 1, 2)).toThrow(RangeError);
    });
});

describe('datos tabulados', () => {
    it('trapecio acumulado con nodos no uniformes', () => {
        const r = trapecioDatos([0, 1, 3], [0, 2, 2]);
        expect(r.acumulado).toEqual([0, 1, 5]);
        expect(r.valor).toBe(5);
    });

    it('Simpson sobre datos de x²', () => {
        const ys = [0, 1, 4, 9, 16];
        expect(simpsonDatos(ys, 1).valor).toBeCloseTo(64 / 3, 10);
        expect(() => simpsonDatos([0, 1, 4, 9], 1)).toThrow(RangeError);
    });
});

describe('Romberg', () => {
    it('integra sin en [0, π] con tabla triangular', () => {
        const r = romberg(Math.sin, 0, Math.PI);
        expect(r.valor).toBeCloseTo(2, 9);
        expect(r.convergio).toBe(true);
        expect(r.tabla.map((f) => f.length)).toEqual(r.tabla.map((_, i) => i + 1));
    });

    it('integra exp en [0, 1]', () => {
        expect(romberg(Math.exp, 0, 1).valor).toBeCloseTo(Math.E - 1, 9);
    });

    it('valida parámetros', () => {
        expect(() => romberg(Math.sin, 1, 0)).toThrow(RangeError);
        expect(() => romberg(Math.sin, 0, 1, { niveles: 1 })).toThrow(RangeError);
    });
});
