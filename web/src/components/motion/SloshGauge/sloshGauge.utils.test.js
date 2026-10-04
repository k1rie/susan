import { describe, expect, it } from 'vitest';
import { avanzarFisica, desnivelSuperficie, nivelValido, PASO_FIJO, recorteLiquido } from './sloshGauge.utils.js';

const PARAMS = { viscosity: 0.2, splash: 0.3 };

// Simula cuadros de 16 ms hasta que la física declare reposo; devuelve cuántos hicieron falta y el nivel mínimo/máximo alcanzado.
function correr(s, params, max = 2000) {
    let cuadros = 0;
    let minX = s.x;
    let maxX = s.x;
    while (cuadros < max) {
        cuadros += 1;
        const reposo = avanzarFisica(s, 0.016, params);
        minX = Math.min(minX, s.x);
        maxX = Math.max(maxX, s.x);
        if (reposo) break;
    }
    return { cuadros, minX, maxX };
}

describe('avanzarFisica', () => {
    it('sube con resorte: se pasa del objetivo (chapoteo), rebota en la pared y acaba exactamente en el objetivo', () => {
        const s = { x: 0, v: 0, L: 60 };
        const { cuadros, maxX } = correr(s, PARAMS);
        expect(maxX).toBeGreaterThan(60);
        expect(s).toMatchObject({ x: 60, v: 0 });
        expect(cuadros).toBeLessThan(2000);
    });
    it('llega a reposo (devuelve true) y a partir de ahí sigue en reposo: el rAF se puede aparcar', () => {
        const s = { x: 10, v: 0, L: 90 };
        correr(s, PARAMS);
        expect(avanzarFisica(s, 0.016, PARAMS)).toBe(true);
        expect(avanzarFisica(s, 0.016, PARAMS)).toBe(true);
        expect(s).toMatchObject({ x: 90, v: 0 });
    });
    it('nunca sale de 0-100 aunque el golpe sea fuerte', () => {
        const s = { x: 0, v: 0, L: 100 };
        const { minX, maxX } = correr(s, { viscosity: 0.05, splash: 0.9 });
        expect(minX).toBeGreaterThanOrEqual(0);
        expect(maxX).toBeLessThanOrEqual(100);
        expect(s).toMatchObject({ x: 100, v: 0 });
    });
    it('con reducir movimiento el nivel salta al objetivo sin resorte ni velocidad', () => {
        const s = { x: 5, v: 40, L: 70 };
        expect(avanzarFisica(s, 0.016, { ...PARAMS, reducido: true })).toBe(true);
        expect(s).toMatchObject({ x: 70, v: 0 });
    });
    it('viscosidad 0 también salta al objetivo y se da por quieta', () => {
        const s = { x: 5, v: 0, L: 70 };
        expect(avanzarFisica(s, 0.016, { viscosity: 0, splash: 0.3 })).toBe(true);
        expect(s.x).toBe(70);
    });
    it('dt 0 o negativo no hace nada raro (no hay NaN)', () => {
        const s = { x: 20, v: 3, L: 50 };
        avanzarFisica(s, 0, PARAMS);
        avanzarFisica(s, -1, PARAMS);
        expect(Number.isFinite(s.x)).toBe(true);
        expect(Number.isFinite(s.v)).toBe(true);
        expect(PASO_FIJO).toBeGreaterThan(0);
    });
});

describe('desnivelSuperficie y recorteLiquido', () => {
    it('sin velocidad o con reducir movimiento no hay inclinación', () => {
        expect(desnivelSuperficie(0, 0.35, 84)).toBe(0);
        expect(desnivelSuperficie(120, 0.35, 84, true)).toBe(0);
        expect(desnivelSuperficie(120, 0.35, 84)).toBeGreaterThan(0);
        expect(desnivelSuperficie(-120, 0.35, 84)).toBeLessThan(0);
    });
    it('la inclinación está acotada (30 grados como máximo)', () => {
        const tope = (Math.tan((30 * Math.PI) / 180) * 84) / 2;
        expect(desnivelSuperficie(1e6, 1, 84)).toBeCloseTo(tope, 6);
    });
    it('el recorte deja la superficie a (100 - nivel) % y redondea a 3 decimales', () => {
        expect(recorteLiquido(80)).toBe('polygon(0 calc(20% + 0px), 100% calc(20% - 0px), 100% 100%, 0 100%)');
        expect(recorteLiquido(33.33333, 1.23456)).toBe('polygon(0 calc(66.667% + 1.235px), 100% calc(66.667% - 1.235px), 100% 100%, 0 100%)');
        expect(recorteLiquido(NaN, NaN)).toContain('calc(0% + 0px)');
    });
});

describe('nivelValido', () => {
    it('acota a 0-100 y manda lo no numérico al respaldo', () => {
        expect(nivelValido(140)).toBe(100);
        expect(nivelValido(-3)).toBe(0);
        expect(nivelValido('42')).toBe(42);
        expect(nivelValido(NaN, 7)).toBe(7);
        expect(nivelValido(undefined, 7)).toBe(7);
        expect(nivelValido(null, 7)).toBe(7);
        expect(nivelValido('', 7)).toBe(7);
        expect(nivelValido('abc')).toBe(0);
    });
});
