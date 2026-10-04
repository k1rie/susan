import { describe, expect, it } from 'vitest';
import { limiteMedidor, nivelMedidor } from './medidorLiquido.utils.js';

describe('nivelMedidor', () => {
    it('acota a 0-100 con a lo más 1 decimal', () => {
        expect(nivelMedidor(82)).toBe(82);
        expect(nivelMedidor(82.349)).toBe(82.3);
        expect(nivelMedidor(140)).toBe(100);
        expect(nivelMedidor(-5)).toBe(0);
        expect(nivelMedidor('64')).toBe(64);
    });
    it('lo no numérico es 0', () => {
        for (const v of [undefined, null, NaN, 'abc', Infinity, {}]) expect(nivelMedidor(v)).toBe(0);
    });
});

describe('limiteMedidor', () => {
    it('devuelve { valor, etiqueta } con el valor acotado', () => {
        expect(limiteMedidor({ valor: 80, etiqueta: 'Mínimo 80 %' })).toEqual({ valor: 80, etiqueta: 'Mínimo 80 %' });
        expect(limiteMedidor({ valor: 130, etiqueta: 'x' }).valor).toBe(100);
        expect(limiteMedidor({ valor: -2, etiqueta: 'x' }).valor).toBe(0);
        expect(limiteMedidor({ valor: '75', etiqueta: 'x' }).valor).toBe(75);
    });
    it('sin etiqueta usa «Límite N %»', () => {
        expect(limiteMedidor({ valor: 80 }).etiqueta).toBe('Límite 80 %');
        expect(limiteMedidor({ valor: 62.5, etiqueta: '   ' }).etiqueta).toBe('Límite 62.5 %');
    });
    it('sin valor numérico no hay marca', () => {
        for (const l of [undefined, null, 'x', 5, {}, { valor: null }, { valor: '' }, { valor: NaN }, { valor: 'abc' }, { etiqueta: 'a' }]) {
            expect(limiteMedidor(l)).toBeNull();
        }
    });
});
