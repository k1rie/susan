import { describe, expect, it } from 'vitest';
import { fijarDesdeInput, formatearFecha, formatearHora, formatearIso, instanteMostrado, leerIso, partesEnZona, valorParaInput } from './relojDemo.utils.js';

const MS = Date.UTC(2026, 8, 14, 13, 12, 0); // 07:12 en -06:00

describe('leerIso', () => {
    it('lee instante y desfase de la zona', () => {
        expect(leerIso('2026-09-14T07:12:00-06:00')).toEqual({ ms: MS, offsetMin: -360 });
        expect(leerIso('2026-09-14T13:12:00Z')).toEqual({ ms: MS, offsetMin: 0 });
        expect(leerIso('2026-09-14T18:42:00+05:30')).toEqual({ ms: MS, offsetMin: 330 });
        expect(leerIso('2026-09-14T07:12:00.250-06:00').ms).toBe(MS + 250);
    });

    it.each(['', 'ayer', '2026-09-14 07:12:00-06:00', '2026-09-14T07:12:00', '2026-09-14T07:12-06:00', null, undefined, 5])('rechaza %j', (iso) => {
        expect(leerIso(iso)).toBeNull();
    });
});

describe('formato', () => {
    it('fecha y hora en espanol, en la zona del servidor', () => {
        const p = partesEnZona(MS, -360);
        expect(formatearFecha(p)).toBe('lun 14 sep 2026');
        expect(formatearHora(p)).toBe('07:12:00');
        expect(formatearHora(p, { segundos: false })).toBe('07:12');
    });

    it('cubre los acentos y los cambios de dia', () => {
        expect(formatearFecha(partesEnZona(Date.UTC(2026, 8, 16, 12, 0, 0), -360))).toBe('mié 16 sep 2026');
        expect(formatearFecha(partesEnZona(Date.UTC(2026, 8, 19, 12, 0, 0), -360))).toBe('sáb 19 sep 2026');
        expect(formatearFecha(partesEnZona(Date.UTC(2026, 11, 31, 5, 59, 0), -360))).toBe('mié 30 dic 2026'); // 23:59 del 30 en la sede
        expect(formatearHora(partesEnZona(Date.UTC(2026, 11, 31, 5, 59, 0), -360))).toBe('23:59:00');
    });
});

describe('formatearIso', () => {
    it('instante + desfase -> ISO con zona (el atributo datetime del <time>)', () => {
        expect(formatearIso(Date.UTC(2026, 8, 14, 13, 12, 4), -360)).toBe('2026-09-14T07:12:04-06:00');
        expect(formatearIso(MS, 330)).toBe('2026-09-14T18:42:00+05:30');
    });

    it('desfase cero -> Z, y cruza el dia segun la zona', () => {
        expect(formatearIso(MS, 0)).toBe('2026-09-14T13:12:00Z');
        expect(formatearIso(Date.UTC(2026, 8, 15, 5, 50, 0), -360)).toBe('2026-09-14T23:50:00-06:00');
    });

    it('ida y vuelta con leerIso (los milisegundos se descartan)', () => {
        const iso = '2026-09-14T07:12:04-06:00';
        const { ms, offsetMin } = leerIso(iso);
        expect(formatearIso(ms + 250, offsetMin)).toBe(iso);
    });
});

describe('valorParaInput y fijarDesdeInput', () => {
    it('el valor del input es la hora de la sede sin segundos', () => {
        expect(valorParaInput('2026-09-14T07:12:30-06:00')).toBe('2026-09-14T07:12');
        expect(valorParaInput('basura')).toBe('');
    });

    it('fijarDesdeInput da el cuerpo del servidor o null', () => {
        expect(fijarDesdeInput('2026-09-14T07:03')).toBe('2026-09-14 07:03');
        expect(fijarDesdeInput('2026-09-14T07:03:30')).toBe('2026-09-14 07:03:30');
        for (const malo of ['', '2026-09-14', '07:03', null, undefined, 5]) expect(fijarDesdeInput(malo)).toBeNull();
    });
});

describe('instanteMostrado', () => {
    const base = { ahora: '2026-09-14T07:12:00-06:00', recibidoEn: 1_000 };

    it('congelado: no suma lo transcurrido', () => {
        expect(instanteMostrado({ ...base, corre: false }, 91_000)).toEqual({ ms: MS, offsetMin: -360 });
    });

    it('corriendo: suma lo transcurrido desde que llego la respuesta', () => {
        expect(instanteMostrado({ ...base, corre: true }, 91_000)).toEqual({ ms: MS + 90_000, offsetMin: -360 });
    });

    it('no retrocede si el reloj del navegador se ajusta hacia atras', () => {
        expect(instanteMostrado({ ...base, corre: true }, 0).ms).toBe(MS);
    });

    it('sin estado o con un ISO ilegible: null', () => {
        expect(instanteMostrado(null, 0)).toBeNull();
        expect(instanteMostrado({ ahora: 'x', corre: true }, 0)).toBeNull();
    });
});
