import { describe, expect, it } from 'vitest';
import { fechaCorta, metaCaso, normalizarCaso, normalizarPestana, siguienteCaso, unirListas, urlRevision } from './colaRevision.utils.js';

const L = (...ids) => ids.map((id) => ({ id_asistencia: id }));

describe('colaRevision.utils', () => {
    it('normaliza pestaña y caso de los deep links', () => {
        expect(normalizarPestana('justificantes')).toBe('justificantes');
        expect(normalizarPestana('x')).toBe('pendientes');
        expect(normalizarCaso('12')).toBe(12);
        expect(normalizarCaso('abc')).toBeNull();
    });
    it('selecciona el siguiente caso tras resolver', () => {
        expect(siguienteCaso('pendientes', L(1, 2, 3), 2, L(1, 3))).toBe(3);
        expect(siguienteCaso('pendientes', L(1, 2, 3), 3, L(1, 2))).toBe(1);
        expect(siguienteCaso('pendientes', L(1), 1, [])).toBeNull();
    });
    it('une listas sin duplicados y arma la URL', () => {
        expect(unirListas('pendientes', L(1, 2), L(2, 3)).map((i) => i.id_asistencia)).toEqual([1, 2, 3]);
        expect(urlRevision('/docente/revision', 'justificantes', 5)).toBe('/docente/revision?pestana=justificantes&caso=5');
        expect(urlRevision('/docente/revision', 'pendientes', null)).toBe('/docente/revision?pestana=pendientes');
    });
    it('da fecha corta y una sola línea de meta', () => {
        expect(fechaCorta('2026-09-14')).toBe('14 sep');
        expect(fechaCorta('')).toBe('-');
        expect(fechaCorta(undefined)).toBe('-');
        const caso = { materia: { nombre: 'Finanzas' }, grupo: { clave_grupo: '3A' }, sesion: { fecha: '2026-09-14', hora_inicio: '07:00:00' } };
        expect(metaCaso(caso)).toBe('Finanzas · 3A · 14 sep 07:00');
        expect(metaCaso({})).toBe('- · - · -');
    });
});
