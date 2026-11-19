import { describe, expect, it } from 'vitest';
import { etiquetaComentario, lineaResolucion, pastillasHistorial, textoVacioHistorial } from './historialSolicitudes.utils.js';

describe('pastillasHistorial', () => {
    it('ofrece solo las resueltas, con el contador de cada una', () => {
        expect(pastillasHistorial({ pendiente: 4, aprobada: 5, rechazada: 2, cancelada: 0, total: 11 })).toEqual([
            { id: 'aprobada', label: 'Aprobadas', count: 5 },
            { id: 'rechazada', label: 'Rechazadas', count: 2 },
            { id: 'cancelada', label: 'Canceladas', count: 0 },
        ]);
    });

    it('mientras no hay conteos no inventa ceros', () => {
        expect(pastillasHistorial(null).map((p) => p.count)).toEqual([undefined, undefined, undefined]);
    });
});

describe('textos del historial', () => {
    it('el vacío dice qué estatus y si hay un laboratorio filtrado', () => {
        expect(textoVacioHistorial('rechazada', false)).toBe('Aún no hay solicitudes rechazadas.');
        expect(textoVacioHistorial('aprobada', true)).toBe('No hay solicitudes aprobadas para este laboratorio.');
    });

    it('la línea de resolución dice estatus, quién y cuándo (en la zona de la sede)', () => {
        expect(lineaResolucion({ estatus: 'aprobada', resuelto_por: 'admin@unach.mx', fecha_resolucion: '2026-09-14T13:12:00+00:00' }))
            .toBe('Aprobada por admin@unach.mx · lun 14 sep, 07:12');
        expect(lineaResolucion({ estatus: 'cancelada', resuelto_por: null, fecha_resolucion: null })).toBe('Cancelada');
    });

    it('el rótulo del comentario depende de cómo terminó', () => {
        expect(etiquetaComentario('rechazada')).toBe('Motivo del rechazo');
        expect(etiquetaComentario('cancelada')).toBe('Motivo de la cancelación');
        expect(etiquetaComentario('aprobada')).toBe('Comentario');
    });
});
