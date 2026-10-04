import { describe, expect, it } from 'vitest';
import {
    acortar, alumnosFueraDelTop, centroAsistencia, centroAnilloGrupo, distribucionAsistencia, dominioFaltas, estadoAlumnosPorGrupo, gruposConAsistencia,
    indicadoresPeriodo, limiteFaltas, MAX_ETIQUETA_ALUMNO, MAX_ETIQUETA_GRUPO, resumenSerie, resumenSituacionGrupos, serieAsistenciaGrupos, topFaltasAlumnos, umbralAsistencia,
} from './reporteGraficas.utils.js';

const alumno = (o) => ({ id_alumno: 1, matricula: 'E1', nombres: 'Ana María', apellido_paterno: 'Pérez', nombre_completo: 'Ana María Pérez Ruiz',
    presentes: 5, retardos: 1, ausencias: 2, justificadas: 1, pendientes: 0, faltas_equivalentes: 2.33, porcentaje_faltas: 5, ...o });

describe('limiteFaltas y umbralAsistencia', () => {
    it('toma limite_pct del reporte y cae a 20', () => {
        expect(limiteFaltas({ limite_pct: 25 })).toBe(25);
        expect(limiteFaltas({})).toBe(20);
        expect(limiteFaltas(null)).toBe(20);
        expect(limiteFaltas({ limite_pct: 0 })).toBe(20);
        expect(limiteFaltas({ limite_pct: 'x' })).toBe(20);
    });
    it('la asistencia mínima es el complemento y no existe sin límite en los datos', () => {
        expect(umbralAsistencia({ limite_pct: 20 })).toBe(80);
        expect(umbralAsistencia({})).toBeNull();
        expect(umbralAsistencia({ limite_pct: 100 })).toBeNull();
    });
});

describe('distribucionAsistencia', () => {
    it('suma los estados de todos los alumnos', () => {
        const d = distribucionAsistencia([alumno({}), alumno({ id_alumno: 2, presentes: 3, retardos: 0, ausencias: 4, justificadas: 0, pendientes: 2 })]);
        expect(d).toEqual([
            { clave: 'presente', valor: 8 }, { clave: 'retardo', valor: 1 }, { clave: 'ausente', valor: 6 },
            { clave: 'justificado', valor: 1 }, { clave: 'pendiente', valor: 2 },
        ]);
    });
    it('sin alumnos o con campos nulos devuelve ceros (el anillo muestra su aviso)', () => {
        expect(distribucionAsistencia([]).every((d) => d.valor === 0)).toBe(true);
        expect(distribucionAsistencia(undefined)).toHaveLength(5);
        expect(distribucionAsistencia([{ presentes: null, retardos: undefined }]).every((d) => d.valor === 0)).toBe(true);
    });
});

describe('centroAsistencia', () => {
    it('redondea el promedio y es undefined sin dato', () => {
        expect(centroAsistencia(82.35)).toEqual({ valor: '82 %', etiqueta: 'Asistencia' });
        expect(centroAsistencia(0)).toEqual({ valor: '0 %', etiqueta: 'Asistencia' });
        expect(centroAsistencia(null)).toBeUndefined();
        expect(centroAsistencia(undefined)).toBeUndefined();
    });
});

describe('centroAnilloGrupo', () => {
    it('muestra la asistencia del grupo solo cuando el anillo grafica al grupo completo', () => {
        expect(centroAnilloGrupo({ asistenciaPromedio: 82.35 })).toEqual({ valor: '82 %', etiqueta: 'Asistencia' });
        expect(centroAnilloGrupo({ asistenciaPromedio: null })).toBeUndefined();
    });
    it('con un alumno seleccionado no pone la cifra del grupo (el anillo muestra el total de registros)', () => {
        expect(centroAnilloGrupo({ asistenciaPromedio: 82.35, deAlumno: true })).toBeUndefined();
    });
    it('sin sesiones programadas no hay centro', () => {
        expect(centroAnilloGrupo({ asistenciaPromedio: 82.35, sinSesiones: true })).toBeUndefined();
        expect(centroAnilloGrupo()).toBeUndefined();
    });
});

