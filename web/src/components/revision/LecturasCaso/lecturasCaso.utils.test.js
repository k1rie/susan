import { describe, expect, it } from 'vitest';
import { datosScores, lecturasNumeradas, progresoValidas, recortePurgado, resumenScores, resumenValidas, textoCamara, textoScore } from './lecturasCaso.utils.js';

const L = (min, score, es_valida) => ({ marca_tiempo: `2026-09-14T13:0${min}:00Z`, score_similitud: score, es_valida });

describe('lecturasCaso.utils', () => {
    it('mantiene las utilidades existentes', () => {
        expect(textoScore(0.81234)).toBe('0.812');
        expect(textoScore(null)).toBe('-');
        expect(textoCamara('frente')).toBe('Cámara frontal');
        expect(textoCamara('fondo')).toBe('Cámara de fondo');
        expect(textoCamara('x')).toBe('Cámara');
        expect(recortePurgado({ recorte_disponible: false })).toBe(true);
        expect(recortePurgado({ recorte: { url: 'u' } })).toBe(false);
        expect(resumenValidas([L(1, 0.9, true), L(2, 0.5, false)], 3)).toBe('Lecturas válidas: 1/3');
        expect(resumenValidas([], null)).toBe('Lecturas válidas: 0');
    });
    it('arma una barra por lectura en orden cronológico, en la serie que corresponde', () => {
        const d = datosScores([L(3, 0.4, false), L(1, 0.81, true), L(2, 0.9, true)]);
        expect(d).toEqual([{ lectura: '1', valida: 81 }, { lectura: '2', valida: 90 }, { lectura: '3', no_valida: 40 }]);
    });
    it('numera las lecturas en orden cronológico sin importar el orden del servidor, sin mutar la entrada', () => {
        const entrada = [{ ...L(3, 0.4, false), id_deteccion: 'c' }, { ...L(1, 0.81, true), id_deteccion: 'a' }, { ...L(2, 0.9, true), id_deteccion: 'b' }];
        const n = lecturasNumeradas(entrada);
        expect(n.map((l) => [l.id_deteccion, l.numero])).toEqual([['a', 1], ['b', 2], ['c', 3]]);
        expect(entrada.map((l) => l.id_deteccion)).toEqual(['c', 'a', 'b']);
        expect(lecturasNumeradas(undefined)).toEqual([]);
    });
    it('misma hora: el número sigue el orden de llegada', () => {
        const mismaHora = [{ ...L(1, 0.9, true), id_deteccion: 'x' }, { ...L(1, 0.5, false), id_deteccion: 'y' }];
        expect(lecturasNumeradas(mismaHora).map((l) => l.id_deteccion)).toEqual(['x', 'y']);
    });
    it('la barra lleva el mismo número que la tarjeta aunque una lectura anterior no tenga score', () => {
        // La lectura 2 no tiene score: no se grafica, pero la lectura 3 sigue siendo «3» en el eje y en la lista.
        const d = datosScores([L(1, 0.8, true), L(2, null, true), L(3, 0.6, false)]);
        expect(d).toEqual([{ lectura: '1', valida: 80 }, { lectura: '3', no_valida: 60 }]);
    });
    it('con más lecturas que barras conserva el número real de las más recientes', () => {
        const muchas = Array.from({ length: 6 }, (_, i) => L(i, 0.5 + i / 20, true));
        expect(datosScores(muchas, 2).map((x) => x.lectura)).toEqual(['5', '6']);
    });
    it('acota el score a 0-100, ignora inválidos y limita las barras a las más recientes', () => {
        expect(datosScores([L(1, 1.4, true), L(2, -0.2, false), L(3, null, true)])).toEqual([{ lectura: '1', valida: 100 }, { lectura: '2', no_valida: 0 }]);
        const muchas = Array.from({ length: 6 }, (_, i) => L(i, 0.5 + i / 20, true));
        const d = datosScores(muchas, 3);
        expect(d).toHaveLength(3);
        expect(d[2].valida).toBe(75);
    });
    it('sin lecturas devuelve vacío y el resumen lo dice', () => {
        expect(datosScores([])).toEqual([]);
        expect(datosScores(undefined)).toEqual([]);
        expect(resumenScores([])).toBe('Sin lecturas para graficar.');
        expect(resumenScores(datosScores([L(1, 0.8, true), L(2, 0.3, false)]))).toBe('Score de similitud por lectura, lectura 1: 80 % (válida); lectura 2: 30 % (no válida).');
    });
    it('calcula el avance hacia el mínimo de válidas', () => {
        expect(progresoValidas([L(1, 0.9, true), L(2, 0.5, false)], 3)).toEqual({ validas: 1, minimo: 3, ancho: (1 / 3) * 100, cumple: false });
        expect(progresoValidas([L(1, 0.9, true), L(2, 0.9, true), L(3, 0.9, true), L(4, 0.9, true)], 3)).toMatchObject({ ancho: 100, cumple: true });
        expect(progresoValidas([], undefined)).toEqual({ validas: 0, minimo: null, ancho: 0, cumple: false });
    });
});
