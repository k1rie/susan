import { describe, expect, it } from 'vitest';
import { derivadaFuncion, derivadaSerie, diferenciaAdelante, diferenciaAtras, diferenciaCentral, richardson } from './index.js';

describe('diferencias finitas', () => {
    it('adelante, atrás y central sobre f = x² (uniforme)', () => {
        const xs = [0, 1, 2, 3];
        const ys = xs.map((x) => x * x);
        expect(diferenciaAdelante(xs, ys, 1)).toBe(3);
        expect(diferenciaAtras(xs, ys, 1)).toBe(1);
        expect(diferenciaCentral(xs, ys, 1)).toBe(2); // exacta para parábolas
    });

    it('la central no uniforme es exacta para parábolas', () => {
        const xs = [0, 1, 3, 4];
        const f = (x) => 3 * x * x - x + 2;
        const ys = xs.map(f);
        expect(diferenciaCentral(xs, ys, 1)).toBeCloseTo(6 * 1 - 1, 10);
        expect(diferenciaCentral(xs, ys, 2)).toBeCloseTo(6 * 3 - 1, 10);
    });

    it('derivadaSerie de una recta es su pendiente en todos los nodos', () => {
        const xs = [1, 2, 4, 7];
        const d = derivadaSerie(xs, xs.map((x) => 5 * x + 1));
        d.forEach((v) => expect(v).toBeCloseTo(5, 10));
        expect(derivadaSerie([0, 1], [0, 2])).toEqual([2, 2]);
    });

    it('derivadaSerie de x² con extremos de segundo orden', () => {
        const xs = [0, 1, 2, 3, 4];
        const d = derivadaSerie(xs, xs.map((x) => x * x));
        d.forEach((v, i) => expect(v).toBeCloseTo(2 * xs[i], 10));
        const simple = derivadaSerie(xs, xs.map((x) => x * x), { esquema: 'simple' });
        expect(simple[0]).toBe(1);
    });

    it('valida índices y nodos', () => {
        expect(() => diferenciaAdelante([0, 1], [0, 1], 1)).toThrow(RangeError);
        expect(() => diferenciaCentral([0, 1, 2], [0, 1, 4], 0)).toThrow(RangeError);
        expect(() => diferenciaAtras([1, 1], [0, 1], 1)).toThrow(RangeError);
        expect(() => derivadaSerie([0, 1], [0, 1], { esquema: 'x' })).toThrow(RangeError);
    });
});

describe('derivadaFuncion y Richardson', () => {
    it('derivada de sin en 1 es cos(1)', () => {
        expect(derivadaFuncion(Math.sin, 1)).toBeCloseTo(Math.cos(1), 8);
        expect(derivadaFuncion(Math.sin, 1, { esquema: 'adelante', h: 1e-6 })).toBeCloseTo(Math.cos(1), 5);
        expect(() => derivadaFuncion(Math.sin, 1, { h: -1 })).toThrow(RangeError);
    });

    it('Richardson mejora la central y reporta tabla', () => {
        const central = derivadaFuncion(Math.sin, 1, { h: 0.5 });
        const r = richardson(Math.sin, 1, { h: 0.5, niveles: 5 });
        expect(Math.abs(r.valor - Math.cos(1))).toBeLessThan(Math.abs(central - Math.cos(1)) / 1e4);
        expect(r.valor).toBeCloseTo(Math.cos(1), 8);
        expect(r.tabla.length).toBe(5);
        expect(r.tabla[4].length).toBe(5);
    });

    it('valida parámetros', () => {
        expect(() => richardson(Math.sin, 1, { niveles: 1 })).toThrow(RangeError);
        expect(() => richardson('f', 1)).toThrow(TypeError);
    });
});
