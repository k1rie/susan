import { describe, expect, it, vi } from 'vitest';
import { callRpc, rpcName, toRpcArgs } from './client.js';
import { ApiError } from './errors.js';

describe('toRpcArgs', () => {
    it('convierte camelCase a p_snake_case', () => {
        expect(toRpcArgs({ idSesion: 3, marcarRestantes: true })).toEqual({ p_id_sesion: 3, p_marcar_restantes: true });
    });
    it('descarta undefined y conserva null', () => {
        expect(toRpcArgs({ idGrupo: 1, q: undefined, estatus: null })).toEqual({ p_id_grupo: 1, p_estatus: null });
    });
    it('serializa Date y no toca el contenido de jsonb', () => {
        const r = toRpcArgs({ hora: new Date('2026-09-14T10:00:00Z'), registros: [{ id_alumno: 1 }] });
        expect(r.p_hora).toBe('2026-09-14T10:00:00.000Z');
        expect(r.p_registros).toEqual([{ id_alumno: 1 }]);
    });
    it('mapea datos y p al parametro jsonb p', () => {
        expect(toRpcArgs({ datos: { a: 1 } })).toEqual({ p: { a: 1 } });
        expect(toRpcArgs({ idUsuario: 2, p: { activo: false } })).toEqual({ p_id_usuario: 2, p: { activo: false } });
    });
});

describe('rpcName', () => {
    it('acepta api_ y svc_ y rechaza lo demas', () => {
        expect(rpcName('api_yo')).toBe('api_yo');
        expect(() => rpcName('pg_sleep')).toThrow(ApiError);
        expect(() => rpcName('api_Yo')).toThrow(ApiError);
    });
});

describe('callRpc', () => {
    it('devuelve data con el backend inyectado', async () => {
        const backend = { rpc: vi.fn().mockResolvedValue({ data: { ok: 1 }, error: null }) };
        await expect(callRpc('api_abrir_sesion', { idSesion: 5 }, { backend })).resolves.toEqual({ ok: 1 });
        expect(backend.rpc).toHaveBeenCalledWith('api_abrir_sesion', { p_id_sesion: 5 });
    });
    it('lanza ApiError con el codigo de negocio', async () => {
        const backend = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', hint: 'SESION_CERRADA', message: 'Cerrada' } }) };
        await expect(callRpc('api_abrir_sesion', {}, { backend })).rejects.toMatchObject({ code: 'SESION_CERRADA', status: 409 });
    });
    it('envuelve fallos de red', async () => {
        const backend = { rpc: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) };
        await expect(callRpc('api_yo', {}, { backend })).rejects.toMatchObject({ code: 'ERROR_RED', status: 503 });
    });
    it('sin backend en servidor lanza ERROR_INTERNO', async () => {
        await expect(callRpc('api_yo')).rejects.toMatchObject({ code: 'ERROR_INTERNO' });
    });
});
