import { describe, expect, it } from 'vitest';
import { CONFIG_FALTAS, datosGraficaAlertas, mismaGrafica, nombreCorto, resumenAlertas } from './graficaAlertas.utils.js';

const A = (nombre, pct, lim = 20) => ({ nombre, porcentaje_faltas: pct, limite_pct: lim, matricula: nombre });

describe('graficaAlertas.utils', () => {
    it('ordena de mayor a menor y arma el límite y el dominio', () => {
        const r = datosGraficaAlertas([A('Ana', 12), A('Beto', 25.46), A('Carla', 18)]);
        expect(r.datos.map((d) => d.alumno)).toEqual(['Beto', 'Carla', 'Ana']);
        expect(r.datos[0].faltas).toBe(25.5);
        expect(r.limite).toBe(20);
        expect(r.dominio).toEqual([0, 30]);
    });
    it('limita el número de barras', () => {
        const alertas = Array.from({ length: 12 }, (_, i) => A(`Alumno ${i}`, 10 + i));
        expect(datosGraficaAlertas(alertas).datos).toHaveLength(8);
        expect(datosGraficaAlertas(alertas, 3).datos).toHaveLength(3);
    });
    it('cuenta las alertas graficables: las que no tienen porcentaje no cuentan para el aviso de «más de las que se ven»', () => {
        const alertas = [...Array.from({ length: 9 }, (_, i) => A(`Alumno ${i}`, 10 + i)), { nombre: 'Sin dato', porcentaje_faltas: null }, { nombre: 'Vacío', porcentaje_faltas: '' }];
        const r = datosGraficaAlertas(alertas);
        expect(r.datos).toHaveLength(8);
        expect(r.graficables).toBe(9);
        expect(datosGraficaAlertas(alertas.slice(2, 5).concat(alertas.slice(9))).graficables).toBe(3);
    });
    it('la etiqueta de la serie lleva la unidad (el tooltip no la añade)', () => {
        expect(CONFIG_FALTAS.faltas.label).toContain('%');
    });
    it('compara las gráficas por lo que dibujan, no por la identidad de los arreglos', () => {
        const a = [A('Ana', 25), A('Beto', 18)];
        expect(mismaGrafica(a, a)).toBe(true);
        expect(mismaGrafica(a, a.map((x) => ({ ...x })))).toBe(true);
        // Un campo que no se dibuja (matrícula) no cuenta.
        expect(mismaGrafica(a, [{ ...a[0], matricula: 'otra' }, a[1]])).toBe(true);
        expect(mismaGrafica(a, [A('Ana', 26), a[1]])).toBe(false);
        expect(mismaGrafica(a, [a[0]])).toBe(false);
        expect(mismaGrafica([], undefined)).toBe(true);
    });
    it('sin alertas o sin porcentajes válidos devuelve datos vacíos', () => {
        expect(datosGraficaAlertas([])).toEqual({ datos: [], limite: null, dominio: [0, 100], graficables: 0 });
        expect(datosGraficaAlertas(undefined).datos).toEqual([]);
        expect(datosGraficaAlertas([{ nombre: 'X', porcentaje_faltas: null }]).datos).toEqual([]);
    });
    it('el dominio incluye el límite aunque las faltas sean menores', () => {
        const r = datosGraficaAlertas([A('Ana', 5)]);
        expect(r.dominio[1]).toBeGreaterThanOrEqual(20);
    });
    it('sin límite en las alertas no hay línea', () => {
        expect(datosGraficaAlertas([{ nombre: 'Ana', porcentaje_faltas: 30 }]).limite).toBeNull();
    });
    it('desambigua nombres repetidos y acorta los largos', () => {
        const r = datosGraficaAlertas([A('Maria Fernanda Gutierrez Lopez 1', 30), A('Maria Fernanda Gutierrez Lopez 2', 25)]);
        expect(r.datos[0].alumno.length).toBeLessThanOrEqual(16);
        expect(r.datos[0].alumno.endsWith('…')).toBe(true);
        expect(r.datos[1].alumno.endsWith('(2)')).toBe(true);
        expect(nombreCorto(' Ana ')).toBe('Ana');
        expect(nombreCorto(null)).toBe('');
    });
    it('añade la clave del grupo a la etiqueta para distinguir al mismo alumno en dos grupos', () => {
        const r = datosGraficaAlertas([{ ...A('González Campos Mauricio', 26.7), clave_grupo: '3A' }, { ...A('González Campos Mauricio', 22.2), clave_grupo: '5C' }]);
        expect(r.datos.map((d) => d.alumno)).toEqual(['González Camp… · 3A', 'González Camp… · 5C']);
    });
    it('resume la gráfica en texto', () => {
        const r = datosGraficaAlertas([A('Ana', 25), A('Beto', 18)]);
        const t = resumenAlertas(r.datos, r.limite);
        expect(t).toContain('límite 20 %');
        expect(t).toContain('Ana: 25 %');
        expect(resumenAlertas([], null)).toBe('Sin alumnos en alerta.');
    });
});
