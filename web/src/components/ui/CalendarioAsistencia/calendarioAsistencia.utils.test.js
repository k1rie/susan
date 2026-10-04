import { describe, expect, it } from 'vitest';
import { claveEstado, construirCalendario, contarEstados, diaSemana, isoDe, parseFecha, rachaAsistencia } from './calendarioAsistencia.utils.js';

const ses = (fecha, estado = 'presente', extra = {}) => ({ fecha, estado, ...extra });

describe('parseFecha / diaSemana / isoDe', () => {
    it('lee fechas ISO en UTC y rechaza lo que no es una fecha real', () => {
        expect(parseFecha('2026-09-14')).toBe(Date.UTC(2026, 8, 14));
        expect(parseFecha('2026-09-14T10:00:00Z')).toBe(Date.UTC(2026, 8, 14));
        for (const mala of ['2026-02-31', '2026-13-01', 'hola', '', null, undefined, 20260914]) expect(parseFecha(mala)).toBeNull();
    });
    it('el lunes es 0 y el domingo 6', () => {
        expect(diaSemana(parseFecha('2026-09-14'))).toBe(0); // lunes
        expect(diaSemana(parseFecha('2026-09-18'))).toBe(4); // viernes
        expect(diaSemana(parseFecha('2026-09-20'))).toBe(6); // domingo
    });
    it('isoDe es la inversa de parseFecha', () => {
        expect(isoDe(parseFecha('2026-01-05'))).toBe('2026-01-05');
    });
});

describe('claveEstado', () => {
    it('devuelve el estado conocido, sin_registro para null y suspendida por el estatus', () => {
        expect(claveEstado({ estado: 'ausente' })).toBe('ausente');
        expect(claveEstado({ estado: null })).toBe('sin_registro');
        expect(claveEstado({ estado: 'extraño' })).toBe('sin_registro');
        expect(claveEstado({ estado: null, estatus: 'suspendida' })).toBe('suspendida');
        expect(claveEstado({ estado: null, estatus_sesion: 'suspendida' })).toBe('suspendida');
    });
});

