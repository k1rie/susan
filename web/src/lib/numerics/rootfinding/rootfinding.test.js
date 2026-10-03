import { describe, expect, it } from 'vitest';
import { biseccion, falsaPosicion, newtonRaphson, secante } from './index.js';

const RAIZ_COS = 0.7390851332151607; // solución de cos(x) = x

describe('raíces', () => {
    it('Newton sobre x²-2 da 1.41421356 con derivada analítica o numérica', () => {
        const f = (x) => x * x - 2;
        const a = newtonRaphson(f, 1, { df: (x) => 2 * x });
        expect(a.raiz).toBeCloseTo(Math.SQRT2, 8);
        expect(a.convergio).toBe(true);
        expect(a.iteraciones).toBeLessThan(10);
        const n = newtonRaphson(f, 1);
        expect(n.raiz).toBeCloseTo(Math.SQRT2, 6);
        expect(a.traza[0]).toHaveProperty('fx');
        expect(Object.keys(a.traza[0])).toEqual(['iter', 'x', 'fx', 'error']);
    });

    it('bisección sobre cos(x) - x', () => {
        const r = biseccion((x) => Math.cos(x) - x, 0, 1, { tolerancia: 1e-10 });
        expect(r.raiz).toBeCloseTo(RAIZ_COS, 9);
        expect(r.convergio).toBe(true);
        // El error se reduce a la mitad en cada iteración.
        expect(r.traza[1].error).toBeCloseTo(r.traza[0].error / 2, 12);
    });

    it('falsa posición y secante convergen a la misma raíz', () => {
        const f = (x) => Math.cos(x) - x;
        expect(falsaPosicion(f, 0, 1).raiz).toBeCloseTo(RAIZ_COS, 8);
        expect(secante(f, 0, 1).raiz).toBeCloseTo(RAIZ_COS, 9);
    });

    it('Newton converge en menos iteraciones que la bisección', () => {
        const f = (x) => x * x - 2;
        expect(newtonRaphson(f, 1, { df: (x) => 2 * x }).iteraciones).toBeLessThan(biseccion(f, 0, 2).iteraciones);
    });

    it('reporta no convergencia con pocas iteraciones', () => {
        const r = biseccion((x) => x - 0.3, 0, 1, { maxIter: 3 });
        expect(r.convergio).toBe(false);
        expect(r.iteraciones).toBe(3);
    });

    it('raíz exacta en un extremo', () => {
        expect(biseccion((x) => x, 0, 1).raiz).toBe(0);
        expect(falsaPosicion((x) => x - 1, 0, 1).raiz).toBe(1);
    });

    it('lanza RangeError en español si no hay cambio de signo', () => {
        expect(() => biseccion((x) => x * x + 1, -1, 1)).toThrow(/no encierra una raíz/);
        expect(() => falsaPosicion((x) => x * x + 1, -1, 1)).toThrow(RangeError);
        expect(() => biseccion(Math.sin, 2, 1)).toThrow(RangeError);
    });

    it('lanza RangeError con derivada nula o secante horizontal', () => {
        expect(() => newtonRaphson((x) => x * x - 2, 0, { df: (x) => 2 * x })).toThrow(/derivada es cero/);
        expect(() => secante(() => 1, 0, 1)).toThrow(RangeError);
        expect(() => secante((x) => x, 1, 1)).toThrow(RangeError);
    });

    it('valida tipos y opciones', () => {
        expect(() => newtonRaphson('f', 1)).toThrow(TypeError);
        expect(() => newtonRaphson((x) => x, 'a')).toThrow(TypeError);
        expect(() => biseccion(Math.sin, 0, 1, { tolerancia: -1 })).toThrow(RangeError);
        expect(() => biseccion(Math.sin, 0, 1, { maxIter: 0 })).toThrow(RangeError);
    });
});
