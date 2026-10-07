import { describe, expect, it } from 'vitest';
import { destinoDeTecla, indiceTabulable } from './segmentedControl.utils.js';

const ITEMS = [{ value: 'a' }, { value: 'b', disabled: true }, { value: 'c' }, { value: 'd' }];

describe('destinoDeTecla', () => {
    it('las flechas saltan las opciones deshabilitadas y dan la vuelta', () => {
        expect(destinoDeTecla(ITEMS, 0, 'ArrowRight')).toBe(2);
        expect(destinoDeTecla(ITEMS, 3, 'ArrowRight')).toBe(0);
        expect(destinoDeTecla(ITEMS, 0, 'ArrowLeft')).toBe(3);
        expect(destinoDeTecla(ITEMS, 2, 'ArrowUp')).toBe(0);
        expect(destinoDeTecla(ITEMS, 2, 'ArrowDown')).toBe(3);
    });

    it('Inicio y Fin van a los extremos habilitados', () => {
        expect(destinoDeTecla(ITEMS, 2, 'Home')).toBe(0);
        expect(destinoDeTecla(ITEMS, 0, 'End')).toBe(3);
        expect(destinoDeTecla([{ value: 'x', disabled: true }, { value: 'y' }], 1, 'Home')).toBe(1);
    });

    it('otras teclas, todo deshabilitado o sin habilitadas no navegan', () => {
        expect(destinoDeTecla(ITEMS, 0, 'Enter')).toBe(-1);
        expect(destinoDeTecla(ITEMS, 0, 'ArrowRight', true)).toBe(-1);
        expect(destinoDeTecla([{ value: 'x', disabled: true }], 0, 'ArrowRight')).toBe(-1);
        expect(destinoDeTecla([{ value: 'x', disabled: true }], 0, 'End')).toBe(-1);
    });
});

describe('indiceTabulable', () => {
    it('es la elegida, o la primera habilitada si no hay elegida', () => {
        expect(indiceTabulable(ITEMS, 'c')).toBe(2);
        expect(indiceTabulable(ITEMS, 'zzz')).toBe(0);
        expect(indiceTabulable(ITEMS, undefined)).toBe(0);
        expect(indiceTabulable(ITEMS, 'b')).toBe(0); // la elegida está deshabilitada
        expect(indiceTabulable(ITEMS, 'a', true)).toBe(-1);
    });

    it('compara por texto: el número 1 coincide con "1"', () => {
        expect(indiceTabulable([{ value: 1 }, { value: 2 }], '2')).toBe(1);
    });
});
