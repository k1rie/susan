import { describe, expect, it } from 'vitest';
import { descomposicionLU, eliminacionGaussiana, numeroCondicion, resolverConLU, resolverSistema } from './index.js';

const A3 = [[2, 1, -1], [-3, -1, 2], [-2, 1, 2]];
const b3 = [8, -11, -3]; // solución conocida: x = 2, y = 3, z = -1

describe('eliminacionGaussiana', () => {
    it('resuelve un sistema 3x3 conocido y entrega pasos', () => {
        const r = eliminacionGaussiana(A3, b3);
        expect(r.solucion[0]).toBeCloseTo(2, 10);
        expect(r.solucion[1]).toBeCloseTo(3, 10);
        expect(r.solucion[2]).toBeCloseTo(-1, 10);
        expect(r.determinante).toBeCloseTo(-1, 10);
        expect(r.pasos.length).toBeGreaterThan(3);
    });

    it('necesita pivoteo cuando a11 = 0', () => {
        const r = eliminacionGaussiana([[0, 1], [1, 0]], [3, 4]);
        expect(r.solucion).toEqual([4, 3]);
    });

    it('rechaza matrices singulares y dimensiones inválidas', () => {
        expect(() => eliminacionGaussiana([[1, 2], [2, 4]], [1, 2])).toThrow(RangeError);
        expect(() => eliminacionGaussiana([[1, 2, 3], [4, 5, 6]], [1, 2])).toThrow(RangeError);
        expect(() => eliminacionGaussiana('x', [1])).toThrow(TypeError);
        expect(() => eliminacionGaussiana([[1]], [1, 2])).toThrow(RangeError);
    });
});

describe('descomposicionLU', () => {
    it('cumple P·A = L·U', () => {
        const { L, U, P } = descomposicionLU(A3);
        for (let i = 0; i < 3; i += 1) {
            for (let j = 0; j < 3; j += 1) {
                let pa = 0;
                let lu = 0;
                for (let k = 0; k < 3; k += 1) {
                    pa += P[i][k] * A3[k][j];
                    lu += L[i][k] * U[k][j];
                }
                expect(lu).toBeCloseTo(pa, 10);
            }
        }
    });

    it('resuelve con la factorización y coincide con Gauss', () => {
        const lu = descomposicionLU(A3);
        const x = resolverConLU(lu, b3).solucion;
        const g = eliminacionGaussiana(A3, b3).solucion;
        x.forEach((v, i) => expect(v).toBeCloseTo(g[i], 10));
        expect(lu.determinante).toBeCloseTo(-1, 10);
    });
});

describe('resolverSistema', () => {
    it('devuelve residuo mínimo y sin advertencias en un sistema sano', () => {
        const r = resolverSistema(A3, b3);
        expect(r.residuo).toBeLessThan(1e-12);
        expect(r.advertencias).toEqual([]);
        expect(r.condicion).toBeGreaterThan(1);
    });

    it('advierte en un sistema mal condicionado (Hilbert 10x10)', () => {
        const n = 10;
        const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => 1 / (i + j + 1)));
        expect(numeroCondicion(H)).toBeGreaterThan(1e12);
        const r = resolverSistema(H, new Array(n).fill(1));
        expect(r.advertencias.length).toBe(1);
        expect(r.advertencias[0]).toMatch(/mal condicionado/);
    });

    it('acepta el método gauss y rechaza métodos desconocidos', () => {
        expect(resolverSistema(A3, b3, { metodo: 'gauss' }).solucion[2]).toBeCloseTo(-1, 10);
        expect(() => resolverSistema(A3, b3, { metodo: 'x' })).toThrow(RangeError);
    });
});
