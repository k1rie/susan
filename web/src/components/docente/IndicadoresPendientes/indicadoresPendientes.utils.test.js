import { describe, expect, it } from 'vitest';
import { apoyoPendiente, cantidadSegura } from './indicadoresPendientes.utils.js';

describe('apoyoPendiente', () => {
    it('sin cantidad (0, vacío o inválido) dice que no hay nada pendiente', () => {
        for (const v of [0, '0', null, undefined, NaN, -3, 'abc']) expect(apoyoPendiente(v, 'revisión')).toBe('Nada pendiente');
    });
    it('concuerda el verbo con la cifra', () => {
        expect(apoyoPendiente(1, 'revisión')).toBe('Espera tu revisión');
        expect(apoyoPendiente(3, 'resolución')).toBe('Esperan tu resolución');
        expect(apoyoPendiente('2', 'revisión')).toBe('Esperan tu revisión');
    });
});

describe('cantidadSegura', () => {
    it('conserva los enteros positivos y manda a 0 lo que no sea un conteo', () => {
        expect(cantidadSegura(7)).toBe(7);
        expect(cantidadSegura('5')).toBe(5);
        for (const v of [null, undefined, NaN, -1, 'x', Infinity]) expect(cantidadSegura(v)).toBe(0);
    });
});
