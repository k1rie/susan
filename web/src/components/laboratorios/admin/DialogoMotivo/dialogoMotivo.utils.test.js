import { describe, expect, it } from 'vitest';
import { normalizarMotivo, validarMotivo } from './dialogoMotivo.utils.js';

describe('validarMotivo', () => {
    it('obligatorio: de 3 a 300 caracteres después de recortar', () => {
        expect(validarMotivo('', { obligatorio: true })).toMatch(/mínimo 3/);
        expect(validarMotivo('   ', { obligatorio: true })).toMatch(/mínimo 3/);
        expect(validarMotivo(' ab ', { obligatorio: true })).toMatch(/mínimo 3/);
        expect(validarMotivo('abc', { obligatorio: true })).toBeNull();
        expect(validarMotivo('a'.repeat(300), { obligatorio: true })).toBeNull();
        expect(validarMotivo('a'.repeat(301), { obligatorio: true })).toMatch(/300/);
    });

    it('opcional: vacío vale, pero el máximo sigue aplicando', () => {
        expect(validarMotivo('', { obligatorio: false })).toBeNull();
        expect(validarMotivo('a', { obligatorio: false })).toBeNull();
        expect(validarMotivo('a'.repeat(301), { obligatorio: false })).toMatch(/300/);
    });

    it('normalizarMotivo recorta y tolera null', () => {
        expect(normalizarMotivo('  hola  ')).toBe('hola');
        expect(normalizarMotivo(null)).toBe('');
    });
});
