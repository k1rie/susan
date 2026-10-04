import { describe, expect, it } from 'vitest';
import {
    CONFIG_FALTAS,
    datosDonaAsistencia,
    datosFaltasPorMateria,
    datosMedidorAsistencia,
    notaMedidor,
    notaPendientes,
    notaRegistros,
    porcentajeAsistieron,
    resumenAsistencia,
    resumenFaltas,
    seriesFaltas,
    totalesAsistencia,
} from './graficasAsistencia.utils.js';

const mat = (id, nombre, extra = {}) => ({
    id_grupo: id, clave_grupo: `G${id}`, materia: { nombre }, presentes: 5, retardos: 1, ausencias: 2, justificadas: 1, pendientes: 0,
    sesiones_programadas: 40, faltas_equivalentes: 4, porcentaje_faltas: 10, limite_pct: 20, supera_limite: false, ...extra,
});

describe('totales y anillo de asistencia', () => {
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
    it('el anillo excluye pendientes y "asististe" cuenta solo presentes y retardos (no las justificadas)', () => {
        const t = { presentes: 8, retardos: 1, ausencias: 3, justificadas: 2, pendientes: 4 };
        expect(datosDonaAsistencia(t).map((d) => d.clave)).toEqual(['presente', 'retardo', 'ausente', 'justificado']);
        expect(datosDonaAsistencia(t).reduce((a, d) => a + d.valor, 0)).toBe(14);
        expect(porcentajeAsistieron(t)).toBe(64);
        expect(resumenAsistencia(t)).toContain('Presentes: 8 (57 %)');
        expect(resumenAsistencia(t)).toContain('Asististe (presente o retardo) en el 64 % de los registros ya resueltos.');
    });
    it('la nota del anillo aclara que el derecho a examen se mide aparte y calla sin registros', () => {
        const nota = notaRegistros({ presentes: 8, retardos: 1, ausencias: 3, justificadas: 2, pendientes: 4 });
        expect(nota).toContain('64 %');
        expect(nota).toMatch(/faltas equivalentes/);
        expect(notaRegistros({ presentes: 0, retardos: 0, ausencias: 0, justificadas: 0, pendientes: 5 })).toBeNull();
    });
    it('nota de pendientes: singular, plural y ausente', () => {
        expect(notaPendientes(0)).toBeNull();
        expect(notaPendientes(1)).toBe('1 registro pendiente de revisión aún no cuenta.');
        expect(notaPendientes(3)).toBe('3 registros pendientes de revisión aún no cuentan.');
    });
});

