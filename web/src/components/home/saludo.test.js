import { describe, expect, it } from 'vitest';
import { primerNombre, saludoPorHora } from './saludo.js';

describe('saludo', () => {
    it('por franja horaria', () => {
        expect(saludoPorHora(5)).toBe('Buenos días');
        expect(saludoPorHora(11)).toBe('Buenos días');
        expect(saludoPorHora(12)).toBe('Buenas tardes');
        expect(saludoPorHora(19)).toBe('Buenas tardes');
        expect(saludoPorHora(20)).toBe('Buenas noches');
        expect(saludoPorHora(0)).toBe('Buenas noches');
        expect(saludoPorHora(4)).toBe('Buenas noches');
    });
    it('primer nombre ignora correos y vacíos', () => {
        expect(primerNombre('Patricia Ortega Salinas')).toBe('Patricia');
        expect(primerNombre('  Ana  ')).toBe('Ana');
        expect(primerNombre('admin@susan.local')).toBeNull();
        expect(primerNombre('')).toBeNull();
        expect(primerNombre(undefined)).toBeNull();
    });
});
