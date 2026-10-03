import { describe, expect, it } from 'vitest';
import { geometriaVentana } from './ventanaTolerancia.utils.js';

describe('ventanaTolerancia.utils', () => {
    it('ubica el minuto actual y el fin de la puntualidad en %', () => {
        expect(geometriaVentana({ minuto_actual: 5, tolerancia_min: 20, limite_presente_min: 10 })).toEqual({ total: 20, minuto: 5, limite: 10, actual: 25, presente: 50 });
    });
    it('acota al rango 0-100 cuando el minuto se pasa o es negativo', () => {
        expect(geometriaVentana({ minuto_actual: 400, tolerancia_min: 20, limite_presente_min: 10 }).actual).toBe(100);
        expect(geometriaVentana({ minuto_actual: -3, tolerancia_min: 20, limite_presente_min: 10 }).actual).toBe(0);
    });
    it('sin tolerancia válida no hay barra', () => {
        expect(geometriaVentana({ minuto_actual: 5, tolerancia_min: 0 }).total).toBeNull();
        expect(geometriaVentana({}).total).toBeNull();
        expect(geometriaVentana(undefined).total).toBeNull();
    });
    it('minuto o límite ausentes quedan en null y 0', () => {
        expect(geometriaVentana({ tolerancia_min: 20 })).toEqual({ total: 20, minuto: null, limite: null, actual: 0, presente: 0 });
    });
});
