import { describe, expect, it } from 'vitest';
import { conteoMarcas } from './paseListaManual.utils.js';

describe('paseListaManual.utils', () => {
    it('cuenta los alumnos marcados y el avance', () => {
        const activos = [{ id_alumno: 1 }, { id_alumno: 2 }, { id_alumno: 3 }, { id_alumno: 4 }];
        expect(conteoMarcas(activos, { 1: 'presente', 2: '', 3: 'ausente' })).toEqual({ marcados: 2, total: 4, ancho: 50 });
    });
    it('sin alumnos o sin marcas no divide entre cero', () => {
        expect(conteoMarcas([], {})).toEqual({ marcados: 0, total: 0, ancho: 0 });
        expect(conteoMarcas(undefined, undefined)).toEqual({ marcados: 0, total: 0, ancho: 0 });
        expect(conteoMarcas([{ id_alumno: 1 }], undefined).marcados).toBe(0);
    });
});
