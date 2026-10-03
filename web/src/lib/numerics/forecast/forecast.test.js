import { describe, expect, it } from 'vitest';
import { ajustarCandidatos, buscarCruce, elegirModelo, intervaloPrediccion, proyectarSerie, semanaDeCruce } from './index.js';

const x = [1, 2, 3, 4, 5, 6, 7, 8];

describe('selección de modelo', () => {
    it('una recta exacta se queda con el modelo lineal (parsimonia)', () => {
        const y = x.map((v) => 0.1 + 0.02 * v);
        const { elegido } = elegirModelo(ajustarCandidatos(x, y));
        expect(elegido.grado).toBe(1);
    });

    it('una parábola exacta elige el cuadrático', () => {
        const y = x.map((v) => 0.01 * v * v + 0.02);
        const { elegido } = elegirModelo(ajustarCandidatos(x, y));
        expect(elegido.grado).toBe(2);
        expect(elegido.errorLOO).toBeLessThan(1e-6);
    });

    it('con 3 puntos solo hay LOO lineal y con 2 puntos no hay LOO', () => {
        const c3 = ajustarCandidatos([1, 2, 3], [1, 2, 4]);
        expect(c3.map((c) => c.grado)).toEqual([1, 2]);
        const c2 = ajustarCandidatos([1, 2], [1, 3]);
        expect(c2.length).toBe(1);
        expect(c2[0].errorLOO).toBeNull();
        expect(elegirModelo(c2).razon).toMatch(/pocos datos/);
    });

    it('valida la entrada', () => {
        expect(() => ajustarCandidatos([1], [1])).toThrow(RangeError);
        expect(() => ajustarCandidatos([1, 2], [1, 2], { grados: [3] })).toThrow(RangeError);
    });
});

describe('proyección e intervalo', () => {
    it('proyecta una recta con intervalo nulo cuando el ajuste es exacto', () => {
        const y = x.map((v) => 0.1 + 0.02 * v);
        const p = proyectarSerie({ x, y, horizonte: 3 });
        expect(p.puntos.map((q) => q.x)).toEqual([9, 10, 11]);
        expect(p.puntos[0].valor).toBeCloseTo(0.1 + 0.02 * 9, 9);
        expect(p.puntos[2].superior - p.puntos[2].inferior).toBeLessThan(1e-6);
    });

    it('con ruido el intervalo se ensancha al alejarse de los datos', () => {
        const ruido = [0.004, -0.003, 0.002, -0.004, 0.003, -0.002, 0.001, -0.001];
        const y = x.map((v, i) => 0.1 + 0.02 * v + ruido[i]);
        const p = proyectarSerie({ x, y, horizonte: 6, grados: [1] });
        const ancho = (q) => q.superior - q.inferior;
        expect(ancho(p.puntos[0])).toBeGreaterThan(0);
        expect(ancho(p.puntos[5])).toBeGreaterThan(ancho(p.puntos[0]));
        const iv = intervaloPrediccion(p.modelo, 9);
        expect(iv.inferior).toBeLessThan(0.1 + 0.02 * 9);
        expect(iv.superior).toBeGreaterThan(0.1 + 0.02 * 9);
    });

    it('valida horizonte', () => {
        expect(() => proyectarSerie({ x, y: x, horizonte: -1 })).toThrow(RangeError);
    });
});

describe('cruce del límite', () => {
    const lineal = proyectarSerie({ x, y: x.map((v) => 2 * v), horizonte: 1 }).modelo;

    it('f(t)=2t cruza 31.1 en t=15.55 (bisección y Newton coinciden)', () => {
        const r = buscarCruce(lineal, 31.1, { desde: 8, hasta: 40 });
        expect(r.estado).toBe('cruza');
        expect(r.t).toBeCloseTo(15.55, 6);
        expect(r.semana).toBe(16);
        expect(r.newton.raiz).toBeCloseTo(15.55, 6);
        expect(r.biseccion.traza.length).toBeGreaterThan(5);
    });

    it('cruce sobre una parábola', () => {
        const y = x.map((v) => 0.5 * v * v);
        const m = proyectarSerie({ x, y, horizonte: 1 }).modelo;
        const r = buscarCruce(m, 200, { desde: 8, hasta: 40 });
        expect(r.t).toBeCloseTo(20, 5);
        expect(r.newton.raiz).toBeCloseTo(20, 5);
    });

    it('detecta superado y no cruza', () => {
        expect(buscarCruce(lineal, 5, { desde: 8, hasta: 20 }).estado).toBe('superado');
        expect(buscarCruce(lineal, 1000, { desde: 8, hasta: 20 }).estado).toBe('no_cruza');
        const plana = proyectarSerie({ x, y: x.map(() => 0.03), horizonte: 1 }).modelo;
        expect(buscarCruce(plana, 0.2, { desde: 8, hasta: 30 }).estado).toBe('no_cruza');
    });

    it('semanaDeCruce redondea hacia arriba con tolerancia', () => {
        expect(semanaDeCruce(12.05)).toBe(13);
        expect(semanaDeCruce(13.0000000001)).toBe(13);
    });

    it('valida el rango de búsqueda', () => {
        expect(() => buscarCruce(lineal, 1, { desde: 5, hasta: 5 })).toThrow(RangeError);
        expect(() => buscarCruce(lineal, 'a', { desde: 1, hasta: 5 })).toThrow(TypeError);
    });
});
