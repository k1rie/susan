import { describe, expect, it } from 'vitest';
import { contadoresCamaras, datosCapturas, haceCuanto, mensajeCambio, resumenCapturas, sinCapturar } from './camaras.utils.js';

const cam = (id, extra = {}) => ({ id_camara: id, aula_clave: `A-${id}`, posicion: 'frontal', estatus: 'activa', capturas_24h: 10, ...extra });

describe('camaras.utils', () => {
    it('sinCapturar solo marca activas sin capturas', () => {
        expect(sinCapturar(cam(1, { capturas_24h: 0 }))).toBe(true);
        expect(sinCapturar(cam(1, { estatus: 'inactiva', capturas_24h: 0 }))).toBe(false);
        expect(sinCapturar(cam(1))).toBe(false);
    });
    it('haceCuanto y mensajeCambio siguen igual', () => {
        expect(haceCuanto(null)).toBe('Sin capturas');
        const ahora = Date.parse('2026-09-10T12:00:00Z');
        expect(haceCuanto('2026-09-10T11:30:00Z', ahora)).toBe('hace 30 min');
        expect(mensajeCambio(cam(1), 'activa')).toBe('Cambiar la cámara A-1 (frontal) a activa.');
        expect(mensajeCambio(cam(1), 'inactiva')).toMatch(/pase manual/);
    });
    it('contadoresCamaras: activas, inactivas (con mantenimiento) y activas sin capturas', () => {
        const n = contadoresCamaras([cam(1), cam(2, { capturas_24h: 0 }), cam(3, { estatus: 'inactiva' }), cam(4, { estatus: 'mantenimiento' })]);
        expect(n).toEqual({ total: 4, activas: 2, inactivas: 2, sinCapturas: 1 });
        expect(contadoresCamaras([])).toEqual({ total: 0, activas: 0, inactivas: 0, sinCapturas: 0 });
        expect(contadoresCamaras(undefined).total).toBe(0);
    });
    it('datosCapturas ordena de mayor a menor y limita, indicando cuántas quedan fuera', () => {
        const items = [cam(1, { capturas_24h: 5 }), cam(2, { capturas_24h: 40 }), cam(3, { capturas_24h: 0 }), cam(4, { capturas_24h: 12 })];
        const d = datosCapturas(items, 3);
        expect(d.filas.map((f) => f.capturas)).toEqual([40, 12, 5]);
        expect(d.omitidas).toBe(1);
        expect(datosCapturas(items).omitidas).toBe(0);
        expect(datosCapturas([]).filas).toEqual([]);
    });
    it('datosCapturas distingue cámaras con la misma aula y posición y deja el nombre completo (la lista lo parte en 2 líneas)', () => {
        const d = datosCapturas([cam(1, { aula_clave: 'X' }), cam(2, { aula_clave: 'X' }), cam(3, { aula_clave: 'Laboratorio de cómputo 4' })]);
        expect(d.filas.map((f) => f.camara)).toContain('X · frontal #1');
        expect(d.filas.map((f) => f.camara)).toContain('X · frontal #2');
        expect(d.filas.map((f) => f.camara)).toContain('Laboratorio de cómputo 4 · frontal');
    });
    it('datosCapturas toma 0 cuando capturas_24h no es numérico y mantiene el orden de mayor a menor', () => {
        const d = datosCapturas([cam(1, { capturas_24h: null }), cam(2, { capturas_24h: '7' }), cam(3, { capturas_24h: undefined })]);
        expect(d.filas.map((f) => f.capturas)).toEqual([7, 0, 0]);
    });
    it('texto alternativo de la gráfica de capturas', () => {
        expect(resumenCapturas({ filas: [], omitidas: 0 })).toBe('Sin cámaras.');
        expect(resumenCapturas({ filas: [{ camara: 'A-1 · frontal', capturas: 3 }], omitidas: 2 })).toBe('A-1 · frontal: 3. Otras 2 cámaras no se muestran.');
    });
});
