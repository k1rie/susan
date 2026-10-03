import { describe, expect, it } from 'vitest';
import { PESOS_RIESGO, diaSemanaISO, evaluarRiesgoAlumno, evaluarRiesgoGrupo, resumirAsistencia } from './index.js';

const ctx = { sesionesProgramadas: 10, limitePct: 20, retardosPorAusencia: 3 };
const rep = (e, n) => new Array(n).fill(e);

describe('riesgo por alumno', () => {
    it('los pesos suman 100', () => {
        expect(Object.values(PESOS_RIESGO).reduce((s, v) => s + v, 0)).toBe(100);
    });

    it('asistencia perfecta: puntaje 0, nivel bajo', () => {
        const r = evaluarRiesgoAlumno({ nombre: 'Ana', estados: rep('presente', 8) }, ctx);
        expect(r.puntaje).toBe(0);
        expect(r.nivel).toBe('bajo');
        expect(r.faltasEq).toBe(0);
        expect(r.factores.length).toBe(7);
    });

    it('faltas consecutivas al final y superación del límite -> alto con acción explicativa', () => {
        const estados = [...rep('presente', 5), ...rep('ausente', 3)];
        const r = evaluarRiesgoAlumno({ nombre: 'Beto', estados }, ctx);
        expect(r.faltasEq).toBe(3);
        expect(r.superaLimite).toBe(true); // 3/10 = 30 % > 20 %
        expect(r.nivel).toBe('alto');
        expect(r.factores.find((f) => f.id === 'faltasConsecutivas').valor).toBe(3);
        expect(r.factores.find((f) => f.id === 'pendienteReciente').aporte).toBeGreaterThan(0);
        expect(r.accion).toMatch(/superó el límite/);
        expect(r.puntaje).toBeCloseTo(r.factores.reduce((s, f) => s + f.aporte, 0), 6);
        r.factores.forEach((f) => expect(f.aporte).toBeLessThanOrEqual(f.maximo));
    });

    it('exactamente el 20 % conserva el derecho (RN-11)', () => {
        const estados = ['ausente', 'ausente', ...rep('presente', 6)];
        const r = evaluarRiesgoAlumno({ estados }, ctx);
        expect(r.porcentajeFaltas).toBe(20);
        expect(r.superaLimite).toBe(false);
        expect(r.faltasRestantes).toBe(0);
    });

    it('3 retardos equivalen a 1 falta; justificados y pendientes no cuentan', () => {
        const res = resumirAsistencia(['retardo', 'retardo', 'retardo', 'justificado', 'pendiente', null], 3);
        expect(res.faltasEq).toBe(1);
        expect(res.registradas).toBe(5);
    });

    it('la concentración por día requiere >= 3 ausencias', () => {
        const estados = ['ausente', 'presente', 'ausente', 'presente', 'ausente', 'presente'];
        const diasSemana = [2, 3, 2, 3, 2, 3];
        const r = evaluarRiesgoAlumno({ estados }, { ...ctx, diasSemana });
        const f = r.factores.find((x) => x.id === 'concentracionDia');
        expect(f.valor).toBe(100);
        expect(f.explicacion).toMatch(/martes/);
        const sin = evaluarRiesgoAlumno({ estados: estados.slice(0, 3) }, { ...ctx, diasSemana });
        expect(sin.factores.find((x) => x.id === 'concentracionDia').valor).toBeNull();
    });

    it('estima la semana de cruce con el ritmo propio', () => {
        const estados = ['ausente', 'presente', 'presente', 'ausente', 'presente', 'presente'];
        const r = evaluarRiesgoAlumno({ estados }, { sesionesProgramadas: 30, limitePct: 20, sesionesPorSemana: 2, semanaActual: 3 });
        // ritmo = 2/6; límite = 6 faltas; quedan (6-2)/(1/3)=12 sesiones -> 6 semanas
        expect(r.sesionesParaCruce).toBeCloseTo(12, 9);
        expect(r.semanaCruceEstimada).toBe(9);
    });

    it('tolera estados vacíos y valida la entrada', () => {
        expect(evaluarRiesgoAlumno({ estados: [] }, ctx).puntaje).toBe(0);
        expect(() => evaluarRiesgoAlumno({}, ctx)).toThrow(TypeError);
        expect(() => evaluarRiesgoAlumno({ estados: [] }, { ...ctx, limitePct: 0 })).toThrow(RangeError);
    });
});

describe('riesgo del grupo', () => {
    it('ordena por puntaje y usa el z-score del grupo', () => {
        const alumnos = [
            { nombre: 'A', estados: rep('presente', 8) },
            { nombre: 'B', estados: [...rep('presente', 4), ...rep('ausente', 4)] },
            { nombre: 'C', estados: [...rep('presente', 7), 'ausente'] },
            { nombre: 'D', estados: rep('presente', 8) },
        ];
        const r = evaluarRiesgoGrupo(alumnos, ctx);
        expect(r[0].nombre).toBe('B');
        expect(r[0].factores.find((f) => f.id === 'zScoreGrupo').valor).toBeGreaterThan(1);
        expect(r.at(-1).puntaje).toBe(0);
        expect(() => evaluarRiesgoGrupo('x', ctx)).toThrow(TypeError);
    });
});

describe('diaSemanaISO', () => {
    it('calcula el día sin depender del reloj', () => {
        expect(diaSemanaISO('2026-08-17')).toBe(1);
        expect(diaSemanaISO('2026-08-23')).toBe(7);
        expect(diaSemanaISO('basura')).toBeNull();
    });
});
