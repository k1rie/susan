import { describe, expect, it } from 'vitest';
import { estatusDeFiltro, FILTROS, filtroTrasCrear, itemsDePills, textoCancelacion, textoResultado, unirPaginas, VACIOS } from './laboratoriosDocente.utils.js';

describe('filtros', () => {
    it('«todas» no filtra y los demás mandan su estatus', () => {
        expect(estatusDeFiltro('todas')).toBeUndefined();
        expect(estatusDeFiltro('pendiente')).toBe('pendiente');
    });

    it('las píldoras llevan el contador de cada estatus y el total en «Todas»', () => {
        const items = itemsDePills({ pendiente: 2, aprobada: 5, rechazada: 1, cancelada: 0, total: 8 });
        expect(items.map((i) => [i.id, i.count])).toEqual([['todas', 8], ['pendiente', 2], ['aprobada', 5], ['rechazada', 1], ['cancelada', 0]]);
        expect(itemsDePills(null).every((i) => i.count === 0)).toBe(true);
    });

    it('cada filtro tiene su estado vacío', () => {
        for (const f of FILTROS) expect(VACIOS[f.id].title).toBeTruthy();
    });

    it('tras crear una solicitud solo se cambia el filtro si la ocultaría', () => {
        expect(filtroTrasCrear('todas')).toBe('todas');
        expect(filtroTrasCrear('pendiente')).toBe('pendiente');
        expect(filtroTrasCrear('aprobada')).toBe('pendiente');
        expect(filtroTrasCrear('cancelada')).toBe('pendiente');
    });
});

describe('unirPaginas', () => {
    it('conserva el orden y no repite solicitudes', () => {
        const a = [{ id_solicitud: 1 }, { id_solicitud: 2 }];
        const b = [{ id_solicitud: 2 }, { id_solicitud: 3 }];
        expect(unirPaginas(a, b).map((x) => x.id_solicitud)).toEqual([1, 2, 3]);
        expect(unirPaginas(undefined, undefined)).toEqual([]);
    });
});

describe('textos', () => {
    const s = { estatus: 'pendiente', fecha: '2026-09-17', hora_inicio: '10:00', hora_fin: '12:00', aula: { clave: 'LAB-1' } };

    it('el diálogo de cancelación dice qué se cancela y qué pasa', () => {
        expect(textoCancelacion(s)).toBe('¿Cancelar la solicitud de LAB-1, jue 17 sep, 10:00 – 12:00? Se retirará de la revisión del administrador.');
        expect(textoCancelacion({ ...s, estatus: 'aprobada' })).toContain('Ya está aprobada');
    });

    it('el resultado solo aparece si hay más por cargar', () => {
        expect(textoResultado(50, 83)).toBe('Mostrando 50 de 83 solicitudes');
        expect(textoResultado(83, 83)).toBe('');
    });
});
