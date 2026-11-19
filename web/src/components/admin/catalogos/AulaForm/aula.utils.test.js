import { describe, expect, it } from 'vitest';
import { aulaInicial, datosAula, errorDeCampoAula, esLaboratorio, INICIAL_AULA } from './aula.utils.js';

const valores = { clave: 'lab-1', edificio: ' Edificio  C ', capacidad: '30', tipo: 'aula' };

describe('tipo del aula', () => {
    it('esLaboratorio solo es verdadero para tipo laboratorio', () => {
        expect(esLaboratorio({ tipo: 'laboratorio' })).toBe(true);
        expect(esLaboratorio({ tipo: 'aula' })).toBe(false);
        expect(esLaboratorio({})).toBe(false);
        expect(esLaboratorio(null)).toBe(false);
    });

    it('el alta arranca como aula y el registro sin tipo se lee como aula', () => {
        expect(INICIAL_AULA.tipo).toBe('aula');
        expect(aulaInicial(null).tipo).toBe('aula');
        expect(aulaInicial({ clave: 'A-1', edificio: 'A', capacidad: 30 }).tipo).toBe('aula');
        expect(aulaInicial({ clave: 'LAB-1', edificio: 'C', capacidad: 30, tipo: 'laboratorio' }).tipo).toBe('laboratorio');
    });
});

describe('datosAula: el tipo viaja solo cuando importa', () => {
    it('un alta como aula no lo manda (el servidor la crea como aula)', () => {
        expect(datosAula(valores, null)).toEqual({ clave: 'LAB-1', edificio: 'Edificio C', capacidad: 30 });
    });

    it('un alta como laboratorio lo manda', () => {
        expect(datosAula({ ...valores, tipo: 'laboratorio' }, null)).toEqual({
            clave: 'LAB-1',
            edificio: 'Edificio C',
            capacidad: 30,
            tipo: 'laboratorio',
        });
    });

    it('editar un laboratorio sin cambiarle el tipo no lo manda (se conserva)', () => {
        const item = { id_aula: 3, clave: 'LAB-1', edificio: 'Edificio C', capacidad: 30, tipo: 'laboratorio' };
        expect(datosAula({ ...valores, tipo: 'laboratorio' }, item)).toEqual({ id_aula: 3, clave: 'LAB-1', edificio: 'Edificio C', capacidad: 30 });
    });

    it('cambiarlo en una edición sí lo manda, en los dos sentidos', () => {
        const aula = { id_aula: 4, clave: 'A-1', edificio: 'A', capacidad: 30 };
        expect(datosAula({ ...valores, tipo: 'laboratorio' }, aula).tipo).toBe('laboratorio');
        const lab = { id_aula: 3, clave: 'LAB-1', edificio: 'C', capacidad: 30, tipo: 'laboratorio' };
        expect(datosAula({ ...valores, tipo: 'aula' }, lab).tipo).toBe('aula');
    });
});

describe('errorDeCampoAula', () => {
    it('AULA_TIPO_CON_SOLICITUDES queda junto al selector de tipo con el texto del servidor', () => {
        const mensaje = 'El laboratorio tiene solicitudes pendientes o aprobadas; resuélvelas o cancélalas antes de cambiar su tipo.';
        expect(errorDeCampoAula({ code: 'AULA_TIPO_CON_SOLICITUDES', message: mensaje })).toEqual({ tipo: mensaje });
    });

    it('los errores de siempre siguen yendo a su campo', () => {
        expect(errorDeCampoAula({ code: 'DUPLICADO', message: 'Ya existe.' })).toEqual({ clave: 'Ya existe.' });
        expect(errorDeCampoAula({ code: 'AULA_CAPACIDAD_INSUFICIENTE', message: 'Muy poca.' })).toEqual({ capacidad: 'Muy poca.' });
    });
});
