import { describe, expect, it } from 'vitest';
import { aic, ajusteLineal, ajustePolinomial, errorEstandar, r2, r2Ajustado } from './index.js';

describe('ajusteLineal', () => {
    it('recta exacta: r2 = 1, coeficientes exactos y error estándar 0', () => {
        const x = [1, 2, 3, 4, 5];
        const y = x.map((v) => 3 + 2 * v);
        const a = ajusteLineal(x, y);
        expect(a.intercepto).toBeCloseTo(3, 10);
        expect(a.pendiente).toBeCloseTo(2, 10);
        expect(a.r2).toBeCloseTo(1, 12);
        expect(a.errorEstandar).toBeCloseTo(0, 8);
        expect(a.predecir(10)).toBeCloseTo(23, 9);
        expect(a.pasos.length).toBeGreaterThan(2);
    });

    it('datos con ruido: valores calculados a mano', () => {
        // x = 1..4, y = 2, 4, 5, 8 -> b = 1.9, a = 0 (Sxy = 9.5 con Sxx = 5)
        const a = ajusteLineal([1, 2, 3, 4], [2, 4, 5, 8]);
        expect(a.pendiente).toBeCloseTo(1.9, 10);
        expect(a.intercepto).toBeCloseTo(0, 10);
        expect(a.r2).toBeGreaterThan(0.95);
        expect(a.r2).toBeLessThan(1);
        expect(a.r2Ajustado).toBeLessThan(a.r2);
        expect(a.residuos.reduce((s, e) => s + e, 0)).toBeCloseTo(0, 10);
    });

    it('y constante: pendiente 0 y r2 = 1', () => {
        const a = ajusteLineal([1, 2, 3], [5, 5, 5]);
        expect(a.pendiente).toBeCloseTo(0, 12);
        expect(a.r2).toBe(1);
    });

    it('valida la entrada', () => {
        expect(() => ajusteLineal([1], [1])).toThrow(RangeError);
        expect(() => ajusteLineal([2, 2, 2], [1, 2, 3])).toThrow(RangeError);
        expect(() => ajusteLineal([1, 2], [1])).toThrow(RangeError);
        expect(() => ajusteLineal('a', [1, 2])).toThrow(TypeError);
        expect(() => ajusteLineal([1, NaN], [1, 2])).toThrow(RangeError);
    });
});

describe('ajustePolinomial', () => {
    it('parábola exacta', () => {
        const x = [0, 1, 2, 3, 4, 5];
        const y = x.map((v) => 1 - 2 * v + 0.5 * v * v);
        const p = ajustePolinomial(x, y, 2);
        expect(p.r2).toBeCloseTo(1, 12);
        expect(p.predecir(10)).toBeCloseTo(1 - 20 + 50, 7);
        expect(p.derivada(4)).toBeCloseTo(-2 + 4, 8);
        expect(p.errorEstandar).toBeCloseTo(0, 6);
    });

    it('con x grandes (años) sigue siendo estable gracias al centrado', () => {
        const x = [2020, 2021, 2022, 2023, 2024, 2025];
        const y = x.map((v) => 0.001 * (v - 2020) ** 2 + 0.1);
        const p = ajustePolinomial(x, y, 2);
        expect(p.predecir(2026)).toBeCloseTo(0.001 * 36 + 0.1, 8);
    });

    it('grado 0 es la media y grado n-1 interpola', () => {
        expect(ajustePolinomial([1, 2, 3], [2, 4, 9], 0).predecir(0)).toBeCloseTo(5, 12);
        const p = ajustePolinomial([0, 1, 2], [1, 3, 2], 2);
        expect(p.predecir(1)).toBeCloseTo(3, 10);
        expect(p.errorEstandar).toBeNull();
        expect(p.r2Ajustado).toBeNull();
    });

    it('valida grado y cantidad de puntos', () => {
        expect(() => ajustePolinomial([1, 2], [1, 2], 2)).toThrow(RangeError);
        expect(() => ajustePolinomial([1, 2, 3], [1, 2, 3], 1.5)).toThrow(RangeError);
        expect(() => ajustePolinomial([1, 2, 3], [1, 2, 3], -1)).toThrow(RangeError);
        expect(() => ajustePolinomial([1, 1, 1], [1, 2, 3], 1)).toThrow(RangeError);
    });
});

describe('métricas', () => {
    it('r2, r2 ajustado, error estándar y AIC', () => {
        expect(r2([1, 2, 3], [1, 2, 3])).toBe(1);
        expect(r2([1, 2, 3], [2, 2, 2])).toBeCloseTo(0, 12);
        expect(r2Ajustado(0.9, 10, 1)).toBeCloseTo(1 - (0.1 * 9) / 8, 12);
        expect(r2Ajustado(0.9, 2, 1)).toBeNull();
        expect(errorEstandar(8, 10, 2)).toBeCloseTo(1, 12);
        expect(errorEstandar(8, 2, 2)).toBeNull();
        expect(Number.isFinite(aic(10, 0, 2))).toBe(true);
    });
});
