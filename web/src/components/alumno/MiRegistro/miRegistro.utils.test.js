import { describe, expect, it } from 'vitest';
import { fechaLarga, origenConsentimiento, pasosDe, registrosRestantes, textoDiasRestantes } from './miRegistro.utils.js';

describe('pasosDe', () => {
    const estados = (paso) => pasosDe(paso).map((p) => p.estado);
    it('el primer paso es el actual y los demás esperan', () => expect(estados('consentimiento')).toEqual(['actual', 'pendiente', 'pendiente']));
    it('con el aviso aceptado, el rostro es el actual', () => expect(estados('rostro')).toEqual(['hecho', 'actual', 'pendiente']));
    it('con el registro completo los tres pasos quedan hechos', () => expect(estados('listo')).toEqual(['hecho', 'hecho', 'hecho']));
    it('trae etiquetas y ids estables', () => expect(pasosDe('listo').map((p) => p.id)).toEqual(['consentimiento', 'rostro', 'listo']));
});

describe('fechaLarga', () => {
    it('escribe la fecha en español sin desfase de zona horaria', () => {
        expect(fechaLarga('2027-10-07')).toBe('7 de octubre de 2027');
        expect(fechaLarga('2027-01-01')).toBe('1 de enero de 2027');
    });
    it('acepta un instante ISO y toma solo la fecha', () => expect(fechaLarga('2026-10-07T09:12:41-06:00')).toBe('7 de octubre de 2026'));
    it('devuelve vacío con algo que no es fecha', () => {
        expect(fechaLarga(null)).toBe('');
        expect(fechaLarga('mañana')).toBe('');
    });
});

describe('registrosRestantes', () => {
    it('resta lo usado del límite y nunca baja de cero', () => {
        expect(registrosRestantes({ limite_registros_24h: 5, registros_24h: 2 })).toBe(3);
        expect(registrosRestantes({ limite_registros_24h: 5, registros_24h: 9 })).toBe(0);
        expect(registrosRestantes(null)).toBe(0);
    });
});

describe('origenConsentimiento y textoDiasRestantes', () => {
    it('dice quién lo dio de alta', () => {
        expect(origenConsentimiento({ origen: 'alumno' })).toBe('Lo aceptaste en la app');
        expect(origenConsentimiento({ origen: 'administrador' })).toBe('Lo registró tu coordinación');
    });
    it('redacta lo que falta para que venza', () => {
        expect(textoDiasRestantes(0)).toBe('Vence hoy');
        expect(textoDiasRestantes(1)).toBe('Vence mañana');
        expect(textoDiasRestantes(40)).toBe('Vence en 40 días');
        expect(textoDiasRestantes(undefined)).toBe('');
    });
});
