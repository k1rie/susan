import { describe, expect, it } from 'vitest';
import { contarCambios, extraerValor, iguales, limpiarErrores } from './formulario.utils.js';

describe('iguales', () => {
    it('compara primitivos, arreglos, objetos anidados y fechas', () => {
        expect(iguales('a', 'a')).toBe(true);
        expect(iguales(1, '1')).toBe(false);
        expect(iguales(NaN, NaN)).toBe(true);
        expect(iguales([1, { a: 2 }], [1, { a: 2 }])).toBe(true);
        expect(iguales([1, 2], [1, 2, 3])).toBe(false);
        expect(iguales({ a: 1 }, { a: 1, b: undefined })).toBe(false);
        expect(iguales(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(true);
        expect(iguales(new Date('2026-01-01'), new Date('2026-01-02'))).toBe(false);
        expect(iguales(null, undefined)).toBe(false);
        expect(iguales([], {})).toBe(false);
    });
});

describe('contarCambios', () => {
    it('cuenta los campos distintos, incluidos los que aparecen o desaparecen', () => {
        expect(contarCambios({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(0);
        expect(contarCambios({ a: 1, b: 3, c: 4 }, { a: 1, b: 2 })).toBe(2);
        expect(contarCambios({ a: 1 }, { a: 1, b: 2 })).toBe(1);
    });
});

describe('limpiarErrores', () => {
    it('conserva solo mensajes reales', () => {
        expect(limpiarErrores({ a: 'mal', b: '', c: '  ', d: undefined, e: null, f: false })).toEqual({ a: 'mal' });
        expect(limpiarErrores(undefined)).toEqual({});
        expect(limpiarErrores(null)).toEqual({});
    });
});

describe('extraerValor', () => {
    it('lee el valor de un evento, el checked de una casilla y el archivo; deja pasar valores crudos', () => {
        expect(extraerValor({ target: { value: 'hola', type: 'text' } })).toBe('hola');
        expect(extraerValor({ target: { checked: true, type: 'checkbox', value: 'on' } })).toBe(true);
        const archivo = { name: 'a.pdf' };
        expect(extraerValor({ target: { type: 'file', files: [archivo], value: 'C:\\a.pdf' } })).toBe(archivo);
        expect(extraerValor('activo')).toBe('activo');
        expect(extraerValor(['a', 'b'])).toEqual(['a', 'b']);
        expect(extraerValor({ value: 3, label: 'Tres' })).toEqual({ value: 3, label: 'Tres' });
        expect(extraerValor(null)).toBeNull();
    });
});
