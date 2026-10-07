import { describe, expect, it } from 'vitest';
import { idPositivo, opcionPorId } from './nuevoGrupo.utils.js';

describe('idPositivo (?materia= y ?aula=)', () => {
    it('acepta enteros positivos escritos como texto', () => {
        expect(idPositivo('3')).toBe(3);
        expect(idPositivo(' 12 ')).toBe(12);
        expect(idPositivo('007')).toBe(7);
    });
    it('ignora todo lo demás sin lanzar error', () => {
        for (const malo of [undefined, null, '', '0', '-1', '2.5', 'abc', '1e3', '12abc', '99999999999', ['1', '2'], 5]) {
            expect(idPositivo(malo)).toBeUndefined();
        }
    });
});

describe('opcionPorId', () => {
    const opciones = [{ value: '1', label: 'A' }, { value: '2', label: 'B' }];
    it('encuentra la opción por su id aunque el valor sea texto', () => {
        expect(opcionPorId(opciones, 2)).toEqual({ value: '2', label: 'B' });
    });
    it('si el id no existe en el catálogo cargado, o no hay id, no preselecciona nada', () => {
        expect(opcionPorId(opciones, 99)).toBeUndefined();
        expect(opcionPorId(opciones, undefined)).toBeUndefined();
        expect(opcionPorId(undefined, 1)).toBeUndefined();
    });
});
