import { describe, expect, it } from 'vitest';
import { motivosBloqueo, textoCompite } from './solicitudPendiente.utils.js';

const base = {
    vencida: false,
    conflicto: null,
    aula: { capacidad: 30 },
    grupo: { inscritos: 20 },
};

describe('motivosBloqueo', () => {
    it('una solicitud sin problemas se puede aprobar', () => {
        expect(motivosBloqueo(base)).toEqual([]);
    });

    it('el conflicto del servidor se lee como «No se puede aprobar: …» con un solo punto final', () => {
        const causa = 'el grupo 3A de ADM101 tiene aprobado el laboratorio de 10:00 a 12:00';
        expect(motivosBloqueo({ ...base, conflicto: causa })).toEqual([`No se puede aprobar: ${causa}.`]);
        expect(motivosBloqueo({ ...base, conflicto: `${causa}.` })).toEqual([`No se puede aprobar: ${causa}.`]);
    });

    it('una vencida explica que ya pasó la hora y que puede rechazarse', () => {
        const [motivo] = motivosBloqueo({ ...base, vencida: true });
        expect(motivo).toMatch(/^No se puede aprobar: la hora de inicio ya pasó/);
        expect(motivo).toMatch(/rechazarla/);
    });

    it('un grupo que no cabe también bloquea, con las cifras', () => {
        expect(motivosBloqueo({ ...base, grupo: { inscritos: 35 } })).toEqual([
            'No se puede aprobar: el grupo tiene 35 alumnos y el laboratorio admite 30.',
        ]);
    });

    it('junta todos los motivos en orden de importancia', () => {
        const motivos = motivosBloqueo({ ...base, vencida: true, conflicto: 'ocupado', grupo: { inscritos: 40 } });
        expect(motivos).toHaveLength(3);
        expect(motivos[0]).toMatch(/hora de inicio/);
        expect(motivos[1]).toBe('No se puede aprobar: ocupado.');
        expect(motivos[2]).toMatch(/admite 30/);
    });
});

describe('textoCompite', () => {
    it('concuerda en singular y plural y calla cuando no compite', () => {
        expect(textoCompite(1)).toBe('Compite con 1 solicitud pendiente por el mismo horario.');
        expect(textoCompite(2)).toBe('Compite con 2 solicitudes pendientes por el mismo horario.');
        expect(textoCompite(0)).toBe('');
        expect(textoCompite(undefined)).toBe('');
    });
});
