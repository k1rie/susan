import { describe, expect, it } from 'vitest';
import { campoDeError, mensajeDeError, normalizarCodigo, textoONulo } from './comun.js';

describe('comun de catálogos', () => {
    it('mensajeDeError usa el texto del servidor o uno genérico', () => {
        expect(mensajeDeError({ message: 'Ya existe un aula con la clave A-12.' })).toBe('Ya existe un aula con la clave A-12.');
        expect(mensajeDeError(null)).toBe('No se pudo completar la acción.');
    });

    it('textoONulo recorta y convierte vacío en null', () => {
        expect(textoONulo('  Ruiz ')).toBe('Ruiz');
        expect(textoONulo('   ')).toBeNull();
        expect(textoONulo(undefined)).toBeNull();
    });

    it('normalizarCodigo deja mayúsculas, letras y dígitos sin perder las acentuadas', () => {
        expect(normalizarCodigo(' d-001 ')).toBe('D001');
        expect(normalizarCodigo('ádm 101')).toBe('ADM101');
        expect(normalizarCodigo(null)).toBe('');
    });

    describe('campoDeError', () => {
        const reglas = [
            { codigo: 'DUPLICADO', patron: /correo/i, campo: 'correo' },
            { codigo: 'DUPLICADO', campo: 'clave' },
            { codigo: 'VALIDACION', patron: /edificio/i, campo: 'edificio' },
        ];

        it('pega el error al campo cuyo código y texto coinciden, con el mensaje del servidor', () => {
            const error = { code: 'DUPLICADO', message: 'Ya existe un docente con ese correo institucional.' };
            expect(campoDeError(error, reglas)).toEqual({ correo: error.message });
        });

        it('gana la primera regla que coincide (el correo antes que la clave)', () => {
            expect(campoDeError({ code: 'DUPLICADO', message: 'Ya existe un aula con la clave A-12.' }, reglas)).toEqual({
                clave: 'Ya existe un aula con la clave A-12.',
            });
        });

        it('sin coincidencia devuelve null: el error es general', () => {
            expect(campoDeError({ code: 'ERROR_RED', message: 'Sin conexión' }, reglas)).toBeNull();
            expect(campoDeError({ code: 'VALIDACION', message: 'La capacidad debe ser positiva.' }, reglas)).toBeNull();
            expect(campoDeError(null, reglas)).toBeNull();
        });
    });
});
