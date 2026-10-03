import { describe, expect, it } from 'vitest';
import { ApiError, fromRpcError, statusForCode } from './errors.js';

const pg = (code, extra = {}) => ({ code, message: 'texto crudo de postgres', details: null, hint: null, ...extra });

describe('ApiError', () => {
    it('expone code, message, status y details', () => {
        const e = new ApiError({ code: 'X', message: 'm', status: 418, details: { a: 1 } });
        expect(e).toBeInstanceOf(Error);
        expect([e.name, e.code, e.message, e.status, e.details]).toEqual(['ApiError', 'X', 'm', 418, { a: 1 }]);
        expect(new ApiError({ code: 'X', message: 'm' })).toMatchObject({ status: 500, details: null });
    });
});

describe('statusForCode', () => {
    it.each([
        ['NO_AUTENTICADO', 401], ['CUENTA_INACTIVA', 403], ['NO_AUTORIZADO', 403], ['NO_ENCONTRADO', 404],
        ['VALIDACION', 422], ['PERIODO_INVALIDO', 422], ['ESTADO_INVALIDO', 422], ['HORA_INVALIDA', 422],
        ['DUPLICADO', 409], ['REGISTRO_DUPLICADO', 409], ['RN_08_PLAZO_VENCIDO', 409], ['RN99_NUEVO', 409],
        ['SESION_CERRADA', 409], ['RUTA_INVALIDA', 400], ['CODIGO_DESCONOCIDO', 400],
    ])('%s -> %i', (codigo, status) => expect(statusForCode(codigo)).toBe(status));
});

describe('fromRpcError', () => {
    it('P0001 con HINT usa el codigo de negocio y el mensaje de la funcion', () => {
        const e = fromRpcError(pg('P0001', { hint: 'NO_ENCONTRADO', message: 'El alumno no existe.' }));
        expect(e).toMatchObject({ code: 'NO_ENCONTRADO', status: 404, message: 'El alumno no existe.' });
    });
    it('P0001 sin HINT es ERROR_INTERNO con el texto solo en details', () => {
        const e = fromRpcError(pg('P0001', { message: 'boom' }));
        expect(e).toMatchObject({ code: 'ERROR_INTERNO', status: 500, details: 'boom' });
        expect(e.message).not.toContain('boom');
    });
    it('23505 -> DUPLICADO 409', () => expect(fromRpcError(pg('23505'))).toMatchObject({ code: 'DUPLICADO', status: 409 }));
    it('23503 -> CONFLICTO 409', () => expect(fromRpcError(pg('23503'))).toMatchObject({ code: 'CONFLICTO', status: 409 }));
    it('23000 -> CONFLICTO 409', () => expect(fromRpcError(pg('23000'))).toMatchObject({ code: 'CONFLICTO', status: 409 }));
    it('23514 con constraint rn*_ -> codigo en mayusculas', () => {
        const e = fromRpcError(pg('23514', { constraint: 'rn01_asistencia_inscripcion_activa' }));
        expect(e).toMatchObject({ code: 'RN01_ASISTENCIA_INSCRIPCION_ACTIVA', status: 409 });
        const m = fromRpcError(pg('23514', { message: 'violates check constraint "rn05_algo"' }));
        expect(m.code).toBe('RN05_ALGO');
    });
    it('23514 de otra constraint -> VALIDACION 422', () => {
        expect(fromRpcError(pg('23514', { constraint: 'ck_creditos' }))).toMatchObject({ code: 'VALIDACION', status: 422 });
    });
    it('22xxx y 23502 -> VALIDACION 422', () => {
        expect(fromRpcError(pg('22P02'))).toMatchObject({ code: 'VALIDACION', status: 422 });
        expect(fromRpcError(pg('23502'))).toMatchObject({ code: 'VALIDACION', status: 422 });
    });
    it('errores de red -> ERROR_RED 503', () => {
        expect(fromRpcError(new TypeError('Failed to fetch'))).toMatchObject({ code: 'ERROR_RED', status: 503 });
        expect(fromRpcError({ message: 'TypeError: fetch failed', code: '' })).toMatchObject({ code: 'ERROR_RED' });
    });
    it('sin mapeo -> ERROR_INTERNO 500 sin filtrar el texto', () => {
        const e = fromRpcError(pg('XX000', { message: 'detalle interno' }));
        expect(e).toMatchObject({ code: 'ERROR_INTERNO', status: 500, details: 'detalle interno' });
        expect(e.message).not.toContain('detalle interno');
    });
    it('es idempotente con un ApiError', () => {
        const e = new ApiError({ code: 'X', message: 'm' });
        expect(fromRpcError(e)).toBe(e);
    });
});
