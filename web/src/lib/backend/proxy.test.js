import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearTokenSesion } from '@/lib/local/session.js';

const config = vi.hoisted(() => ({ local: true }));
vi.mock('@/config', async (original) => {
    const real = await original();
    return {
        ...real,
        get IS_LOCAL() {
            return config.local;
        },
    };
});

const SUB = '34cf6120-b7b9-b9cd-2db5-2f108d40b771';
const pedir = (ruta, cookie) =>
    new NextRequest(`http://localhost:3000${ruta}`, { headers: cookie ? { cookie: `susan_local_session=${cookie}` } : {} });

beforeEach(() => {
    config.local = true;
});

describe('proxy.js (modo local)', () => {
    it.each(['/docente', '/docente/sesiones/5', '/alumno', '/admin/grupos', '/tecnico', '/reportes', '/analitica'])(
        'sin sesion redirige %s a /login?next=',
        async (ruta) => {
            const { proxy } = await import('@/proxy.js');
            const res = await proxy(pedir(`${ruta}?a=1`));
            expect(res.status).toBe(307);
            const destino = new URL(res.headers.get('location'));
            expect(destino.pathname).toBe('/login');
            expect(destino.searchParams.get('next')).toBe(`${ruta}?a=1`);
        },
    );

    it('/cambiar-contrasena es publica (el token de recuperacion llega en el hash y lo procesa el cliente)', async () => {
        const { proxy } = await import('@/proxy.js');
        const res = await proxy(pedir('/cambiar-contrasena'));
        expect(res.status).toBe(200);
    });

    it('con cookie valida deja pasar', async () => {
        const { proxy } = await import('@/proxy.js');
        const res = await proxy(pedir('/docente', crearTokenSesion(SUB)));
        expect(res.status).toBe(200);
        expect(res.headers.get('location')).toBeNull();
    });

    it('cookie vencida, manipulada o de otro secreto: redirige', async () => {
        const { proxy } = await import('@/proxy.js');
        for (const c of [crearTokenSesion(SUB, { ahoraSeg: 1000 }), 'x.y', crearTokenSesion(SUB, { secreto: 'otro' })]) {
            expect((await proxy(pedir('/admin', c))).status).toBe(307);
        }
    });

    it('rutas publicas y /api/* nunca se redirigen', async () => {
        const { proxy } = await import('@/proxy.js');
        for (const ruta of ['/', '/login', '/recuperar', '/api/sesiones/1/captura', '/api/_local/rpc/api_yo', '/administrador', '/docentes-x']) {
            const res = await proxy(pedir(ruta));
            expect(res.status, ruta).toBe(200);
        }
    });

    it('no hace comprobacion de rol: cualquier sesion valida pasa a cualquier area', async () => {
        const { proxy } = await import('@/proxy.js');
        expect((await proxy(pedir('/admin', crearTokenSesion(SUB)))).status).toBe(200);
    });
});

describe('matcher del proxy', () => {
    it('excluye estaticos, brand, favicon, jobs, _local y salud; incluye paginas y /api normales', async () => {
        const { config: cfg } = await import('@/proxy.js');
        const re = new RegExp(`^${cfg.matcher[0]}$`);
        for (const excluida of ['/_next/static/a.js', '/_next/image', '/brand/logo.svg', '/favicon.ico', '/api/jobs/cerrar-sesiones', '/api/_local/auth/login', '/api/salud', '/x/logo.png']) {
            expect(re.test(excluida), excluida).toBe(false);
        }
        for (const incluida of ['/', '/login', '/docente', '/admin/grupos/3', '/api/sesiones/1/captura']) {
            expect(re.test(incluida), incluida).toBe(true);
        }
    });
});
