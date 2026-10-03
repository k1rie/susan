import { describe, expect, it } from 'vitest';
import { analizarGrupo } from '@/lib/numerics';
import {
    columnasTraza, construirCsvAnalisis, construirSerieAcumulado, construirSerieSemanal, datosPatron, datosTarjetas,
    escaparCeldaCsv, fmtCelda, fmtSigno, ordenarRiesgo, seccionesProcedimiento,
} from './analitica.utils.js';

const LUNES0 = Date.UTC(2026, 7, 17);
const fechaDe = (semana, dia) => new Date(LUNES0 + ((semana - 1) * 7 + (dia - 1)) * 86400000).toISOString().slice(0, 10);

function serieSintetica(semanas, ausentes, inscritos = 20) {
    const items = [];
    for (let w = 1; w <= semanas; w += 1) {
        for (const dia of [1, 3, 5]) {
            const a = ausentes(w);
            items.push({
                id_sesion: items.length + 1, fecha: fechaDe(w, dia), dia_semana: dia, inscritos, presentes: inscritos - a,
                retardos: 0, ausentes: a, justificados: 0, pendientes: 0, tasa_ausentismo: a / inscritos,
            });
        }
    }
    return { sesiones: items };
}

// Matriz: el alumno 1 falta cada vez más; el resto casi siempre asiste.
function matrizSintetica(semanas) {
    const fechas = [];
    for (let w = 1; w <= semanas; w += 1) for (const d of [1, 3, 5]) fechas.push(fechaDe(w, d));
    const alumnos = Array.from({ length: 6 }, (_, i) => ({
        id_alumno: i + 1, matricula: `E${i + 1}`, nombre: `Alumno ${i + 1}`,
        estados: fechas.map((_f, k) => (i === 0 && k >= 6 ? 'ausente' : 'presente')),
    }));
    return { fechas, alumnos };
}

const analisis = analizarGrupo({
    serie: serieSintetica(8, (w) => 1 + Math.floor(w / 2)),
    matriz: matrizSintetica(8),
    limitePct: 20,
    sesionesProgramadas: 48,
    retardosPorAusencia: 3,
});

describe('formateo', () => {
    it('signo y celdas', () => {
        expect(fmtSigno(0.84)).toBe('+0.8');
        expect(fmtSigno(-0.84)).toBe('-0.8');
        expect(fmtSigno(0)).toBe('0.0');
        expect(fmtSigno(null)).toBe('-');
        expect(fmtCelda(1.23456789)).toBe('1.23457');
        expect(fmtCelda(3)).toBe('3');
        expect(fmtCelda(null)).toBe('-');
    });
});

describe('datos de gráficas', () => {
    it('serie semanal combina observada, ajuste, suavizado y proyección por semana', () => {
        const filas = construirSerieSemanal(analisis);
        expect(filas.length).toBeGreaterThanOrEqual(8);
        expect(filas[0].semana).toBe(1);
        expect(filas[0].observada).not.toBeNull();
        expect(filas[0].ajuste).toBeTypeOf('number');
        const conProy = filas.filter((f) => f.proyeccion != null);
        expect(conProy.length).toBeGreaterThan(0);
        expect(conProy[0].banda).toHaveLength(2);
        for (let i = 1; i < filas.length; i += 1) expect(filas[i].semana).toBeGreaterThan(filas[i - 1].semana);
    });
    it('acumulado y patrón semanal', () => {
        const ac = construirSerieAcumulado(analisis.cruceLimite);
        expect(ac.some((f) => f.acumulado != null)).toBe(true);
        const dias = datosPatron(analisis.patronSemanal);
        expect(dias.length).toBeGreaterThan(0);
        expect(dias.every((d) => d.dia)).toBe(true);
    });
    it('serie vacía no revienta', () => {
        expect(construirSerieSemanal({})).toEqual([]);
        expect(construirSerieAcumulado(null)).toEqual([]);
        expect(datosPatron(null)).toEqual([]);
    });
});

describe('tarjetas', () => {
    it('formatea con datos suficientes', () => {
        const t = datosTarjetas({ ...analisis, limitePct: 20 });
        expect(t.actual.valor).toMatch(/%$/);
        expect(t.tendencia.valor).toMatch(/pp\/sem$/);
        expect(t.cruce.valor).toBe(analisis.cruceLimite.mensaje);
    });
    it('degrada con series cortas', () => {
        const corto = analizarGrupo({ serie: serieSintetica(2, () => 2), sesionesProgramadas: 48 });
        const t = datosTarjetas({ ...corto, limitePct: 20 });
        expect(corto.resumen.suficiente).toBe(false);
        expect(t.tendencia.nota).toMatch(/Datos insuficientes/);
        expect(t.cruce.valor).toBe('Datos insuficientes');
    });
});

describe('riesgo y procedimientos', () => {
    it('detecta al alumno que abandona', () => {
        expect(analisis.alumnosEnRiesgo.length).toBeGreaterThan(0);
        expect(analisis.alumnosEnRiesgo[0].matricula).toBe('E1');
    });
    it('ordena sin mutar y deja nulos al final', () => {
        const items = [
            { nombre: 'B', puntaje: 40, semanaCruceEstimada: null },
            { nombre: 'A', puntaje: 70, semanaCruceEstimada: 9 },
            { nombre: 'C', puntaje: 55, semanaCruceEstimada: 5 },
        ];
        expect(ordenarRiesgo(items).map((x) => x.nombre)).toEqual(['A', 'C', 'B']);
        expect(ordenarRiesgo(items, 'nombre', 'asc').map((x) => x.nombre)).toEqual(['A', 'B', 'C']);
        expect(ordenarRiesgo(items, 'cruce', 'asc').map((x) => x.nombre)).toEqual(['C', 'A', 'B']);
        expect(ordenarRiesgo(items, 'cruce', 'desc').map((x) => x.nombre)).toEqual(['A', 'C', 'B']);
        expect(items[0].nombre).toBe('B');
    });
    it('mapea procedimientos a secciones con contenido', () => {
        const secs = seccionesProcedimiento(analisis.procedimientos);
        expect(secs.length).toBeGreaterThan(0);
        expect(secs.every((s) => s.pasos?.length || s.traza?.length)).toBe(true);
        const conTraza = secs.find((s) => s.traza?.length);
        if (conTraza) expect(columnasTraza(conTraza.traza).map((c) => c.key)).toContain('iter');
    });
});

describe('CSV', () => {
    it('escapa y neutraliza fórmulas', () => {
        expect(escaparCeldaCsv('=1+1')).toBe("'=1+1");
        expect(escaparCeldaCsv('a,b')).toBe('"a,b"');
        expect(escaparCeldaCsv(-3)).toBe('-3');
    });
    it('resumen con BOM y alumnos', () => {
        const csv = construirCsvAnalisis(analisis, { grupo: '3A', periodo: '2026-2' });
        expect(csv.startsWith('﻿')).toBe(true);
        expect(csv).toContain('Alumnos en riesgo');
        expect(csv).toContain('E1');
        expect(csv).toContain('\r\n');
    });
});
