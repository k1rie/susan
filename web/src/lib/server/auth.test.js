import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers({ 'x-pathname': '/docente/revision' })) }));
vi.mock('next/navigation', () => ({
    redirect: vi.fn((destino) => { throw Object.assign(new Error('NEXT_REDIRECT'), { destino }); }),
}));

import { headers } from 'next/headers';
import { getServerBackend } from '@/lib/backend';
import { ROLES_POR_AREA, obtenerSesion, requerirSesion, verificarOrigen } from './auth.js';
import { YO, crearBackend, errorDeNegocio, pedir } from './testing.js';

const destinoDe = async (promesa) => (await promesa.catch((e) => e)).destino;

beforeEach(() => {
    getServerBackend.mockResolvedValue(crearBackend({ rpcs: { api_yo: () => YO.docente } }));
});

describe('requerirSesion (RSC)', () => {
    it('sin sesión redirige a /login conservando la ruta (solo rutas internas)', async () => {
        getServerBackend.mockResolvedValue(crearBackend({ user: null }));
        expect(await destinoDe(requerirSesion(['docente']))).toBe('/login?next=%2Fdocente%2Frevision');
        headers.mockResolvedValueOnce(new Headers({ 'x-pathname': '//evil.example/x' }));
        expect(await destinoDe(requerirSesion(['docente']))).toBe('/login');
        headers.mockResolvedValueOnce(new Headers());
        expect(await destinoDe(requerirSesion(['docente']))).toBe('/login');
    });

    it('cuenta inactiva o sin vínculo van a /login con el motivo', async () => {
        getServerBackend.mockResolvedValue(crearBackend({ rpcs: { api_yo: () => ({ ...YO.docente, activo: false }) } }));
        expect(await destinoDe(requerirSesion())).toBe('/login?error=cuenta_inactiva');
        getServerBackend.mockResolvedValue(crearBackend({ rpcs: { api_yo: () => errorDeNegocio('CUENTA_NO_VINCULADA', 'x') } }));
        expect(await destinoDe(requerirSesion())).toBe('/login?error=sin_cuenta');
    });

    it('un rol fuera del área va a su propia página de inicio', async () => {
        expect(await destinoDe(requerirSesion(['administrador']))).toBe('/docente');
        expect(await destinoDe(requerirSesion('admin'))).toBe('/docente');
    });

    it('con el rol correcto devuelve me (por lista, por área o por { roles })', async () => {
        expect((await requerirSesion(['docente'])).rol).toBe('docente');
        expect((await requerirSesion('reportes')).rol).toBe('docente');
        expect((await requerirSesion({ roles: ['docente'] })).rol).toBe('docente');
        expect((await requerirSesion()).rol).toBe('docente');
    });

    it('un error inesperado de api_yo se relanza (no se disfraza de sesión inválida)', async () => {
        getServerBackend.mockResolvedValue(crearBackend({ rpcs: { api_yo: () => ({ __error: { code: 'XX000', message: 'x', hint: null, details: null } }) } }));
        await expect(obtenerSesion()).rejects.toMatchObject({ code: 'ERROR_INTERNO' });
    });

    it('ROLES_POR_AREA cubre las áreas de ARCHITECTURE §3', () => {
        expect(Object.keys(ROLES_POR_AREA).sort()).toEqual(['admin', 'alumno', 'analitica', 'docente', 'reportes', 'tecnico']);
        expect(ROLES_POR_AREA.tecnico).toContain('administrador');
    });
});

describe('verificarOrigen', () => {
    it('GET nunca se verifica; sin Origin pasa; Origin "null" o ajeno se rechaza', () => {
        expect(() => verificarOrigen(pedir('/x', { method: 'GET', headers: { origin: 'https://malo.example' } }))).not.toThrow();
        expect(() => verificarOrigen(pedir('/x', { json: {} }))).not.toThrow();
        expect(() => verificarOrigen(pedir('/x', { json: {}, headers: { origin: 'null' } }))).toThrow(/Origen/);
        expect(() => verificarOrigen(pedir('/x', { json: {}, headers: { origin: 'https://malo.example', host: 'app.test' } }))).toThrow(/Origen/);
        expect(() => verificarOrigen(pedir('/x', { json: {}, headers: { origin: 'https://app.test', host: 'interno:3000', 'x-forwarded-host': 'app.test' } }))).not.toThrow();
    });
});
