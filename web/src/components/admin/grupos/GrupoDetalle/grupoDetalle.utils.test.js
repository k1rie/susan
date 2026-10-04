import { describe, expect, it } from 'vitest';
import { APOYO_BAJAS, apoyoSesiones, tarjetaCerradas, tarjetaInscritos } from './grupoDetalle.utils.js';

describe('tarjetaInscritos', () => {
    it('con cupo lee la cifra frente a la capacidad (unidad «/ N») y no pinta alerta', () => {
        expect(tarjetaInscritos({ activos: 24, baja: 1, capacidad_aula: 45 })).toEqual({ value: 24, unit: '/ 45', hint: 'Capacidad del aula', tone: 'neutral' });
    });
    it('aula llena = ámbar y sobre la capacidad = rojo, siempre dicho en texto', () => {
        expect(tarjetaInscritos({ activos: 40, capacidad_aula: 40 })).toMatchObject({ tone: 'warning', hint: 'Aula llena' });
        expect(tarjetaInscritos({ activos: 41, capacidad_aula: 40 })).toMatchObject({ tone: 'danger', hint: 'Sobre la capacidad' });
    });
    it('sin capacidad conocida no inventa una unidad y lo dice en el apoyo', () => {
        for (const capacidad_aula of [undefined, null, 0, 'x']) {
            expect(tarjetaInscritos({ activos: 5, capacidad_aula })).toEqual({ value: 5, unit: undefined, hint: 'Sin capacidad registrada', tone: 'neutral' });
        }
        expect(tarjetaInscritos(undefined)).toEqual({ value: 0, unit: undefined, hint: 'Sin capacidad registrada', tone: 'neutral' });
    });
});

describe('tarjetaCerradas', () => {
    it('muestra las cerradas frente al total de sesiones y qué porcentaje son', () => {
        expect(tarjetaCerradas({ total: 40, cerradas: 12 })).toEqual({ value: 12, unit: '/ 40', hint: '30 % del total' });
        expect(tarjetaCerradas({ total: 3, cerradas: 1 })).toMatchObject({ hint: '33 % del total' });
    });
    it('sin sesiones deja solo el 0 y lo dice', () => {
        expect(tarjetaCerradas({ total: 0, cerradas: 0 })).toEqual({ value: 0, unit: undefined, hint: 'Sin sesiones aún' });
        expect(tarjetaCerradas(undefined)).toEqual({ value: 0, unit: undefined, hint: 'Sin sesiones aún' });
    });
});

describe('apoyoSesiones', () => {
    it('cuenta las programadas con su singular', () => {
        expect(apoyoSesiones({ programadas: 1 })).toBe('1 programada');
        expect(apoyoSesiones({ programadas: 8 })).toBe('8 programadas');
        expect(apoyoSesiones(undefined)).toBe('0 programadas');
    });
});

describe('APOYO_BAJAS', () => {
    it('aclara que las bajas no cuentan en el cupo', () => {
        expect(APOYO_BAJAS).toBe('Fuera del cupo');
    });
});
