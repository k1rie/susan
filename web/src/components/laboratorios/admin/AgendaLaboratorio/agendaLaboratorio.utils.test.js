import { describe, expect, it } from 'vitest';
import { agruparPorDia, esSemanaActual, etiquetaSemana, rangoSemana, resumenSemana, tipoDeBloque } from './agendaLaboratorio.utils.js';

const clase = { tipo: 'clase', estatus: null, fecha: '2026-09-14', hora_inicio: '07:00', hora_fin: '09:00' };
const aprobada = { tipo: 'solicitud', estatus: 'aprobada', fecha: '2026-09-16', hora_inicio: '10:00', hora_fin: '12:00' };
const pendiente = { tipo: 'solicitud', estatus: 'pendiente', fecha: '2026-09-16', hora_inicio: '12:00', hora_fin: '13:00' };

describe('tipoDeBloque', () => {
    it('distingue clase, solicitud aprobada y solicitud pendiente', () => {
        expect(tipoDeBloque(clase)).toBe('clase');
        expect(tipoDeBloque(aprobada)).toBe('aprobada');
        expect(tipoDeBloque(pendiente)).toBe('pendiente');
    });
});

describe('semana', () => {
    it('rangoSemana va de lunes a domingo (7 días, bajo el máximo de 42 de la RPC)', () => {
        expect(rangoSemana('2026-09-14')).toEqual({ desde: '2026-09-14', hasta: '2026-09-20' });
        expect(rangoSemana('2026-12-28')).toEqual({ desde: '2026-12-28', hasta: '2027-01-03' });
    });

    it('etiquetaSemana escribe el rango y agrega el año solo cuando no es el actual', () => {
        expect(etiquetaSemana('2026-09-14', '2026-09-15')).toBe('Semana del lun 14 sep al dom 20 sep');
        expect(etiquetaSemana('2026-12-28', '2026-12-30')).toBe('Semana del lun 28 dic al dom 3 ene 2027');
    });

    it('esSemanaActual compara con el lunes de hoy', () => {
        expect(esSemanaActual('2026-09-14', '2026-09-20')).toBe(true);
        expect(esSemanaActual('2026-09-14', '2026-09-21')).toBe(false);
        expect(esSemanaActual('2026-09-14', null)).toBe(false);
    });
});

describe('agruparPorDia', () => {
    it('devuelve siete días aunque no haya bloques, y reparte cada bloque en su fecha', () => {
        const dias = agruparPorDia([clase, aprobada, pendiente], '2026-09-14');
        expect(dias.map((d) => d.fecha)).toEqual([
            '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20',
        ]);
        expect(dias[0].bloques).toEqual([clase]);
        expect(dias[1].bloques).toEqual([]);
        expect(dias[2].bloques).toEqual([aprobada, pendiente]);
        expect(agruparPorDia(null, '2026-09-14').every((d) => d.bloques.length === 0)).toBe(true);
    });
});

describe('resumenSemana', () => {
    it('cuenta por tipo con singular y plural', () => {
        expect(resumenSemana([clase, clase, aprobada, pendiente])).toBe('2 clases · 1 solicitud aprobada · 1 solicitud pendiente');
        expect(resumenSemana([clase])).toBe('1 clase');
        expect(resumenSemana([])).toBe('Sin ocupación esta semana');
    });
});
