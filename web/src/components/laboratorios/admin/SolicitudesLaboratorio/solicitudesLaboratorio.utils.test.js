import { describe, expect, it } from 'vitest';
import { normalizarPestana, pestanasLaboratorios } from './solicitudesLaboratorio.utils.js';

describe('normalizarPestana', () => {
    it('acepta las tres pestañas y cae a «pendientes» con cualquier otra cosa', () => {
        expect(normalizarPestana('agenda')).toBe('agenda');
        expect(normalizarPestana('historial')).toBe('historial');
        expect(normalizarPestana('pendientes')).toBe('pendientes');
        expect(normalizarPestana('otra')).toBe('pendientes');
        expect(normalizarPestana(undefined)).toBe('pendientes');
    });
});

describe('pestanasLaboratorios', () => {
    it('el contador de pendientes sale solo cuando se conoce (un 0 sí es un dato)', () => {
        expect(pestanasLaboratorios(3)[0]).toMatchObject({ id: 'pendientes', count: 3 });
        expect(pestanasLaboratorios(0)[0].count).toBe(0);
        expect(pestanasLaboratorios(null)[0].count).toBeUndefined();
        expect(pestanasLaboratorios(1).map((t) => t.label)).toEqual(['Pendientes', 'Agenda', 'Historial']);
    });
});
