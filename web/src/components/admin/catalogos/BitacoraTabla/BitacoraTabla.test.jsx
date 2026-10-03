// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { armarFiltros, FILTROS_VACIOS, jsonLegible } from './bitacora.utils.js';

describe('filtros de bitácora', () => {
    it('omite los vacíos y convierte el usuario a número', () => {
        expect(armarFiltros(FILTROS_VACIOS)).toEqual({ args: {}, error: null });
        const { args } = armarFiltros({ accion: 'consulta', entidad: ' deteccion ', idUsuario: '7', desde: '2026-09-01', hasta: '2026-09-14' });
        expect(args).toEqual({ accion: 'consulta', entidad: 'deteccion', idUsuario: 7, desde: '2026-09-01', hasta: '2026-09-14' });
    });

    it('rechaza rango invertido y usuario no numérico', () => {
        expect(armarFiltros({ ...FILTROS_VACIOS, desde: '2026-09-10', hasta: '2026-09-01' }).error).toMatch(/fecha inicial/);
        expect(armarFiltros({ ...FILTROS_VACIOS, idUsuario: 'abc' }).error).toMatch(/número/);
    });

    it('formatea JSON legible', () => {
        expect(jsonLegible(null)).toBeNull();
        expect(jsonLegible({ a: 1 })).toBe('{\n  "a": 1\n}');
    });
});
