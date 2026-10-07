import { describe, expect, it } from 'vitest';
import { ATAJOS_RANGO, diasDelRango, resolverAtajosRango, resumenDelRango, rangoProximosDias, rangoUltimosDias, validarRango } from './rangoFechas.utils.js';

describe('rangos', () => {
    it('diasDelRango cuenta ambos extremos y rechaza lo inválido o invertido', () => {
        expect(diasDelRango('2026-10-01', '2026-10-01')).toBe(1);
        expect(diasDelRango('2026-10-01', '2026-10-30')).toBe(30);
        expect(diasDelRango('2026-10-30', '2026-10-01')).toBeNull();
        expect(diasDelRango('', '2026-10-01')).toBeNull();
    });

    it('resumenDelRango habla en singular y plural', () => {
        expect(resumenDelRango('2026-10-01', '2026-10-30')).toBe('1 oct 2026 al 30 oct 2026 · 30 días');
        expect(resumenDelRango('2026-10-05', '2026-10-05')).toBe('5 oct 2026 al 5 oct 2026 · 1 día');
        expect(resumenDelRango('2026-10-05', '')).toBe('');
    });

    it('los atajos cuentan hoy como parte del rango', () => {
        expect(rangoUltimosDias(7).valor({ hoy: '2026-10-05' })).toEqual({ desde: '2026-09-29', hasta: '2026-10-05' });
        expect(rangoProximosDias(30).valor({ hoy: '2026-10-05' })).toEqual({ desde: '2026-10-05', hasta: '2026-11-03' });
        expect(ATAJOS_RANGO.map((a) => a.label)).toEqual(['Últimos 7 días', 'Últimos 30 días']);
    });
});

describe('validarRango', () => {
    it('un rango correcto no tiene problemas', () => {
        expect(validarRango({ desde: '2026-10-01', hasta: '2026-10-30' })).toEqual({});
        expect(validarRango({ desde: '', hasta: '' })).toEqual({});
    });

    it('desde posterior a hasta es un problema del rango', () => {
        expect(validarRango({ desde: '2026-10-30', hasta: '2026-10-01' })).toEqual({ rango: 'La fecha inicial debe ser anterior o igual a la final.' });
    });

    it('mismo día es válido', () => {
        expect(validarRango({ desde: '2026-10-01', hasta: '2026-10-01' })).toEqual({});
    });

    it('límites y tope de días', () => {
        expect(validarRango({ desde: '2025-12-31', hasta: '2026-01-05' }, { min: '2026-01-01' }).desde).toBe('La fecha inicial no puede ser anterior al 1 ene 2026.');
        expect(validarRango({ desde: '2026-01-01', hasta: '2026-12-31' }, { max: '2026-06-30' }).hasta).toBe('La fecha final no puede ser posterior al 30 jun 2026.');
        expect(validarRango({ desde: '2026-01-01', hasta: '2027-06-01' }, { maxDias: 366 }).rango).toBe('El rango no puede pasar de 366 días.');
        expect(validarRango({ desde: '2026-01-01', hasta: '2026-12-31' }, { maxDias: 366 })).toEqual({});
    });

    it('requerido pide lo que falte', () => {
        expect(validarRango({ desde: '', hasta: '2026-10-01' }, { requerido: true })).toEqual({ desde: 'Elige la fecha inicial.' });
        expect(validarRango({ desde: '', hasta: '' }, { requerido: true })).toEqual({ desde: 'Elige la fecha inicial.', hasta: 'Elige la fecha final.' });
    });
});

describe('resolverAtajosRango', () => {
    it('oculta los que salen de [min, max]', () => {
        const contexto = { hoy: '2026-10-05', actual: {}, min: '2026-10-01', max: '2026-10-31' };
        expect(resolverAtajosRango(ATAJOS_RANGO, contexto)).toEqual([]);
        expect(resolverAtajosRango([rangoUltimosDias(3)], contexto).map((a) => a.rango)).toEqual([{ desde: '2026-10-03', hasta: '2026-10-05' }]);
    });
});
