import { describe, expect, it } from 'vitest';
import { analizarGrupo } from '@/lib/numerics';
import {
    CONFIG_RIESGO, CONFIG_SERIE, datosPatronBarras, descripcionTendencia, distribucionRiesgo, dividirTexto, nombreCorto, partirAlertas, resumenTextoAcumulado, resumenTextoPatron,
    resumenTextoSerie, resumenTextoTop, tendenciaAlumno, topRiesgo,
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
        // la tendencia ya no es una tarjeta: vive en la descripción de la gráfica (descripcionTendencia)
        expect(t).not.toHaveProperty('tendencia');
        const c = analisis.cruceLimite;
        expect(t.cruce.valor).toBe(c.estado === 'cruza' ? `Semana ${c.semana}` : c.estado === 'superado' ? 'Ya superado' : 'No cruza');
    });
    it('degrada con series cortas', () => {
        const corto = analizarGrupo({ serie: serieSintetica(2, () => 2), sesionesProgramadas: 48 });
        const t = datosTarjetas({ ...corto, limitePct: 20 });
        expect(corto.resumen.suficiente).toBe(false);
        expect(t.proyeccion.nota).toBe('Faltan semanas');
        expect(t.cruce.valor).toBe('-');
        expect(t.cruce.nota).toBe('Faltan semanas');
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

describe('tarjetas: cifras clave', () => {
    it('incluye alumnos en riesgo con tono y nota', () => {
        const t = datosTarjetas({ ...analisis, limitePct: 20 });
        expect(t.riesgo.valor).toBe(String(analisis.resumen.alumnosEnRiesgo));
        expect(t.riesgo.nota).toContain(`de ${analisis.resumen.alumnosEvaluados}`);
        expect(t.riesgo.tono).not.toBe('neutral');
    });
    it('sin matriz muestra guion y nota neutra', () => {
        const sinMatriz = analizarGrupo({ serie: serieSintetica(8, () => 2), sesionesProgramadas: 48 });
        const t = datosTarjetas({ ...sinMatriz, limitePct: 20 });
        expect(t.riesgo.valor).toBe('-');
        expect(t.riesgo.tono).toBe('neutral');
    });
});

describe('cruce del límite en la tarjeta', () => {
    it('valor corto según el estado', () => {
        const base = { resumen: { suficiente: true }, limitePct: 20 };
        expect(datosTarjetas({ ...base, cruceLimite: { estado: 'cruza', semana: 14, mensaje: 'Semana 14 (estimada)' } }).cruce).toMatchObject({ valor: 'Semana 14', tono: 'warning' });
        expect(datosTarjetas({ ...base, cruceLimite: { estado: 'superado', semana: 6, mensaje: 'Ya superado' } }).cruce).toMatchObject({ valor: 'Ya superado', tono: 'danger' });
        expect(datosTarjetas({ ...base, cruceLimite: { estado: 'no_cruza', mensaje: 'No cruza dentro del periodo' } }).cruce.valor).toBe('No cruza');
        expect(datosTarjetas({ ...base, cruceLimite: null }).cruce.valor).toBe('-');
    });
});

describe('distribución de riesgo', () => {
    it('completa el nivel bajo con los evaluados', () => {
        const items = [{ nivel: 'alto' }, { nivel: 'medio' }, { nivel: 'medio' }];
        const d = distribucionRiesgo(items, 10);
        expect(d.datos).toEqual([{ clave: 'bajo', valor: 7 }, { clave: 'medio', valor: 2 }, { clave: 'alto', valor: 1 }]);
        expect(d.enRiesgo).toBe(3);
        expect(d.total).toBe(10);
        expect(Object.keys(CONFIG_RIESGO)).toEqual(['bajo', 'medio', 'alto']);
    });
    it('sin evaluados (o inconsistentes) usa solo la lista; vacío da total 0', () => {
        expect(distribucionRiesgo([{ nivel: 'alto' }], null).total).toBe(1);
        expect(distribucionRiesgo([{ nivel: 'alto' }, { nivel: 'alto' }], 1).total).toBe(2);
        const v = distribucionRiesgo([], 0);
        expect(v.total).toBe(0);
        expect(v.datos.every((x) => x.valor === 0)).toBe(true);
    });
    it('con datos reales cuadra con el resumen del análisis', () => {
        const d = distribucionRiesgo(analisis.alumnosEnRiesgo, analisis.resumen.alumnosEvaluados);
        expect(d.enRiesgo).toBe(analisis.resumen.alumnosEnRiesgo);
        expect(d.total).toBe(analisis.resumen.alumnosEvaluados);
    });
});

describe('top de riesgo', () => {
    const mk = (i, nivel, puntaje, nombre = `Alumno con un nombre muy largo número ${i}`) => ({ idAlumno: i, matricula: `M${i}`, nombre, nivel, puntaje });
    it('limita a N, ordena por puntaje y separa por nivel', () => {
        const items = Array.from({ length: 12 }, (_, i) => mk(i + 1, i % 3 === 0 ? 'alto' : 'medio', 30 + i * 5));
        const top = topRiesgo(items, 8);
        expect(top).toHaveLength(8);
        const valores = top.map((f) => f.alto ?? f.medio);
        expect(valores).toEqual([...valores].sort((a, b) => b - a));
        expect(valores[0]).toBe(85);
        top.forEach((f) => expect((f.alto == null) !== (f.medio == null)).toBe(true));
    });
    it('etiquetas únicas aunque los nombres cortos choquen, y sin mutar la entrada', () => {
        const items = [mk(1, 'alto', 80, 'Mismo Nombre Completo Largo A'), mk(2, 'medio', 50, 'Mismo Nombre Completo Largo B')];
        const copia = JSON.parse(JSON.stringify(items));
        const top = topRiesgo(items);
        expect(new Set(top.map((f) => f.alumno)).size).toBe(2);
        expect(top[0].alumno).toContain('M1');
        expect(items).toEqual(copia);
    });
    it('si los nombres cortos chocan, el sufijo es solo el final de la matrícula y cabe en el eje', () => {
        const items = [
            mk(1, 'alto', 90, 'González Campos María Fernanda'), mk(2, 'medio', 60, 'González Campos Mario Federico'),
            mk(3, 'medio', 40, 'Pérez Luna Ana'),
        ].map((a, i) => ({ ...a, matricula: i < 2 ? `A012345${i + 6}` : 'A0000003' }));
        const top = topRiesgo(items);
        expect(top[0].alumno).toMatch(/ #3456$/);
        expect(top[1].alumno).toMatch(/ #3457$/);
        expect(top[0].alumno).not.toContain('A0123456');
        expect(top[2].alumno).toBe('Pérez Luna Ana');
        top.forEach((f) => expect(f.alumno.length).toBeLessThanOrEqual(16));
    });
    it('aun sin matrícula ni nada que distinga a los homónimos, las etiquetas siguen siendo únicas y cortas', () => {
        const items = [1, 2, 3].map((i) => ({ idAlumno: undefined, nombre: 'Anastasio Montenegro Fernández de la Cruz', nivel: 'medio', puntaje: 50 - i }));
        const top = topRiesgo(items);
        expect(new Set(top.map((f) => f.alumno)).size).toBe(3);
        top.forEach((f) => expect(f.alumno.length).toBeLessThanOrEqual(16));
    });
    it('vacío y nombres', () => {
        expect(topRiesgo([])).toEqual([]);
        expect(topRiesgo(undefined)).toEqual([]);
        expect(nombreCorto('Ana')).toBe('Ana');
        expect(nombreCorto('x'.repeat(30), 10)).toHaveLength(10);
        expect(nombreCorto('González Campos María')).toBe('González C. M.');
        expect(nombreCorto('Cruz Rojas Iván')).toBe('Cruz Rojas Iván');
        expect(nombreCorto('Anastasio Montenegro Fernández de la Cruz', 12)).toBe('Anastasio M…');
        expect(nombreCorto(null)).toBe('-');
    });
    it('texto alternativo con nombres completos', () => {
        expect(resumenTextoTop([mk(1, 'alto', 80, 'Ana Pérez')])).toContain('Ana Pérez 80 de 100 (alto)');
        expect(resumenTextoTop([])).toMatch(/Ningún alumno/);
    });
    it('con datos reales el primero es el de mayor puntaje', () => {
        const top = topRiesgo(analisis.alumnosEnRiesgo);
        expect(top.length).toBeGreaterThan(0);
        expect(top[0].alto ?? top[0].medio).toBe(analisis.alumnosEnRiesgo[0].puntaje);
    });
});

describe('tendencia por alumno', () => {
    const conPend = (v) => ({ factores: [{ id: 'pendienteReciente', valor: v }] });
    it('clasifica por pendiente (pp por sesión)', () => {
        expect(tendenciaAlumno(conPend(2)).direccion).toBe('alza');
        expect(tendenciaAlumno(conPend(-2)).direccion).toBe('baja');
        expect(tendenciaAlumno(conPend(0.2)).direccion).toBe('estable');
        expect(tendenciaAlumno(conPend(null)).direccion).toBeNull();
        expect(tendenciaAlumno({}).etiqueta).toBe('-');
    });
    it('ordenarRiesgo admite la clave tendencia', () => {
        const items = [{ nombre: 'A', ...conPend(1) }, { nombre: 'B', ...conPend(3) }, { nombre: 'C', ...conPend(null) }];
        expect(ordenarRiesgo(items, 'tendencia', 'desc').map((x) => x.nombre)).toEqual(['B', 'A', 'C']);
    });
});

describe('alertas y textos', () => {
    it('parte las alertas por gravedad', () => {
        const al = [{ nivel: 'info', codigo: 'a' }, { nivel: 'alta', codigo: 'b' }, { nivel: 'media', codigo: 'c' }, { nivel: 'alta', codigo: 'd' }, { nivel: 'info', codigo: 'e' }];
        const { principales, resto } = partirAlertas(al, 3);
        expect(principales.map((x) => x.codigo)).toEqual(['b', 'd', 'c']);
        expect(resto.map((x) => x.codigo)).toEqual(['a', 'e']);
        expect(partirAlertas([]).principales).toEqual([]);
    });
    it('divide textos largos en la primera frase y el resto', () => {
        expect(dividirTexto('Corto.')).toEqual({ corto: 'Corto.', resto: '' });
        const largo = `${'Primera frase de bastante longitud para el paso numérico'}. ${'Segunda frase con más detalle que se pliega. '.repeat(3)}`;
        const d = dividirTexto(largo, 80);
        expect(d.corto.endsWith('numérico.')).toBe(true);
        expect(d.resto.length).toBeGreaterThan(0);
        expect(`${d.corto} ${d.resto}`.replace(/\s+/g, ' ')).toBe(largo.trim().replace(/\s+/g, ' '));
    });
    it('resumen de la serie semanal indica de X a Y, proyección y cruce', () => {
        const t = resumenTextoSerie({ ...analisis, limitePct: 20 });
        // son tasas de AUSENTISMO: el texto no debe decir "asistencia" (un lector de pantalla oiría lo contrario)
        expect(t).toMatch(/^Ausentismo semanal: el ausentismo va de .* % en la semana 1 a .* % en la semana 8/);
        expect(t).not.toMatch(/asistencia/i);
        expect(t).toContain('tendencia');
        expect(t).toContain('proyección');
        expect(resumenTextoSerie({ tendencia: { disponible: false } })).toMatch(/insuficientes/);
    });
    it('la descripción de la tendencia da la dirección y la pendiente', () => {
        expect(descripcionTendencia({ disponible: true, direccion: 'alza', pendientePuntosPorSemana: 1.234 })).toBe('Tendencia al alza: +1.23 pp por semana. Proyección con intervalo de 95\u00a0%.');
        expect(descripcionTendencia({ disponible: true, direccion: 'baja', pendientePuntosPorSemana: -0.5 })).toContain('Tendencia a la baja: -0.50 pp por semana');
        expect(descripcionTendencia({ disponible: true, direccion: 'estable', pendientePuntosPorSemana: 0 })).toContain('Tendencia estable: 0.00 pp por semana');
        expect(descripcionTendencia({ disponible: true, pendientePuntosPorSemana: null })).toMatch(/^Tendencia\. /);
        expect(descripcionTendencia({ disponible: false })).toBeUndefined();
        expect(descripcionTendencia(null)).toBeUndefined();
        expect(descripcionTendencia(analisis.tendencia)).toMatch(/^Tendencia .*: [+-]?\d+\.\d{2} pp por semana/);
    });
    it('ajuste, proyección e intervalo comparten color pero cada uno tiene su forma en la leyenda', () => {
        const comparten = ['ajuste', 'proyeccion', 'banda'];
        expect(new Set(comparten.map((k) => CONFIG_SERIE[k].color)).size).toBe(1);
        expect(new Set(comparten.map((k) => CONFIG_SERIE[k].forma)).size).toBe(3);
    });
    it('resumen del acumulado y del patrón', () => {
        expect(resumenTextoAcumulado(analisis.cruceLimite, 20)).toContain(analisis.cruceLimite.mensaje);
        expect(resumenTextoAcumulado({ estado: 'insuficiente' })).toMatch(/insuficientes/);
        expect(resumenTextoPatron(analisis.patronSemanal)).toMatch(/de \d+ sesiones/);
        expect(resumenTextoPatron(null)).toMatch(/sin sesiones/);
    });
    it('barras del patrón: el día crítico va en su propia serie', () => {
        const patron = { dias: [{ nombre: 'Lun', tasa: 0.2, sesiones: 5, ausentes: 4, critico: true }, { nombre: 'Mié', tasa: 0.05, sesiones: 5, ausentes: 1, critico: false }, { nombre: 'Vie', tasa: null, sesiones: 0, ausentes: 0, critico: false }] };
        expect(datosPatronBarras(patron)).toEqual([
            { dia: 'Lun', normal: null, critico: 20 },
            { dia: 'Mié', normal: 5, critico: null },
            { dia: 'Vie', normal: null, critico: null },
        ]);
        expect(datosPatronBarras(null)).toEqual([]);
    });
});
