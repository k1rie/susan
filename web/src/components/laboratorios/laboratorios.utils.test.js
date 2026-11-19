import { describe, expect, it } from 'vitest';
import {
    duracionTexto, estatusVisible, fechaDeIso, formatoFechaCorta, lunesDeSemana, minutosDeHora, rangoHoras, sumarDias,
} from './laboratorios.utils.js';

describe('estatusVisible', () => {
    it('solo la pendiente vencida cambia a «vencida»', () => {
        expect(estatusVisible({ estatus: 'pendiente', vencida: true })).toBe('vencida');
        expect(estatusVisible({ estatus: 'pendiente', vencida: false })).toBe('pendiente');
        expect(estatusVisible({ estatus: 'aprobada', vencida: true })).toBe('aprobada');
        expect(estatusVisible(null)).toBe('pendiente');
    });
});

describe('fechas', () => {
    it('fechaDeIso valida el calendario', () => {
        expect(fechaDeIso('2026-09-16').getDate()).toBe(16);
        expect(fechaDeIso('2026-02-31')).toBeNull();
        expect(fechaDeIso('16/09/2026')).toBeNull();
        expect(fechaDeIso(null)).toBeNull();
    });

    it('formatoFechaCorta no depende de la zona horaria y agrega el año si no es el actual', () => {
        expect(formatoFechaCorta('2026-09-16')).toBe('mié 16 sep');
        expect(formatoFechaCorta('2026-09-16', '2026-09-14')).toBe('mié 16 sep');
        expect(formatoFechaCorta('2027-01-04', '2026-12-30')).toBe('lun 4 ene 2027');
        expect(formatoFechaCorta('basura')).toBe('—');
    });

    it('sumarDias y lunesDeSemana cruzan meses y años', () => {
        expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01');
        expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
        expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
        expect(lunesDeSemana('2026-09-16')).toBe('2026-09-14');
        expect(lunesDeSemana('2026-09-14')).toBe('2026-09-14');
        expect(lunesDeSemana('2026-09-20')).toBe('2026-09-14');
        expect(lunesDeSemana('2027-01-01')).toBe('2026-12-28');
    });
});

describe('horas', () => {
    it('rangoHoras y minutosDeHora', () => {
        expect(rangoHoras('10:00', '12:00')).toBe('10:00 – 12:00');
        expect(minutosDeHora('07:30')).toBe(450);
        expect(minutosDeHora('24:00')).toBeNull();
        expect(minutosDeHora('9:00')).toBeNull();
    });

    it('duracionTexto', () => {
        expect(duracionTexto('10:00', '12:00')).toBe('2 h');
        expect(duracionTexto('10:00', '11:30')).toBe('1 h 30 min');
        expect(duracionTexto('10:00', '10:45')).toBe('45 min');
        expect(duracionTexto('12:00', '10:00')).toBeNull();
        expect(duracionTexto('x', '10:00')).toBeNull();
    });
});
