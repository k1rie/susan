import { describe, expect, it } from 'vitest';
import { CONFIG_SESIONES, avisosAtencion, datosCamaras, datosSesiones } from './resumenAdmin.utils.js';

describe('resumenAdmin.utils', () => {
    it('datosSesiones ordena abiertas, programadas, cerradas y suspendidas y tolera faltantes', () => {
        expect(datosSesiones({ total: 8, abiertas: 1, programadas: 2, cerradas: 3, suspendidas: 2 })).toEqual([
            { clave: 'abierta', valor: 1 }, { clave: 'programada', valor: 2 }, { clave: 'cerrada', valor: 3 }, { clave: 'suspendida', valor: 2 },
        ]);
        expect(datosSesiones(undefined).map((d) => d.valor)).toEqual([0, 0, 0, 0]);
        expect(datosSesiones({ abiertas: 'x' })[0].valor).toBe(0);
    });
    it('cada clave de datosSesiones tiene etiqueta y color en CONFIG_SESIONES', () => {
        for (const d of datosSesiones({})) {
            expect(CONFIG_SESIONES[d.clave]?.label).toBeTruthy();
            expect(CONFIG_SESIONES[d.clave]?.color).toMatch(/^var\(--/);
        }
        expect(CONFIG_SESIONES.suspendida.label).toBe('Suspendidas');
    });
    it('datosCamaras separa activas e inactivas', () => {
        expect(datosCamaras({ activas: 4, inactivas: 1 })).toEqual([{ clave: 'activa', valor: 4 }, { clave: 'inactiva', valor: 1 }]);
        expect(datosCamaras(null).map((d) => d.valor)).toEqual([0, 0]);
    });
    it('avisosAtencion solo incluye los valores mayores que 0, con enlace a su pantalla', () => {
        expect(avisosAtencion({ consentimientos_por_vencer_30d: 0, plantillas_sin_indexar: 0 })).toEqual([]);
        expect(avisosAtencion({})).toEqual([]);
        const a = avisosAtencion({ consentimientos_por_vencer_30d: 1, plantillas_sin_indexar: 3 });
        expect(a.map((x) => x.titulo)).toEqual(['1 consentimiento por vencer', '3 plantillas sin indexar']);
        expect(a.map((x) => x.href)).toEqual(['/admin/alumnos', '/tecnico']);
        expect(avisosAtencion({ plantillas_sin_indexar: 2 })).toHaveLength(1);
    });
});
