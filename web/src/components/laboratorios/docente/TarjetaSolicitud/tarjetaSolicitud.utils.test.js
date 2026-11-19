import { describe, expect, it } from 'vitest';
import { duracionSolicitud, notaDeEstado, puedeCancelar, resumenSolicitud, rotuloComentario, yaInicio } from './tarjetaSolicitud.utils.js';

const base = { id_solicitud: 7, fecha: '2026-09-17', hora_inicio: '10:00', hora_fin: '12:00', aula: { clave: 'LAB-1' }, vencida: false };
const ANTES = { hoy: '2026-09-16', hora: '09:00' };
const DESPUES = { hoy: '2026-09-17', hora: '10:30' };

describe('puedeCancelar', () => {
    it('una pendiente siempre se puede cancelar, también la vencida', () => {
        expect(puedeCancelar({ ...base, estatus: 'pendiente' }, ANTES)).toBe(true);
        expect(puedeCancelar({ ...base, estatus: 'pendiente', vencida: true }, DESPUES)).toBe(true);
    });

    it('una aprobada solo mientras no ha iniciado (el servidor no manda `vencida` para ellas)', () => {
        expect(puedeCancelar({ ...base, estatus: 'aprobada' }, ANTES)).toBe(true);
        expect(puedeCancelar({ ...base, estatus: 'aprobada' }, DESPUES)).toBe(false);
        expect(puedeCancelar({ ...base, estatus: 'aprobada' }, { hoy: '2026-09-17', hora: '10:00' })).toBe(false);
        expect(puedeCancelar({ ...base, estatus: 'aprobada' }, { hoy: '2026-09-17', hora: '09:59' })).toBe(true);
    });

    it('rechazadas y canceladas ya no se cancelan', () => {
        expect(puedeCancelar({ ...base, estatus: 'rechazada' }, ANTES)).toBe(false);
        expect(puedeCancelar({ ...base, estatus: 'cancelada' }, ANTES)).toBe(false);
    });
});

describe('yaInicio', () => {
    it('compara contra el reloj del plantel', () => {
        expect(yaInicio(base, ANTES)).toBe(false);
        expect(yaInicio(base, DESPUES)).toBe(true);
        expect(yaInicio(base, null)).toBe(false);
    });
});

describe('textos', () => {
    it('nota de estado solo para pendientes', () => {
        expect(notaDeEstado({ ...base, estatus: 'pendiente' })).toBe('Esperando la revisión del administrador.');
        expect(notaDeEstado({ ...base, estatus: 'pendiente', vencida: true })).toBe('La hora de inicio ya pasó sin que se resolviera. Solo puedes cancelarla.');
        expect(notaDeEstado({ ...base, estatus: 'aprobada' })).toBeNull();
    });

    it('rótulo del comentario según el desenlace', () => {
        expect(rotuloComentario('rechazada')).toBe('Motivo del rechazo');
        expect(rotuloComentario('cancelada')).toBe('Motivo de la cancelación');
        expect(rotuloComentario('aprobada')).toBe('Comentario del administrador');
        expect(rotuloComentario('otra')).toBe('Comentario');
    });

    it('resumen y duración', () => {
        expect(resumenSolicitud(base)).toBe('LAB-1, jue 17 sep, 10:00 – 12:00');
        expect(duracionSolicitud(base)).toBe('2 h');
    });
});
