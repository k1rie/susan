import { describe, expect, it } from 'vitest';
import {
    CONFIG_FALTAS,
    NOTA_ASISTIERON,
    altoFaltas,
    datosDonaAsistencia,
    datosFaltasPorMateria,
    notaPendientes,
    porcentajeAsistieron,
    resumenAsistencia,
    resumenFaltas,
    seriesFaltas,
    totalesAsistencia,
} from './graficasAsistencia.utils.js';

const mat = (id, nombre, extra = {}) => ({
    id_grupo: id, clave_grupo: `G${id}`, materia: { nombre }, presentes: 5, retardos: 1, ausencias: 2, justificadas: 1, pendientes: 0,
    porcentaje_faltas: 10, limite_pct: 20, supera_limite: false, ...extra,
});

describe('totales y dona de asistencia', () => {
    it('suma los estados de todas las materias e ignora valores inválidos', () => {
        const t = totalesAsistencia([mat(1, 'A'), mat(2, 'B', { presentes: 'x', pendientes: 3 })]);
        expect(t).toEqual({ presentes: 5, retardos: 2, ausencias: 4, justificadas: 2, pendientes: 3 });
    });
    it('sin materias todo es 0 y el porcentaje no se rompe', () => {
        const t = totalesAsistencia([]);
        expect(t.presentes).toBe(0);
        expect(porcentajeAsistieron(t)).toBe(0);
        expect(totalesAsistencia(undefined).ausencias).toBe(0);
        expect(resumenAsistencia(t)).toBe('Aún no hay registros de asistencia.');
    });
    it('la dona excluye pendientes y "asistieron" cuenta solo presentes y retardos (no las justificadas)', () => {
        const t = { presentes: 8, retardos: 1, ausencias: 3, justificadas: 2, pendientes: 4 };
        expect(datosDonaAsistencia(t).map((d) => d.clave)).toEqual(['presente', 'retardo', 'ausente', 'justificado']);
        expect(datosDonaAsistencia(t).reduce((a, d) => a + d.valor, 0)).toBe(14);
        expect(porcentajeAsistieron(t)).toBe(64);
        expect(resumenAsistencia(t)).toContain('Presentes: 8 (57 %)');
        expect(resumenAsistencia(t)).toContain('Asistieron: 64 %');
    });
    it('la nota de la dona aclara que el derecho a examen se mide aparte', () => {
        expect(NOTA_ASISTIERON).toMatch(/presentes y retardos/);
        expect(NOTA_ASISTIERON).toMatch(/faltas equivalentes/);
    });
    it('nota de pendientes: singular, plural y ausente', () => {
        expect(notaPendientes(0)).toBeNull();
        expect(notaPendientes(1)).toBe('1 registro pendiente de revisión aún no cuenta.');
        expect(notaPendientes(3)).toBe('3 registros pendientes de revisión aún no cuentan.');
    });
});

