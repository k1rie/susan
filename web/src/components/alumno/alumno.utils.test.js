import { describe, expect, it } from 'vitest';
import { avisoMateria, composicionRegistros, fechaCorta, lineaRegistro, resumenHistorial } from './alumno.utils.js';

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
    it('avisoMateria trae también la versión corta para las casillas, con el mismo tono', () => {
        expect(avisoMateria({ supera_limite: true })).toMatchObject({ tone: 'danger', corto: 'Sin derecho a examen' });
        expect(avisoMateria({ derecho_examen: false })).toMatchObject({ tone: 'danger', corto: 'Sin derecho a examen' });
        expect(avisoMateria({ en_limite: true })).toMatchObject({ tone: 'warning', corto: 'Una falta más y pierdes el derecho' });
        expect(avisoMateria({ faltas_restantes_antes_limite: 2 })).toMatchObject({ tone: 'info', corto: 'Cerca del límite' });
        expect(avisoMateria({ faltas_restantes_antes_limite: 0 }).texto).toBe('Te quedan 0 faltas antes del límite.');
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
    it('composicionRegistros deja los cuatro estados resueltos en orden (sin pendientes) y tolera datos raros', () => {
        expect(composicionRegistros({ presentes: 5, retardos: 1, ausencias: 2, justificadas: 3, pendientes: 4 })).toEqual([
            { clave: 'presente', valor: 5 },
            { clave: 'retardo', valor: 1 },
            { clave: 'ausente', valor: 2 },
            { clave: 'justificado', valor: 3 },
        ]);
        expect(composicionRegistros({ presentes: 'x', retardos: -2 }).map((d) => d.valor)).toEqual([0, 0, 0, 0]);
        expect(composicionRegistros(undefined).map((d) => d.valor)).toEqual([0, 0, 0, 0]);
    });
});