describe('medidor «Tu asistencia»', () => {
    it('una materia: 100 % menos las faltas equivalentes sobre las sesiones programadas, con la marca del mínimo', () => {
        const m = datosMedidorAsistencia([mat(1, 'Álgebra')]);
        expect(m).toMatchObject({
            valor: 90,
            faltas: 4,
            sesiones: 40,
            tono: 'presente',
            limite: { valor: 80, etiqueta: 'Mínimo 80 %' },
            descripcion: '4 faltas equivalentes de 40 sesiones',
        });
    });
    it('NO usa el «asististe» del anillo: mismos registros, otra medida', () => {
        // 5 presentes + 1 retardo de 9 resueltos = 67 % «asististe», pero solo 4 de 40 sesiones son falta: 90 % de asistencia.
        const [item] = [mat(1, 'Álgebra')];
        expect(porcentajeAsistieron(totalesAsistencia([item]))).toBe(67);
        expect(datosMedidorAsistencia([item]).valor).toBe(90);
    });
    it('con varias materias suma las faltas y las sesiones de todas (promedio ponderado)', () => {
        const m = datosMedidorAsistencia([mat(1, 'A', { faltas_equivalentes: 4, sesiones_programadas: 40 }), mat(2, 'B', { faltas_equivalentes: 8, sesiones_programadas: 40 })]);
        expect(m.valor).toBe(85);
        expect(m.descripcion).toBe('12 faltas equivalentes de 80 sesiones');
        expect(m.limite).toEqual({ valor: 80, etiqueta: 'Mínimo 80 %' });
    });
    it('redondea a 1 decimal, nunca baja de 0 ni pasa de 100', () => {
        expect(datosMedidorAsistencia([mat(1, 'A', { faltas_equivalentes: 1, sesiones_programadas: 16 })]).valor).toBe(93.8);
        expect(datosMedidorAsistencia([mat(1, 'A', { faltas_equivalentes: 0, sesiones_programadas: 30 })]).valor).toBe(100);
        expect(datosMedidorAsistencia([mat(1, 'A', { faltas_equivalentes: 50, sesiones_programadas: 30 })]).valor).toBe(0);
    });
    it('singulares: «1 falta equivalente de 1 sesión»', () => {
        expect(datosMedidorAsistencia([mat(1, 'A', { faltas_equivalentes: 1, sesiones_programadas: 1 })]).descripcion).toBe('1 falta equivalente de 1 sesión');
    });
    it('el tono sigue lo que dicta la base: en el límite = retardo, sobre el límite o sin derecho = ausente', () => {
        expect(datosMedidorAsistencia([mat(1, 'A', { en_limite: true })]).tono).toBe('retardo');
        expect(datosMedidorAsistencia([mat(1, 'A', { supera_limite: true })]).tono).toBe('ausente');
        expect(datosMedidorAsistencia([mat(1, 'A', { derecho_examen: false })]).tono).toBe('ausente');
        // La peor materia manda aunque el promedio quede por encima del mínimo.
        expect(datosMedidorAsistencia([mat(1, 'A'), mat(2, 'B', { en_limite: true }), mat(3, 'C', { supera_limite: true })]).tono).toBe('ausente');
    });
    it('con varias materias, la descripción dice cuántas están sobre el límite; con una sola no hace falta (el aviso ya lo dice)', () => {
        const varias = datosMedidorAsistencia([mat(1, 'A', { faltas_equivalentes: 0 }), mat(2, 'B', { faltas_equivalentes: 12, supera_limite: true })]);
        expect(varias.valor).toBe(85);
        expect(varias.descripcion).toBe('12 faltas equivalentes de 80 sesiones · 1 materia sobre el límite');
        expect(datosMedidorAsistencia([mat(1, 'A', { faltas_equivalentes: 12, supera_limite: true })]).descripcion).toBe('12 faltas equivalentes de 40 sesiones');
    });
    it('sin marca si el límite falta, es inválido o las materias no coinciden (no se inventa el número)', () => {
        expect(datosMedidorAsistencia([mat(1, 'A', { limite_pct: undefined })]).limite).toBeNull();
        expect(datosMedidorAsistencia([mat(1, 'A', { limite_pct: null })]).limite).toBeNull();
        expect(datosMedidorAsistencia([mat(1, 'A', { limite_pct: 0 })]).limite).toBeNull();
        expect(datosMedidorAsistencia([mat(1, 'A', { limite_pct: 100 })]).limite).toBeNull();
        expect(datosMedidorAsistencia([mat(1, 'A', { limite_pct: 15 }), mat(2, 'B', { limite_pct: 25 })]).limite).toBeNull();
        expect(datosMedidorAsistencia([mat(1, 'A', { limite_pct: 15 }), mat(2, 'B', { limite_pct: undefined })]).limite).toBeNull();
    });
    it('el mínimo sale de limite_pct, también con decimales', () => {
        expect(datosMedidorAsistencia([mat(1, 'A', { limite_pct: 25 })]).limite).toEqual({ valor: 75, etiqueta: 'Mínimo 75 %' });
        expect(datosMedidorAsistencia([mat(1, 'A', { limite_pct: 22.5 })]).limite).toEqual({ valor: 77.5, etiqueta: 'Mínimo 77.5 %' });
    });
    it('sin sesiones programadas o sin faltas equivalentes no hay medidor (un 0 % o un 100 % sería inventado)', () => {
        expect(datosMedidorAsistencia([])).toBeNull();
        expect(datosMedidorAsistencia(undefined)).toBeNull();
        expect(datosMedidorAsistencia(null)).toBeNull();
        expect(datosMedidorAsistencia([mat(1, 'A', { sesiones_programadas: 0 })])).toBeNull();
        expect(datosMedidorAsistencia([mat(1, 'A', { sesiones_programadas: undefined })])).toBeNull();
        expect(datosMedidorAsistencia([mat(1, 'A', { faltas_equivalentes: undefined })])).toBeNull();
        expect(datosMedidorAsistencia([mat(1, 'A', { faltas_equivalentes: null })])).toBeNull();
    });
    it('una materia sin sesiones no cuenta, pero las demás sí', () => {
        const m = datosMedidorAsistencia([mat(1, 'Nueva', { sesiones_programadas: 0, faltas_equivalentes: 0 }), mat(2, 'B')]);
        expect(m.valor).toBe(90);
        expect(m.sesiones).toBe(40);
    });
    it('la nota de cómo se calcula menciona la marca solo si el medidor la lleva', () => {
        expect(notaMedidor(null)).toBeNull();
        const con = notaMedidor(datosMedidorAsistencia([mat(1, 'A')]));
        expect(con).toMatch(/100 % menos tus faltas equivalentes/);
        expect(con).toMatch(/límite de faltas/);
        const sin = notaMedidor(datosMedidorAsistencia([mat(1, 'A', { limite_pct: undefined })]));
        expect(sin).toMatch(/100 % menos tus faltas equivalentes/);
        expect(sin).not.toMatch(/marca/);
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
    it('los nombres van completos (la gráfica los parte en 2 líneas) y los repetidos llevan la clave del grupo', () => {
        const { filas } = datosFaltasPorMateria([
            mat(1, 'Métodos numéricos aplicados a ingeniería'),
            mat(2, 'Física'),
            mat(3, 'Física'),
        ]);
        expect(filas[0].materia).toBe('Métodos numéricos aplicados a ingeniería');
        expect(filas[1].materia).toBe('Física (G2)');
        expect(filas[2].materia).toBe('Física (G3)');
    });
    it('sin materias: lista vacía, límite por defecto y texto alternativo', () => {
        const d = datosFaltasPorMateria([]);
        expect(d.filas).toEqual([]);
        expect(d.limite).toBe(20);
        expect(resumenFaltas(d)).toBe('Sin materias.');
    });
    it('texto alternativo con porcentajes, estado y límite', () => {
        const d = datosFaltasPorMateria([mat(1, 'Álgebra', { porcentaje_faltas: 12.5 })]);
        expect(resumenFaltas(d)).toBe('Álgebra: 12,5 % de faltas. Límite: 20 %.');
        const e = datosFaltasPorMateria([
            mat(1, 'A', { porcentaje_faltas: 20, en_limite: true }),
            mat(2, 'B', { porcentaje_faltas: 30, supera_limite: true }),
        ]);
        expect(resumenFaltas(e)).toBe('A: 20 % de faltas (en el límite); B: 30 % de faltas (sobre el límite). Límite: 20 %.');
    });
});
