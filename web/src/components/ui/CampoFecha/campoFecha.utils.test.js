import { describe, expect, it } from 'vitest';
import { ATAJO_HOY, dentroDelIntervalo, resolverAtajos, validarFecha } from './campoFecha.utils.js';

describe('resolverAtajos', () => {
    const contexto = { actual: '2026-08-01', hoy: '2026-10-05' };

    it('acepta fechas fijas y funciones con { actual, hoy }', () => {
        const r = resolverAtajos([ATAJO_HOY, { label: 'Fin de año', valor: '2026-12-31' }, { label: 'Mismo día', valor: ({ actual }) => actual }], contexto);
        expect(r).toEqual([
            { label: 'Hoy', fecha: '2026-10-05' },
            { label: 'Fin de año', fecha: '2026-12-31' },
            { label: 'Mismo día', fecha: '2026-08-01' },
        ]);
    });

    it('oculta los que dan una fecha inválida o fuera de min/max', () => {
        const atajos = [
            { label: 'Rota', valor: () => '' },
            { label: 'Imposible', valor: '2026-02-30' },
            { label: 'Pasada', valor: '2020-01-01' },
            { label: 'Futura', valor: '2030-01-01' },
            { label: 'Bien', valor: '2026-10-01' },
        ];
        expect(resolverAtajos(atajos, { ...contexto, min: '2026-01-01', max: '2026-12-31' }).map((a) => a.label)).toEqual(['Bien']);
    });

    it('sin atajos devuelve una lista vacía', () => {
        expect(resolverAtajos(undefined, contexto)).toEqual([]);
    });
});

describe('dentroDelIntervalo y validarFecha', () => {
    it('los extremos son inclusivos y los vacíos no acotan', () => {
        expect(dentroDelIntervalo('2026-10-05', { min: '2026-10-05', max: '2026-10-05' })).toBe(true);
        expect(dentroDelIntervalo('2026-10-04', { min: '2026-10-05' })).toBe(false);
        expect(dentroDelIntervalo('2026-10-06', { max: '2026-10-05' })).toBe(false);
        expect(dentroDelIntervalo('2026-10-06', {})).toBe(true);
    });

    it('validarFecha da el mensaje en español o null', () => {
        expect(validarFecha('')).toBeNull();
        expect(validarFecha('', { requerida: true })).toBe('Elige una fecha.');
        expect(validarFecha('2026-13-01')).toBe('Escribe una fecha válida.');
        expect(validarFecha('2025-01-01', { min: '2026-01-01' })).toBe('La fecha no puede ser anterior al 1 ene 2026.');
        expect(validarFecha('2027-01-01', { max: '2026-12-31' })).toBe('La fecha no puede ser posterior al 31 dic 2026.');
        expect(validarFecha('2026-06-01', { min: '2026-01-01', max: '2026-12-31' })).toBeNull();
    });
});
