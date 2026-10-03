import { describe, expect, it } from 'vitest';
import { desgloseCorto, faltasRestantes } from './tablaReporte.utils.js';

// La cifra y su etiqueta van unidas con un espacio de no separación.
const sinNbsp = (t) => t.replaceAll('\u00a0', ' ');

describe('desgloseCorto', () => {
    it('resume presentes, retardos y ausencias', () => {
        expect(sinNbsp(desgloseCorto({ presentes: 5, retardos: 0, ausencias: 1, justificadas: 0, pendientes: 0 }))).toBe('5 pres., 0 ret., 1 aus.');
    });
    it('añade justificadas y pendientes solo cuando existen', () => {
        expect(sinNbsp(desgloseCorto({ presentes: 5, retardos: 1, ausencias: 2, justificadas: 3, pendientes: 1 }))).toBe('5 pres., 1 ret., 2 aus., 3 just., 1 pend.');
    });
    it('tolera campos nulos o ausentes', () => {
        expect(sinNbsp(desgloseCorto({ presentes: null }))).toBe('0 pres., 0 ret., 0 aus.');
        expect(sinNbsp(desgloseCorto(undefined))).toBe('0 pres., 0 ret., 0 aus.');
    });
    it('une la cifra con su etiqueta para no dejar números huérfanos al envolver', () => {
        expect(desgloseCorto({ presentes: 5 })).toContain('5\u00a0pres.');
    });
});

describe('faltasRestantes', () => {
    it('devuelve el número o null si no hay dato', () => {
        expect(faltasRestantes({ faltas_restantes_antes_limite: 8 })).toBe(8);
        expect(faltasRestantes({ faltas_restantes_antes_limite: 0 })).toBe(0);
        expect(faltasRestantes({ faltas_restantes_antes_limite: null })).toBeNull();
        expect(faltasRestantes({})).toBeNull();
    });
});
