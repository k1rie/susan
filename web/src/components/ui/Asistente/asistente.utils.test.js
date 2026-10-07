import { describe, expect, it } from 'vitest';
import { estadoPaso, normalizarSecciones, pasosParaStepper, resultadoDeValidacion, textoValor } from './asistente.utils.js';

describe('resultadoDeValidacion', () => {
    it('true, undefined, null y objetos vacíos son válidos', () => {
        for (const r of [true, undefined, null, {}, { a: '', b: undefined }, '  ']) expect(resultadoDeValidacion(r).ok).toBe(true);
    });
    it('false, texto y objeto con mensajes son inválidos y conservan los mensajes', () => {
        expect(resultadoDeValidacion(false)).toEqual({ ok: false, mensajes: [] });
        expect(resultadoDeValidacion('Falta algo')).toEqual({ ok: false, mensajes: ['Falta algo'] });
        expect(resultadoDeValidacion({ a: 'Falta A', b: '', c: 'Falta C' })).toEqual({ ok: false, mensajes: ['Falta A', 'Falta C'] });
    });
});

describe('estadoPaso / pasosParaStepper', () => {
    it('actual, hecho (visitado), omitido y pendiente', () => {
        expect(estadoPaso(1, 1, 2, false)).toBe('actual');
        expect(estadoPaso(0, 1, 2, false)).toBe('hecho');
        expect(estadoPaso(2, 1, 2, false)).toBe('hecho');
        expect(estadoPaso(0, 1, 2, true)).toBe('omitido');
        expect(estadoPaso(3, 1, 2, false)).toBe('pendiente');
    });
    it('agrega el paso de revisión al final solo si hay resumen', () => {
        const pasos = [{ id: 'a', titulo: 'A' }, { id: 'b', titulo: 'B', descripcion: 'desc' }];
        const sin = pasosParaStepper(pasos, false, { indice: 0, maxAlcanzado: 0, omitidos: new Set() });
        expect(sin.map((p) => p.id)).toEqual(['a', 'b']);
        const con = pasosParaStepper(pasos, true, { indice: 0, maxAlcanzado: 0, omitidos: new Set(['b']), tituloRevision: 'Revisar' });
        expect(con.map((p) => p.label)).toEqual(['A', 'B', 'Revisar']);
        expect(con.map((p) => p.estado)).toEqual(['actual', 'pendiente', 'pendiente']);
    });
});

describe('textoValor / normalizarSecciones', () => {
    it('lo vacío es null y lo demás se escribe', () => {
        expect(textoValor('')).toBeNull();
        expect(textoValor(null)).toBeNull();
        expect(textoValor([])).toBeNull();
        expect(textoValor(true)).toBe('Sí');
        expect(textoValor(false)).toBe('No');
        expect(textoValor(0)).toBe('0');
        expect(textoValor(['Lun', 'Mié'])).toBe('Lun, Mié');
    });
    it('tolera secciones incompletas', () => {
        expect(normalizarSecciones(undefined)).toEqual([]);
        expect(normalizarSecciones([null, { titulo: 'A' }, { id: 'x', titulo: 'B', paso: 'p', filas: [{ etiqueta: 'e', valor: 1 }] }])).toEqual([
            { id: 'seccion-0', titulo: 'A', paso: undefined, filas: [] },
            { id: 'x', titulo: 'B', paso: 'p', filas: [{ etiqueta: 'e', valor: 1 }] },
        ]);
    });
});
