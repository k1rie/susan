import { describe, expect, it } from 'vitest';
import { datosPlantillas, fechaHora, porcentajeIndexado, resumenPlantillas, textoPlantillas, textoVersiones } from './indiceFacial.utils.js';

describe('indiceFacial.utils', () => {
    it('datosPlantillas y porcentaje de indexadas', () => {
        const p = { activas: 500, indexadas: 498, pendientes: 2, obsoletas_en_indice: 0 };
        expect(datosPlantillas(p)).toEqual([{ clave: 'indexada', valor: 498 }, { clave: 'pendiente', valor: 2 }]);
        expect(porcentajeIndexado(p)).toBe(100);
        expect(porcentajeIndexado({ indexadas: 1, pendientes: 3 })).toBe(25);
    });
    it('sin plantillas todo es 0 y el texto alternativo lo dice', () => {
        expect(datosPlantillas(undefined).map((d) => d.valor)).toEqual([0, 0]);
        expect(porcentajeIndexado({})).toBe(0);
        expect(resumenPlantillas({})).toBe('No hay plantillas activas.');
    });
    it('el texto alternativo menciona las obsoletas solo si las hay', () => {
        expect(resumenPlantillas({ indexadas: 3, pendientes: 1 })).toBe('Indexadas: 3 (75 %); Pendientes: 1 (25 %).');
        expect(resumenPlantillas({ indexadas: 3, pendientes: 1, obsoletas_en_indice: 2 })).toMatch(/Obsoletas en el índice: 2\./);
    });
    it('fechaHora con guion si no hay fecha', () => {
        expect(fechaHora(null)).toBe('-');
        expect(fechaHora('2026-03-12T10:00:00Z')).not.toBe('-');
    });
    it('los resúmenes de los Detalles llevan unidad y concuerdan en número', () => {
        expect(textoPlantillas(1)).toBe('1 plantilla');
        expect(textoPlantillas(3)).toBe('3 plantillas');
        expect(textoVersiones(1)).toBe('1 versión');
        expect(textoVersiones(3)).toBe('3 versiones');
    });
});