describe('faltas frente al límite', () => {
    it('separa dentro y sobre el límite con null en la serie que no aplica', () => {
        const { filas, limite, dominio } = datosFaltasPorMateria([
            mat(1, 'Álgebra', { porcentaje_faltas: 12.5 }),
            mat(2, 'Cálculo', { porcentaje_faltas: 25, supera_limite: true }),
        ]);
        expect(limite).toBe(20);
        expect(filas[0]).toMatchObject({ materia: 'Álgebra', dentro: 12.5, enLimite: null, sobre: null });
        expect(filas[1]).toMatchObject({ materia: 'Cálculo', dentro: null, enLimite: null, sobre: 25 });
        expect(dominio).toEqual([0, 30]);
    });
    it('el dominio crece si alguna materia supera 1.5 veces el límite', () => {
        expect(datosFaltasPorMateria([mat(1, 'A', { porcentaje_faltas: 41.2, supera_limite: true })]).dominio).toEqual([0, 42]);
    });
    it('exactamente en el límite sin la marca de la base sigue dentro (el 20.00 % conserva el derecho)', () => {
        expect(datosFaltasPorMateria([mat(1, 'A', { porcentaje_faltas: 20 })]).filas[0].sobre).toBeNull();
    });
    it('una materia con en_limite va en su propia serie, no en la verde de "dentro"', () => {
        const [f] = datosFaltasPorMateria([mat(1, 'A', { porcentaje_faltas: 20, en_limite: true })]).filas;
        expect(f).toMatchObject({ dentro: null, enLimite: 20, sobre: null });
    });
    it('si ya superó el límite, `sobre` gana a en_limite', () => {
        const [f] = datosFaltasPorMateria([mat(1, 'A', { porcentaje_faltas: 25, en_limite: true, supera_limite: true })]).filas;
        expect(f).toMatchObject({ dentro: null, enLimite: null, sobre: 25 });
    });
    it('la línea de referencia usa el mayor limite_pct de las materias, no solo el de la primera', () => {
        const d = datosFaltasPorMateria([mat(1, 'A', { limite_pct: 15 }), mat(2, 'B', { limite_pct: 25 })]);
        expect(d.limite).toBe(25);
        expect(d.dominio[1]).toBeGreaterThanOrEqual(38);
        expect(datosFaltasPorMateria([mat(1, 'A', { limite_pct: undefined })]).limite).toBe(20);
    });
    it('seriesFaltas deja solo las series con barras (y "dentro" si no hay ninguna)', () => {
        const filas = datosFaltasPorMateria([
            mat(1, 'A', { porcentaje_faltas: 5 }),
            mat(2, 'B', { porcentaje_faltas: 20, en_limite: true }),
        ]).filas;
        expect(seriesFaltas(filas).map((s) => s.clave)).toEqual(['dentro', 'enLimite']);
        expect(seriesFaltas([]).map((s) => s.clave)).toEqual(['dentro']);
        const todas = datosFaltasPorMateria([
            mat(1, 'A'), mat(2, 'B', { porcentaje_faltas: 20, en_limite: true }), mat(3, 'C', { porcentaje_faltas: 30, supera_limite: true }),
        ]).filas;
        expect(seriesFaltas(todas).map((s) => s.clave)).toEqual(['dentro', 'enLimite', 'sobre']);
        for (const s of seriesFaltas(todas)) expect(CONFIG_FALTAS[s.clave].color).toMatch(/^var\(--/);
    });
    it('nombres largos se recortan y los repetidos llevan la clave del grupo', () => {
        const { filas } = datosFaltasPorMateria([
            mat(1, 'Métodos numéricos aplicados a ingeniería'),
            mat(2, 'Física'),
            mat(3, 'Física'),
        ]);
        expect(filas[0].materia.length).toBeLessThanOrEqual(18);
        expect(filas[0].materia.endsWith('…')).toBe(true);
        expect(filas[1].materia).toBe('Física (G2)');
        expect(filas[2].materia).toBe('Física (G3)');
    });
    it('sin materias: lista vacía, límite por defecto y texto alternativo', () => {
        const d = datosFaltasPorMateria([]);
        expect(d.filas).toEqual([]);
        expect(d.limite).toBe(20);
        expect(resumenFaltas(d)).toBe('Sin materias.');
    });
    it('texto alternativo con porcentajes y límite; alto acotado', () => {
        const d = datosFaltasPorMateria([mat(1, 'Álgebra', { porcentaje_faltas: 12.5 })]);
        expect(resumenFaltas(d)).toBe('Álgebra: 12,5 % de faltas. Límite: 20 %.');
        expect(altoFaltas(1)).toBe(180);
        const e = datosFaltasPorMateria([
            mat(1, 'A', { porcentaje_faltas: 20, en_limite: true }),
            mat(2, 'B', { porcentaje_faltas: 30, supera_limite: true }),
        ]);
        expect(resumenFaltas(e)).toBe('A: 20 % de faltas (en el límite); B: 30 % de faltas (sobre el límite). Límite: 20 %.');
        expect(altoFaltas(20)).toBe(360);
    });
});
