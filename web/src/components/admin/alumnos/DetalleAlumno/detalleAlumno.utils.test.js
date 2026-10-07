import { describe, expect, it } from 'vitest';
import { inscripcionesActivas, resumenFicha, textosConfirmacionEstatus } from './detalleAlumno.utils.js';

const FICHA = {
    id_alumno: 1,
    consentimiento_vigente: true,
    plantilla: { id_plantilla: 1, indexada: true },
    inscripciones: [{ id_inscripcion: 1, estatus: 'activa' }, { id_inscripcion: 2, estatus: 'baja' }, { id_inscripcion: 3, estatus: 'activa' }],
};

describe('inscripcionesActivas', () => {
    it('cuenta solo las activas', () => {
        expect(inscripcionesActivas(FICHA)).toBe(2);
        expect(inscripcionesActivas({})).toBe(0);
        expect(inscripcionesActivas(null)).toBe(0);
    });
});

describe('textosConfirmacionEstatus', () => {
    it('dice cuántas inscripciones activas se darán de baja y que reactivar no las restituye', () => {
        const t = textosConfirmacionEstatus({ estatus: 'baja_temporal', nombre: 'Soto Carla', inscripciones: 2 });
        expect(t.title).toBe('¿Dar de baja temporal a Soto Carla?');
        expect(t.confirmLabel).toBe('Dar de baja temporal');
        expect(t.message).toMatch(/Se darán de baja sus 2 inscripciones activas\./);
        expect(t.message).toMatch(/tendrás que inscribirlo de nuevo/);
    });

    it('singular, sin inscripciones y egreso', () => {
        expect(textosConfirmacionEstatus({ estatus: 'baja_definitiva', nombre: 'X', inscripciones: 1 }).message).toMatch(/sus 1 inscripción activa\./);
        expect(textosConfirmacionEstatus({ estatus: 'baja_definitiva', nombre: 'X', inscripciones: 0 }).message).toMatch(/No tiene inscripciones activas\./);
        const egreso = textosConfirmacionEstatus({ estatus: 'egresado', nombre: 'X', inscripciones: 0 });
        expect(egreso.title).toBe('¿Marcar a X como egresado?');
        expect(egreso.confirmLabel).toBe('Marcar como egresado');
    });
});

describe('resumenFicha', () => {
    it('enlaza cada elemento a su tarjeta y dice su estado en texto', () => {
        const items = resumenFicha(FICHA, { estado: 'activa' });
        expect(items.map((i) => [i.href, i.texto, i.ok])).toEqual([
            ['#consentimiento', 'Vigente', true],
            ['#plantilla', 'Activa', true],
            ['#cuenta', 'Creada', true],
            ['#inscripciones', '2 activas', true],
        ]);
    });

    it('lo que falta queda como pendiente', () => {
        const items = resumenFicha({ consentimiento_vigente: false, plantilla: null, inscripciones: [] }, { estado: 'sin' });
        expect(items.map((i) => [i.texto, i.ok])).toEqual([['Pendiente', false], ['Pendiente', false], ['Pendiente', false], ['Ninguna', false]]);
    });

    it('estados de la cuenta mientras carga, con error o desactivada; plantilla sin indexar', () => {
        expect(resumenFicha(FICHA, { estado: 'cargando' })[2].texto).toBe('Comprobando…');
        expect(resumenFicha(FICHA, { estado: 'error' })[2].texto).toBe('Sin comprobar');
        expect(resumenFicha(FICHA, { estado: 'inactiva' })[2]).toMatchObject({ texto: 'Desactivada', ok: false });
        expect(resumenFicha({ ...FICHA, plantilla: { indexada: false } }, { estado: 'sin' })[1].texto).toBe('Sin indexar');
    });
});
