import { describe, expect, it } from 'vitest';
import { cierreHabilitado, estadoMostrado, formatearFecha, formatearHora, requiereRegistroManual, sugerirEstado } from './monitorSesion.utils.js';

describe('monitorSesion.utils', () => {
    it('formatea hora y fecha', () => {
        expect(formatearHora('07:00:00')).toBe('07:00');
        expect(formatearFecha('2026-09-14')).toBe('14 sep 2026');
    });
    it('sin registro muestra sin_lecturas', () => {
        expect(estadoMostrado({ estado: null })).toBe('sin_lecturas');
        expect(estadoMostrado({ estado: 'pendiente' })).toBe('pendiente');
    });
    it('registro manual solo sin consentimiento o sin lecturas validas', () => {
        expect(requiereRegistroManual({ inscripcion: 'activa', consentimiento_vigente: true, lecturas_validas: 3 })).toBe(false);
        expect(requiereRegistroManual({ inscripcion: 'activa', consentimiento_vigente: true, lecturas_validas: 0 })).toBe(true);
        expect(requiereRegistroManual({ inscripcion: 'activa', consentimiento_vigente: false, lecturas_validas: 3 })).toBe(true);
        expect(requiereRegistroManual({ inscripcion: 'baja', consentimiento_vigente: false, lecturas_validas: 0 })).toBe(false);
    });
    it('sugiere por minuto', () => {
        const s = { limite_presente_min: 10, tolerancia_min: 20 };
        expect(sugerirEstado({ ...s, minuto_actual: 5 })).toBe('presente');
        expect(sugerirEstado({ ...s, minuto_actual: 15 })).toBe('retardo');
        expect(sugerirEstado({ ...s, minuto_actual: 25 })).toBe('ausente');
    });
    it('cierre al terminar la ventana', () => {
        expect(cierreHabilitado({ estatus: 'abierta', en_ventana: true })).toBe(false);
        expect(cierreHabilitado({ estatus: 'abierta', en_ventana: false })).toBe(true);
        expect(cierreHabilitado({ estatus: 'cerrada', en_ventana: false })).toBe(false);
    });
});
