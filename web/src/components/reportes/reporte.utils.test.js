import { describe, expect, it } from 'vitest';
import { apoyoEnLimite, apoyoSinDerecho, cifraPorcentaje, porcentaje } from './reporte.utils.js';

describe('cifraPorcentaje', () => {
    it('separa la cifra (2 decimales, como porcentaje) y la unidad', () => {
        expect(cifraPorcentaje(82.35)).toEqual({ value: '82.35', unit: '%' });
        expect(cifraPorcentaje(90)).toEqual({ value: '90.00', unit: '%' });
        expect(cifraPorcentaje('91.5')).toEqual({ value: '91.50', unit: '%' });
        expect(cifraPorcentaje(0)).toEqual({ value: '0.00', unit: '%' });
    });
    it('unidad y cifra juntas dan el mismo texto que porcentaje()', () => {
        for (const v of [82.35, 90, 0, 100, '7.5']) {
            const { value, unit } = cifraPorcentaje(v);
            expect(`${value} ${unit}`).toBe(porcentaje(v));
        }
    });
    it('sin dato: guion largo y sin unidad', () => {
        for (const v of [null, undefined, 'abc', NaN]) expect(cifraPorcentaje(v)).toEqual({ value: '—' });
    });
});

describe('apoyos de los indicadores de riesgo', () => {
    it('en el límite: ninguno, uno (singular) o varios', () => {
        expect(apoyoEnLimite(0)).toBe('Ninguno por ahora');
        expect(apoyoEnLimite(1)).toBe('Una falta más y pierde el derecho');
        expect(apoyoEnLimite(3)).toBe('Una falta más y pierden el derecho');
    });
    it('sin derecho: ninguno, uno (singular) o varios', () => {
        expect(apoyoSinDerecho(0)).toBe('Ninguno por ahora');
        expect(apoyoSinDerecho(1)).toBe('Superó el límite de faltas');
        expect(apoyoSinDerecho(2)).toBe('Superaron el límite de faltas');
    });
    it('un valor ausente o inválido cuenta como ninguno', () => {
        for (const v of [undefined, null, NaN, -1]) {
            expect(apoyoEnLimite(v)).toBe('Ninguno por ahora');
            expect(apoyoSinDerecho(v)).toBe('Ninguno por ahora');
        }
    });
});