describe('topFaltasAlumnos', () => {
    const muchos = Array.from({ length: 12 }, (_, i) => alumno({ id_alumno: i + 1, matricula: `E${i + 1}`, nombres: `N${i}`, apellido_paterno: 'X', porcentaje_faltas: i * 2 }));
    it('devuelve los N con mayor porcentaje, de mayor a menor', () => {
        const top = topFaltasAlumnos(muchos, 8);
        expect(top).toHaveLength(8);
        expect(top[0]).toMatchObject({ id_alumno: 12, faltas: 22 });
        expect(top[7].faltas).toBe(8);
        expect(top.map((t) => t.faltas)).toEqual([...top.map((t) => t.faltas)].sort((a, b) => b - a));
        expect(alumnosFueraDelTop(muchos, 8)).toBe(4);
    });
    it('con menos alumnos que N devuelve todos; sin alumnos, vacío', () => {
        expect(topFaltasAlumnos([alumno({})], 8)).toHaveLength(1);
        expect(topFaltasAlumnos([], 8)).toEqual([]);
        expect(topFaltasAlumnos(undefined)).toEqual([]);
        expect(alumnosFueraDelTop([alumno({})], 8)).toBe(0);
    });
    it('ignora filas sin porcentaje (grupo sin sesiones) pero conserva el 0', () => {
        const top = topFaltasAlumnos([alumno({ porcentaje_faltas: null }), alumno({ id_alumno: 2, matricula: 'E2', nombres: 'Luis', porcentaje_faltas: 0 })]);
        expect(top).toHaveLength(1);
        expect(top[0].faltas).toBe(0);
    });
    it('etiqueta con primer nombre y apellido paterno; distingue homónimos con la matrícula', () => {
        expect(topFaltasAlumnos([alumno({})])[0].alumno).toBe('Ana Pérez');
        const dup = topFaltasAlumnos([alumno({}), alumno({ id_alumno: 2, matricula: 'E2', porcentaje_faltas: 9 })]);
        expect(dup.map((d) => d.alumno)).toEqual(['Ana Pérez (E2)', 'Ana Pérez (E1)']);
    });
    it('desempata por faltas equivalentes y redondea a 2 decimales', () => {
        const top = topFaltasAlumnos([
            alumno({ id_alumno: 1, nombres: 'Ana', porcentaje_faltas: 10.456, faltas_equivalentes: 4 }),
            alumno({ id_alumno: 2, matricula: 'E2', nombres: 'Beto', porcentaje_faltas: 10.456, faltas_equivalentes: 5 }),
        ]);
        expect(top[0].id_alumno).toBe(2);
        expect(top[0].faltas).toBe(10.46);
    });
    it('sin nombres usa el nombre completo acortado', () => {
        const t = topFaltasAlumnos([{ id_alumno: 1, matricula: 'E1', nombre_completo: 'Nombre Larguísimo De Prueba Completo', porcentaje_faltas: 3 }]);
        expect(t[0].alumno.length).toBeLessThanOrEqual(MAX_ETIQUETA_ALUMNO);
        expect(t[0].alumno.endsWith('…')).toBe(true);
    });
});

describe('dominioFaltas', () => {
    it('siempre deja ver el límite (+25 %) y el mayor valor, en múltiplos de 5', () => {
        expect(dominioFaltas([], 20)).toEqual([0, 25]);
        expect(dominioFaltas([{ faltas: 3 }], 20)).toEqual([0, 25]);
        expect(dominioFaltas([{ faltas: 31.2 }], 20)).toEqual([0, 35]);
    });
});

