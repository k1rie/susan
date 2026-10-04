import { describe, expect, it } from 'vitest';
import { dominioSerie, idSvg, limpiarSerie, serieDibujable } from './sparkline.utils.js';

describe('limpiarSerie', () => {
    it('conserva solo números reales y en orden', () => {
        expect(limpiarSerie([1, 2.5, 0, -3])).toEqual([1, 2.5, 0, -3]);
    });
    it('descarta null, undefined, NaN, Infinity, cadenas vacías o no numéricas, booleanos y objetos (Number(null) sería 0)', () => {
        expect(limpiarSerie([1, null, undefined, NaN, Infinity, -Infinity, '', '  ', 'abc', true, false, {}, [], 2])).toEqual([1, 2]);
    });
    it('acepta cadenas numéricas (los numeric de PostgreSQL llegan así)', () => {
        expect(limpiarSerie(['12.5', ' 7 ', 3])).toEqual([12.5, 7, 3]);
    });
    it('lo que no sea arreglo da []', () => {
        expect(limpiarSerie(undefined)).toEqual([]);
        expect(limpiarSerie(null)).toEqual([]);
        expect(limpiarSerie('1,2,3')).toEqual([]);
        expect(limpiarSerie({ 0: 1, 1: 2 })).toEqual([]);
    });
});

describe('serieDibujable', () => {
    it('hace falta un mínimo de 2 puntos reales', () => {
        expect(serieDibujable([1, 2])).toBe(true);
        expect(serieDibujable([1])).toBe(false);
        expect(serieDibujable([1, null, NaN])).toBe(false);
        expect(serieDibujable([])).toBe(false);
        expect(serieDibujable()).toBe(false);
    });
});

describe('dominioSerie', () => {
    it('por defecto es el rango de los datos', () => {
        expect(dominioSerie([3, 9, 5])).toEqual([3, 9]);
    });
    it('min y max fijos mandan sobre los datos (también uno solo)', () => {
        expect(dominioSerie([3, 9], 0, 100)).toEqual([0, 100]);
        expect(dominioSerie([3, 9], 0)).toEqual([0, 9]);
        expect(dominioSerie([3, 9], undefined, 20)).toEqual([3, 20]);
        expect(dominioSerie([3, 9], 0, 0)).toEqual([-1, 1]);
    });
    it('min/max no numéricos se ignoran', () => {
        expect(dominioSerie([3, 9], null, 'x')).toEqual([3, 9]);
    });
    it('valores iguales abren ±1 para que la línea caiga al centro', () => {
        expect(dominioSerie([5, 5, 5])).toEqual([4, 6]);
    });
    it('un dominio invertido se ordena', () => {
        expect(dominioSerie([3, 9], 50, 10)).toEqual([10, 50]);
    });
});

describe('idSvg', () => {
    it('produce un id válido para url(#...) sea cual sea el formato de useId', () => {
        for (const crudo of ['_r_0_', ':r0:', '«r1»', '_R_abc12_']) {
            expect(idSvg(crudo, 'g')).toMatch(/^[A-Za-z_][\w-]*$/);
        }
        expect(idSvg(':r0:', 'g')).not.toBe(idSvg(':r1:', 'g'));
    });
});
