import { describe, expect, it } from 'vitest';
import { fechaHoraDeInstante, instanteEnMinutos, relojDelNavegador, relojDeRespuesta } from './reloj.utils.js';
import { rotuloEdificio, rotuloGrupo, textoAlumnos } from './rotulos.utils.js';

describe('instanteEnMinutos / fechaHoraDeInstante', () => {
    it('compara fechas y horas del mismo reloj', () => {
        const a = instanteEnMinutos('2026-09-14', '07:12');
        const b = instanteEnMinutos('2026-09-15', '07:12');
        expect(b - a).toBe(24 * 60);
        expect(instanteEnMinutos('2026-09-14', '23:59') < instanteEnMinutos('2026-09-15', '00:00')).toBe(true);
    });

    it('es reversible y cruza meses y años', () => {
        expect(fechaHoraDeInstante(instanteEnMinutos('2026-12-31', '23:30') + 60)).toEqual({ fecha: '2027-01-01', hora: '00:30' });
        expect(fechaHoraDeInstante(instanteEnMinutos('2026-09-14', '07:12'))).toEqual({ fecha: '2026-09-14', hora: '07:12' });
    });

    it('devuelve null con datos inválidos', () => {
        expect(instanteEnMinutos('2026-02-31', '10:00')).toBeNull();
        expect(instanteEnMinutos('2026-09-14', '25:00')).toBeNull();
        expect(instanteEnMinutos(undefined, '10:00')).toBeNull();
    });
});

describe('relojDeRespuesta', () => {
    it('toma fecha y hora de api_ahora y descarta los segundos', () => {
        expect(relojDeRespuesta({ fecha: '2026-09-14', hora: '07:12:45' })).toEqual({ hoy: '2026-09-14', hora: '07:12', delPlantel: true });
        expect(relojDeRespuesta({ fecha: '2026-09-14', hora: '07:12' })).toMatchObject({ hora: '07:12', delPlantel: true });
    });

    it('si la respuesta falta o no sirve cae al reloj del navegador', () => {
        const r = relojDeRespuesta(null);
        expect(r.delPlantel).toBe(false);
        expect(r.hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(r.hora).toMatch(/^\d{2}:\d{2}$/);
        expect(relojDeRespuesta({ fecha: 'x', hora: 'y' }).delPlantel).toBe(false);
    });

    it('relojDelNavegador usa la fecha local', () => {
        expect(relojDelNavegador(new Date(2026, 8, 14, 7, 5))).toEqual({ hoy: '2026-09-14', hora: '07:05' });
    });
});

describe('rótulos', () => {
    it('edificio: antepone la palabra solo si falta', () => {
        expect(rotuloEdificio('C')).toBe('Edificio C');
        expect(rotuloEdificio('Edificio A')).toBe('Edificio A');
        expect(rotuloEdificio('')).toBe('Sin edificio');
    });

    it('alumnos en singular y plural', () => {
        expect(textoAlumnos(1)).toBe('1 alumno');
        expect(textoAlumnos(0)).toBe('0 alumnos');
        expect(textoAlumnos(30)).toBe('30 alumnos');
    });

    it('grupo con materia y clave', () => {
        expect(rotuloGrupo({ materia_nombre: 'Álgebra', clave_grupo: '5C' })).toBe('Álgebra (5C)');
        expect(rotuloGrupo({ materia_clave: 'ALG101', clave_grupo: '5C' })).toBe('ALG101 (5C)');
        expect(rotuloGrupo(null)).toBe('—');
    });
});