describe('construirCalendario', () => {
    it('sin sesiones válidas no hay semanas', () => {
        expect(construirCalendario([])).toMatchObject({ semanas: [], total: 0 });
        expect(construirCalendario(undefined).semanas).toEqual([]);
        expect(construirCalendario([ses('xx')]).semanas).toEqual([]);
    });

    it('arma semanas de lunes a domingo que cubren de la primera a la última sesión', () => {
        const { semanas, filas, total } = construirCalendario([ses('2026-09-16'), ses('2026-09-23'), ses('2026-09-30')]);
        expect(semanas).toHaveLength(3); // mié 16 -> semana del lunes 14; mié 30 -> semana del lunes 28
        expect(semanas[0].dias[0].fecha).toBe('2026-09-14');
        expect(semanas[2].dias[6].fecha).toBe('2026-10-04');
        expect(filas).toEqual([0, 1, 2, 3, 4]);
        expect(total).toBe(3);
        expect(semanas[0].dias[2]).toMatchObject({ fecha: '2026-09-16', clave: 'presente' });
        expect(semanas[0].dias[3].clave).toBeNull();
    });

    it('las filas incluyen sábado y domingo solo si alguna sesión cae en ellos', () => {
        expect(construirCalendario([ses('2026-09-19')]).filas).toEqual([0, 1, 2, 3, 4, 5]);
        expect(construirCalendario([ses('2026-09-20')]).filas).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('dos sesiones el mismo día se muestran con el estado más grave', () => {
        const { semanas } = construirCalendario([ses('2026-09-14', 'presente'), ses('2026-09-14', 'ausente')]);
        expect(semanas[0].dias[0].clave).toBe('ausente');
        const otra = construirCalendario([ses('2026-09-14', 'retardo'), ses('2026-09-14', 'presente')]);
        expect(otra.semanas[0].dias[0].clave).toBe('retardo');
    });

    it('con más semanas que el máximo muestra las más recientes y lo avisa', () => {
        const sesiones = [ses('2026-01-05'), ses('2026-09-14')];
        const { semanas, recortado, total } = construirCalendario(sesiones, { maxSemanas: 10 });
        expect(semanas).toHaveLength(10);
        expect(recortado).toBe(true);
        expect(total).toBe(1); // la de enero ya no cabe
        expect(semanas[9].dias.some((d) => d.fecha === '2026-09-14')).toBe(true);
        expect(construirCalendario(sesiones, { maxSemanas: 100 }).recortado).toBe(false);
    });

    it('rotula el primer lunes de cada mes y salta etiquetas pegadas a la anterior', () => {
        const { meses } = construirCalendario([ses('2026-09-01'), ses('2026-11-30')]);
        // la primera semana empieza el lunes 31 de agosto: «ago» ocupa una sola columna y cede su etiqueta a «sep»
        expect(meses.map((m) => m.etiqueta)).toEqual(['sep', 'oct', 'nov']);
        const pegadas = construirCalendario([ses('2026-08-31'), ses('2026-09-30')]);
        const semanas = pegadas.meses.map((m) => m.semana);
        for (let i = 1; i < semanas.length; i += 1) expect(semanas[i] - semanas[i - 1]).toBeGreaterThanOrEqual(3);
    });

    it('entiende los items de api_alumno_historial (estatus_sesion)', () => {
        const { semanas } = construirCalendario([{ fecha: '2026-09-14', estado: null, estatus_sesion: 'suspendida' }]);
        expect(semanas[0].dias[0].clave).toBe('suspendida');
    });
});

describe('contarEstados', () => {
    it('cuenta por estado las sesiones válidas (una por día)', () => {
        expect(contarEstados([ses('2026-09-14'), ses('2026-09-15', 'ausente'), ses('2026-09-16'), ses('mala'), ses('2026-09-17', null)])).toEqual({ presente: 2, ausente: 1, sin_registro: 1 });
    });
});

describe('rachaAsistencia', () => {
    it('cuenta las sesiones seguidas con asistencia desde la más reciente y la mejor del periodo', () => {
        const s = [ses('2026-09-14'), ses('2026-09-15'), ses('2026-09-16', 'ausente'), ses('2026-09-17'), ses('2026-09-18', 'retardo')];
        expect(rachaAsistencia(s)).toEqual({ actual: 2, mejor: 2 });
    });
    it('no depende del orden del arreglo', () => {
        const s = [ses('2026-09-18', 'retardo'), ses('2026-09-14'), ses('2026-09-16', 'ausente'), ses('2026-09-15'), ses('2026-09-17')];
        expect(rachaAsistencia(s)).toEqual({ actual: 2, mejor: 2 });
    });
    it('una falta reciente deja la racha actual en 0 pero conserva la mejor', () => {
        const s = [ses('2026-09-14'), ses('2026-09-15'), ses('2026-09-16'), ses('2026-09-17', 'ausente')];
        expect(rachaAsistencia(s)).toEqual({ actual: 0, mejor: 3 });
    });
    it('justificadas, pendientes y suspendidas ni cuentan ni cortan', () => {
        const s = [ses('2026-09-14'), ses('2026-09-15', 'justificado'), ses('2026-09-16', 'pendiente'), ses('2026-09-17', null, { estatus: 'suspendida' }), ses('2026-09-18')];
        expect(rachaAsistencia(s)).toEqual({ actual: 2, mejor: 2 });
    });
    it('una sesión cerrada sin registro es falta; una abierta sin registro no corta', () => {
        expect(rachaAsistencia([ses('2026-09-14'), ses('2026-09-15', null, { estatus_sesion: 'cerrada' })])).toEqual({ actual: 0, mejor: 1 });
        expect(rachaAsistencia([ses('2026-09-14'), ses('2026-09-15', null, { estatus_sesion: 'abierta' })])).toEqual({ actual: 1, mejor: 1 });
    });
    it('sin sesiones válidas la racha es 0', () => {
        expect(rachaAsistencia([])).toEqual({ actual: 0, mejor: 0 });
        expect(rachaAsistencia([ses('mala')])).toEqual({ actual: 0, mejor: 0 });
        expect(rachaAsistencia(undefined)).toEqual({ actual: 0, mejor: 0 });
    });
});
