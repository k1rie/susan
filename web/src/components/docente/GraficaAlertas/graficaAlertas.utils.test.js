import { describe, expect, it } from 'vitest';
import { CONFIG_FALTAS, datosGraficaAlertas, MAX_NOMBRE, MAX_NOMBRE_CON_GRUPO, nombreCorto, resumenAlertas } from './graficaAlertas.utils.js';

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
    it('la serie no repite la unidad en su etiqueta: BarrasPildora la pone en cada cifra', () => {
        expect(CONFIG_FALTAS.faltas.label).toBe('Faltas equivalentes');
        expect(CONFIG_FALTAS.faltas.color).toBe('var(--ausente)');
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
        expect(r.datos[0].alumno.length).toBeLessThanOrEqual(MAX_NOMBRE);
        expect(r.datos[0].alumno.endsWith('…')).toBe(true);
        expect(r.datos[1].alumno.endsWith('(2)')).toBe(true);
        expect(nombreCorto(' Ana ')).toBe('Ana');
        expect(nombreCorto(null)).toBe('');
        // Un nombre que cabe en 2 líneas ya no se corta (la columna de nombres de BarrasPildora las admite).
        expect(nombreCorto('González Campos Mauricio')).toBe('González Campos Mauricio');
    });
    it('un nombre de hasta MAX_NOMBRE caracteres queda completo y uno más largo se corta con puntos suspensivos', () => {
        expect(nombreCorto('a'.repeat(MAX_NOMBRE))).toBe('a'.repeat(MAX_NOMBRE));
        expect(nombreCorto('a'.repeat(MAX_NOMBRE + 1))).toBe(`${'a'.repeat(MAX_NOMBRE - 1)}…`);
    });
    it('añade la clave del grupo a la etiqueta para distinguir al mismo alumno en dos grupos', () => {
        const r = datosGraficaAlertas([{ ...A('González Campos Mauricio', 26.7), clave_grupo: '3A' }, { ...A('González Campos Mauricio', 22.2), clave_grupo: '5C' }]);
        // Con grupo el nombre se acota más (20) para que la clave del grupo no caiga en una tercera línea.
        // Espacios duros alrededor del «·»: la clave del grupo va pegada a la última palabra y no queda un «·» huérfano en la 2.ª línea.
        expect(r.datos.map((d) => d.alumno)).toEqual(['González Campos Mau…\u00A0·\u00A03A', 'González Campos Mau…\u00A0·\u00A05C']);
        expect(MAX_NOMBRE_CON_GRUPO).toBeLessThan(MAX_NOMBRE);
    });
    it('resume la gráfica en texto', () => {
        const r = datosGraficaAlertas([A('Ana', 25), A('Beto', 18)]);
        const t = resumenAlertas(r.datos, r.limite);
        expect(t).toContain('límite 20 %');
        expect(t).toContain('Ana: 25 %');
        expect(resumenAlertas([], null)).toBe('Sin alumnos en alerta.');
    });
});
