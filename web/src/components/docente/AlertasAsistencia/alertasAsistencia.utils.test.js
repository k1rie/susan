import { describe, expect, it } from 'vitest';
import { conteoAlertas, progresoFaltas, sinDerecho, subtituloAlerta } from './alertasAsistencia.utils.js';

describe('alertasAsistencia.utils', () => {
    it('reconoce ambos nombres del tipo sin derecho', () => {
        expect(sinDerecho({ tipo: 'sin_derecho' })).toBe(true);
        expect(sinDerecho({ tipo: 'sin_derecho_examen' })).toBe(true);
        expect(sinDerecho({ tipo: 'en_limite' })).toBe(false);
        expect(sinDerecho(undefined)).toBe(false);
    });
    it('calcula el avance contra el límite', () => {
        expect(progresoFaltas(10, 20)).toEqual({ ancho: 50, excede: false, texto: '10 % de 20 %', valido: true });
        expect(progresoFaltas(25, 20)).toMatchObject({ ancho: 100, excede: true });
        expect(progresoFaltas('20', '20')).toMatchObject({ ancho: 100, excede: true });
    });
    it('sin límite o con datos inválidos no rompe', () => {
        expect(progresoFaltas(10, 0)).toEqual({ ancho: 0, excede: false, texto: '10 %', valido: true });
        expect(progresoFaltas(undefined, 20)).toEqual({ ancho: 0, excede: false, texto: '-', valido: false });
        expect(progresoFaltas(-5, 20).ancho).toBe(0);
    });
    it('un porcentaje que falta (null, vacío o texto) no es «0 %»', () => {
        const sinDato = { ancho: 0, excede: false, texto: '-', valido: false };
        expect(progresoFaltas(null, 20)).toEqual(sinDato);
        expect(progresoFaltas('', 20)).toEqual(sinDato);
        expect(progresoFaltas('  ', 20)).toEqual(sinDato);
        expect(progresoFaltas('abc', 20)).toEqual(sinDato);
        expect(progresoFaltas(null, null)).toEqual(sinDato);
    });
    it('un límite que falta (null) no se vuelve 0: se muestra solo el porcentaje', () => {
        expect(progresoFaltas(10, null)).toEqual({ ancho: 0, excede: false, texto: '10 %', valido: true });
    });
    it('el subtítulo lleva materia, grupo y matrícula', () => {
        expect(subtituloAlerta({ materia: 'Finanzas', clave_grupo: '3A', matricula: 'E12' })).toBe('Finanzas (3A) · E12');
        expect(subtituloAlerta({ materia: 'Finanzas', clave_grupo: '3A', matricula: null })).toBe('Finanzas (3A)');
        expect(subtituloAlerta(undefined)).toBe('- (-)');
    });
    it('cuenta las alertas por tipo, también vacías', () => {
        expect(conteoAlertas([{ tipo: 'sin_derecho' }, { tipo: 'en_limite' }, { tipo: 'en_limite' }])).toEqual({ total: 3, sinDerecho: 1, enLimite: 2 });
        expect(conteoAlertas([])).toEqual({ total: 0, sinDerecho: 0, enLimite: 0 });
        expect(conteoAlertas(null)).toEqual({ total: 0, sinDerecho: 0, enLimite: 0 });
    });
});