const periodo = [
    { id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Finanzas', inscritos: 30, alumnos_en_limite: 3, alumnos_sin_derecho: 2, asistencia_promedio: 90 },
    { id_grupo: 2, clave_grupo: '5C', materia_nombre: 'Contabilidad de Costos Avanzada', inscritos: 10, alumnos_en_limite: 0, alumnos_sin_derecho: 0, asistencia_promedio: 70 },
    { id_grupo: 3, clave_grupo: '1B', materia_nombre: 'Derecho', inscritos: 0, alumnos_en_limite: 0, alumnos_sin_derecho: 0, asistencia_promedio: null },
];

describe('serieAsistenciaGrupos', () => {
    it('ordena de peor a mejor y omite grupos sin dato', () => {
        const s = serieAsistenciaGrupos(periodo);
        expect(s.map((x) => x.asistencia)).toEqual([70, 90]);
        expect(s[1].grupo).toBe('3A · Finanzas');
        expect(s[0].grupo.length).toBeLessThanOrEqual(MAX_ETIQUETA_GRUPO);
        expect(s[0].grupo.endsWith('…')).toBe(true);
        expect(gruposConAsistencia(periodo)).toBe(2);
    });
    it('limita a N y maneja vacío', () => {
        expect(serieAsistenciaGrupos(periodo, 1)).toHaveLength(1);
        expect(serieAsistenciaGrupos([])).toEqual([]);
        expect(serieAsistenciaGrupos(undefined)).toEqual([]);
        expect(serieAsistenciaGrupos([{ clave_grupo: 'X', asistencia_promedio: 0 }])[0].asistencia).toBe(0);
    });
    it('distingue grupos con la misma etiqueta', () => {
        const s = serieAsistenciaGrupos([{ clave_grupo: '3A', materia_nombre: 'M', asistencia_promedio: 80 }, { clave_grupo: '3A', materia_nombre: 'M', asistencia_promedio: 85 }]);
        expect(new Set(s.map((x) => x.grupo)).size).toBe(2);
    });
});

describe('estadoAlumnosPorGrupo', () => {
    it('regulares = inscritos menos en límite y sin derecho; primero los grupos en riesgo', () => {
        const s = estadoAlumnosPorGrupo(periodo);
        expect(s).toHaveLength(2);
        expect(s[0]).toMatchObject({ grupo: '3A · Finanzas', regulares: 25, enLimite: 3, sinDerecho: 2 });
        expect(s[1]).toMatchObject({ regulares: 10, enLimite: 0, sinDerecho: 0 });
    });
    it('nunca produce regulares negativos ni falla con vacío', () => {
        expect(estadoAlumnosPorGrupo([{ clave_grupo: 'X', inscritos: 2, alumnos_en_limite: 3, alumnos_sin_derecho: 1 }])[0].regulares).toBe(0);
        expect(estadoAlumnosPorGrupo([])).toEqual([]);
        expect(estadoAlumnosPorGrupo(undefined)).toEqual([]);
    });
});

describe('indicadoresPeriodo', () => {
    it('suma conteos y pondera la asistencia por inscritos', () => {
        const k = indicadoresPeriodo(periodo);
        expect(k).toMatchObject({ grupos: 3, inscritos: 40, enLimite: 3, sinDerecho: 2 });
        expect(k.asistenciaPromedio).toBe(85);
    });
    it('sin datos de asistencia devuelve null', () => {
        expect(indicadoresPeriodo([]).asistenciaPromedio).toBeNull();
        expect(indicadoresPeriodo([periodo[2]])).toMatchObject({ grupos: 1, asistenciaPromedio: null });
        expect(indicadoresPeriodo(undefined).grupos).toBe(0);
    });
});

describe('textos alternativos', () => {
    it('serie y situación por grupo', () => {
        expect(resumenSerie([{ alumno: 'Ana', faltas: 12 }, { alumno: 'Luis', faltas: 3.5 }], 'alumno', 'faltas')).toBe('Ana: 12 %; Luis: 3.5 %');
        expect(resumenSerie([], 'a', 'b')).toBe('');
        expect(resumenSituacionGrupos([{ grupo: '3A', regulares: 25, enLimite: 3, sinDerecho: 2 }])).toBe('3A: 25 con derecho, 3 en el límite, 2 sin derecho');
    });
    it('acortar respeta el máximo', () => {
        expect(acortar('abc', 5)).toBe('abc');
        expect(acortar('abcdefghij', 5)).toBe('abcd…');
        expect(acortar(null)).toBe('');
    });
});
