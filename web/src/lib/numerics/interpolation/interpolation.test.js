import { describe, expect, it } from 'vitest';
import { lagrange, newtonDiferenciasDivididas, rellenarHuecos, splineCubicoNatural } from './index.js';

const xs = [0, 1, 2, 4];
const ys = [1, 3, 2, 7];

describe('Lagrange y Newton', () => {
    it('dan el mismo polinomio', () => {
        const nw = newtonDiferenciasDivididas(xs, ys);
        for (const x of [0, 0.5, 1.7, 3, 4, 5]) {
            expect(nw.evaluar(x)).toBeCloseTo(lagrange(xs, ys, x).valor, 9);
        }
    });

    it('reproducen los nudos y un polinomio cúbico exacto', () => {
        xs.forEach((x, i) => expect(lagrange(xs, ys, x).valor).toBeCloseTo(ys[i], 12));
        const f = (x) => x ** 3 - 2 * x + 1;
        const px = [-1, 0, 1, 2];
        expect(newtonDiferenciasDivididas(px, px.map(f)).evaluar(1.5)).toBeCloseTo(f(1.5), 10);
    });

    it('la tabla de Newton tiene la forma triangular esperada', () => {
        const { tabla, coeficientes } = newtonDiferenciasDivididas(xs, ys);
        expect(tabla.map((c) => c.length)).toEqual([4, 3, 2, 1]);
        expect(coeficientes[0]).toBe(1);
        expect(coeficientes[1]).toBe(2);
    });

    it('valida nodos repetidos y tamaños', () => {
        expect(() => lagrange([1, 1], [1, 2], 1)).toThrow(RangeError);
        expect(() => newtonDiferenciasDivididas([1], [1])).toThrow(RangeError);
        expect(() => lagrange(xs, ys, 'a')).toThrow(TypeError);
    });
});

describe('splineCubicoNatural', () => {
    it('reproduce los nudos y tiene segunda derivada nula en los extremos', () => {
        const s = splineCubicoNatural(xs, ys);
        xs.forEach((x, i) => expect(s.evaluar(x)).toBeCloseTo(ys[i], 10));
        expect(s.momentos[0]).toBe(0);
        expect(s.momentos[3]).toBe(0);
    });

    it('es continuo en la primera derivada en los nudos interiores', () => {
        const s = splineCubicoNatural(xs, ys);
        const e = 1e-7;
        for (const x of [1, 2]) {
            expect(s.derivada(x - e)).toBeCloseTo(s.derivada(x + e), 5);
        }
    });

    it('con datos lineales devuelve la recta', () => {
        const s = splineCubicoNatural([0, 1, 2, 3], [1, 3, 5, 7]);
        expect(s.evaluar(1.5)).toBeCloseTo(4, 10);
    });

    it('dos puntos -> recta; fuera de rango lanza salvo extrapolar', () => {
        const s = splineCubicoNatural([0, 2], [0, 4]);
        expect(s.evaluar(1)).toBeCloseTo(2, 12);
        expect(() => s.evaluar(3)).toThrow(RangeError);
        expect(s.evaluar(3, { extrapolar: true })).toBeCloseTo(6, 12);
    });

    it('exige nodos estrictamente crecientes', () => {
        expect(() => splineCubicoNatural([0, 2, 1], [0, 1, 2])).toThrow(RangeError);
    });
});

describe('rellenarHuecos', () => {
    it('rellena huecos interiores y no extrapola los extremos', () => {
        const r = rellenarHuecos([1, 2, 3, 4, 5, 6], [null, 2, null, 6, 8, null]);
        expect(r.valores[0]).toBeNull();
        expect(r.valores[5]).toBeNull();
        expect(r.rellenados).toEqual([2]);
        expect(r.valores[2]).toBeGreaterThan(2);
        expect(r.valores[2]).toBeLessThan(6);
    });

    it('sin datos suficientes no hace nada', () => {
        expect(rellenarHuecos([1, 2], [null, 3]).metodo).toBe('ninguno');
        expect(() => rellenarHuecos([1, 2], [1])).toThrow(RangeError);
    });
});
