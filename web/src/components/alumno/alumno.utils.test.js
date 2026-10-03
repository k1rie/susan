import { describe, expect, it } from 'vitest';
import { avisoMateria, fechaCorta, lineaRegistro, resumenHistorial } from './alumno.utils.js';

describe('alumno.utils', () => {
    it('fechaCorta formatea dd/mm/aaaa y tolera valores vacíos', () => {
        expect(fechaCorta('2026-09-10T12:00:00')).toBe('10/09/2026');
        expect(fechaCorta(null)).toBe('');
    });
    it('avisoMateria prioriza límite superado, en límite y pocas faltas restantes', () => {
        expect(avisoMateria({ supera_limite: true }).tone).toBe('danger');
        expect(avisoMateria({ en_limite: true }).tone).toBe('warning');
        expect(avisoMateria({ faltas_restantes_antes_limite: 1 }).texto).toBe('Te quedan 1 falta antes del límite.');
        expect(avisoMateria({ faltas_restantes_antes_limite: 5 })).toBeNull();
        expect(avisoMateria(null)).toBeNull();
    });
    it('lineaRegistro une origen y hora; vacía si no hay ninguno', () => {
        expect(lineaRegistro({ origen: 'manual', hora_registro: '2026-09-10T08:03:00' })).toBe('Manual · 08:03');
        expect(lineaRegistro({ origen: 'correccion' })).toBe('Corrección');
        expect(lineaRegistro({})).toBe('');
        expect(lineaRegistro(null)).toBe('');
    });
    it('resumenHistorial: "32 sesiones · 12 ausencias" con singulares', () => {
        expect(resumenHistorial(32, { ausencias: 12 })).toBe('32 sesiones · 12 ausencias');
        expect(resumenHistorial(1, { ausencias: 1 })).toBe('1 sesión · 1 ausencia');
        expect(resumenHistorial(5, null)).toBe('5 sesiones');
    });
});
