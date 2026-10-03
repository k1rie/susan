import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { URL_BD_PRUEBAS, bdDisponible } from '@/lib/local/db.testutil.js';

// IS_LOCAL dinamico (ver handlers.test.js): evita reimportar modulos para cambiar de modo.
const config = vi.hoisted(() => ({ local: true }));
vi.mock('@/config', async (original) => {
    const real = await original();
    return {
        ...real,
        get IS_LOCAL() {
            return config.local;
        },
        get SUPABASE_URL() {
            return config.url ?? '';
        },
        get SUPABASE_ANON_KEY() {
            return config.url ? 'anon-prueba' : '';
        },
    };
});

// cookies de Next: un almacen de cookies de mentira con la misma forma que usa el adaptador.
const almacen = vi.hoisted(() => {
    const mapa = new Map();
    return {
        mapa,
        get: (n) => (mapa.has(n) ? { name: n, value: mapa.get(n) } : undefined),
        getAll: () => [...mapa].map(([name, value]) => ({ name, value })),
        set: vi.fn((n, v) => mapa.set(n, v)),
        delete: vi.fn((n) => mapa.delete(n)),
    };
});
vi.mock('./cookies.js', () => ({ cookiesDePeticion: async () => almacen }));

const hayBd = await bdDisponible();
const SUPERFICIE_AUTH = ['getUser', 'getSession', 'signInWithPassword', 'signOut', 'resetPasswordForEmail', 'updateUser', 'onAuthStateChange'];

beforeEach(() => {
    // Next define NEXT_RUNTIME='nodejs' en el servidor; index.js lo usa para sacar server.js del bundle del navegador.
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    config.local = true;
    config.url = '';
    almacen.mapa.clear();
    almacen.set.mockClear();
    almacen.delete.mockClear();
});

describe('restringir (superficie permitida del modo real)', () => {
    it('expone solo la superficie del contrato y nunca .from()', async () => {
        const { restringir } = await import('./surface.js');
        const llamadas = [];
        const falso = {
            auth: new Proxy({ admin: {} }, { get: (t, k) => (k === 'admin' ? new Proxy({}, { get: (_t, m) => (...a) => llamadas.push(['admin', m, a]) }) : (...a) => llamadas.push(['auth', k, a])) }),
            rpc: (n, a) => ({ then: (ok) => ok({ data: { n, a }, error: null }) }),
            from: () => {
                throw new Error('no debe usarse');
            },
            storage: { from: () => new Proxy({}, { get: (_t, k) => (...a) => llamadas.push(['storage', k, a]) }) },
        };
        const b = restringir(falso);
        expect(Object.keys(b).sort()).toEqual(['auth', 'rpc', 'storage']);
        expect(Object.keys(b.auth).sort()).toEqual([...SUPERFICIE_AUTH, 'verifyOtp'].sort());
        expect(Object.keys(b.storage.from('x')).sort()).toEqual(['createSignedUrl', 'download', 'remove', 'upload']);
        expect(b.from).toBeUndefined();
        expect(await b.rpc('api_yo')).toEqual({ data: { n: 'api_yo', a: {} }, error: null });

        const a = restringir(falso, { admin: true });
        expect(Object.keys(a.auth.admin).sort()).toEqual(['createUser', 'deleteUser', 'listUsers', 'updateUserById']);
    });
});

describe('index.js fuera del runtime de servidor', () => {
    it('getServerBackend / getAdminBackend se niegan (equivale al bundle del navegador)', async () => {
        vi.stubEnv('NEXT_RUNTIME', '');
        const { getServerBackend, getAdminBackend } = await import('./index.js');
        await expect(getServerBackend()).rejects.toThrow(/solo puede usarse en el servidor/);
        await expect(getAdminBackend()).rejects.toThrow(/solo puede usarse en el servidor/);
    });
});

describe('getBrowserBackend', () => {
    it('falla con un mensaje claro si se llama en el servidor', async () => {
        const { getBrowserBackend } = await import('./index.js');
        expect(() => getBrowserBackend()).toThrow(/solo puede usarse en el navegador/);
    });
});

describe('modo real sin configuracion', () => {
    it('getServerBackend / getAdminBackend explican que variables faltan', async () => {
        config.local = false;
        const { getServerBackend, getAdminBackend } = await import('./index.js');
        await expect(getServerBackend()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
        await expect(getAdminBackend()).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });
});

describe('backend local sin sesion (sin base de datos)', () => {
    it('servidor: superficie completa y sin usuario', async () => {
        const { getServerBackend } = await import('./index.js');
        const b = await getServerBackend();
        expect(Object.keys(b).sort()).toEqual(['auth', 'rpc', 'storage']);
        expect(Object.keys(b.auth).sort()).toEqual([...SUPERFICIE_AUTH].sort());
        expect(b.auth.admin).toBeUndefined();

        const u = await b.auth.getUser();
        expect(u.data.user).toBeNull();
        expect(u.error.name).toBe('AuthSessionMissingError');
        expect((await b.auth.getSession()).data.session).toBeNull();
        expect((await b.rpc('api_yo', {})).error.hint).toBe('NO_AUTENTICADO');
        expect((await b.storage.from('susan-test').download('a.txt')).error.statusCode).toBe('401');
        expect((await b.auth.updateUser({ password: 'Clave-larga-123' })).error.name).toBe('AuthSessionMissingError');
        const sus = b.auth.onAuthStateChange(() => {});
        expect(typeof sus.data.subscription.unsubscribe).toBe('function');
    });

    it('servidor: una cookie manipulada no da sesion', async () => {
        almacen.mapa.set('susan_local_session', 'abc.def');
        const { getServerBackend } = await import('./index.js');
        const b = await getServerBackend();
        expect((await b.auth.getUser()).error).toBeTruthy();
        expect((await b.rpc('api_yo', {})).error.hint).toBe('NO_AUTENTICADO');
    });

    it('servidor: signOut borra la cookie y tolera que Next no deje escribirla (RSC)', async () => {
        const { getServerBackend } = await import('./index.js');
        const b = await getServerBackend();
        expect((await b.auth.signOut()).error).toBeNull();
        expect(almacen.delete).toHaveBeenCalledWith('susan_local_session');
        almacen.delete.mockImplementationOnce(() => {
            throw new Error('Cookies can only be modified in a Server Action or Route Handler');
        });
        expect((await b.auth.signOut()).error).toBeNull();
    });

    it('admin: auth.admin completo, sin sesion propia, rpc con service_role', async () => {
        const { getAdminBackend } = await import('./index.js');
        const b = await getAdminBackend();
        expect(Object.keys(b.auth.admin).sort()).toEqual(['createUser', 'deleteUser', 'listUsers', 'updateUserById']);
        for (const m of SUPERFICIE_AUTH) expect(typeof b.auth[m]).toBe('function');
        expect((await b.auth.getUser()).error.name).toBe('AuthSessionMissingError');
        expect(Object.keys(b.storage.from('susan-test')).sort()).toEqual(['createSignedUrl', 'download', 'remove', 'upload']);
    });
});

describe('modo real: proxy de sesion', () => {
    it('actualizarSesion devuelve el usuario validado y propaga las cookies refrescadas', async () => {
        config.local = false;
        config.url = 'https://x.supabase.co';
        vi.resetModules();
        vi.doMock('@supabase/ssr', () => ({
            createServerClient: (_u, _k, { cookies }) => ({
                auth: {
                    getUser: async () => {
                        cookies.setAll([{ name: 'sb-token', value: 'nuevo', options: { path: '/' } }], { 'cache-control': 'private, no-store' });
                        return { data: { user: { id: 'uid-1', email: 'x@y.z' } } };
                    },
                },
            }),
        }));
        const { NextRequest } = await import('next/server');
        const { actualizarSesion } = await import('./proxy.js');
        const req = new NextRequest('http://localhost:3000/docente', { headers: { cookie: 'sb-token=viejo' } });
        const { response, user } = await actualizarSesion(req);
        expect(user).toEqual({ id: 'uid-1' });
        expect(response.cookies.get('sb-token').value).toBe('nuevo');
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        vi.doUnmock('@supabase/ssr');
    });

    it('sin usuario devuelve user null', async () => {
        config.local = false;
        config.url = 'https://x.supabase.co';
        vi.resetModules();
        vi.doMock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
        const { NextRequest } = await import('next/server');
        const { actualizarSesion } = await import('./proxy.js');
        const { user } = await actualizarSesion(new NextRequest('http://localhost:3000/docente'));
        expect(user).toBeNull();
        vi.doUnmock('@supabase/ssr');
    });
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe.skipIf(!hayBd)('backend local con sesion (BD local)', () => {
    let cerrarPool;
    beforeAll(async () => {
        process.env.LOCAL_DATABASE_URL = URL_BD_PRUEBAS;
        vi.resetModules();
        ({ cerrarPool } = await import('@/lib/local/pool.js'));
    });
    afterAll(async () => {
        await cerrarPool?.();
    });

    it('signInWithPassword fija la cookie y el mismo backend ya habla como ese usuario', async () => {
        const { getServerBackend } = await import('./index.js');
        const b = await getServerBackend();
        const mal = await b.auth.signInWithPassword({ email: 'docente1@susan.local', password: 'mala' });
        expect(mal.error.code).toBe('invalid_credentials');
        expect(almacen.set).not.toHaveBeenCalled();

        const ok = await b.auth.signInWithPassword({ email: 'docente1@susan.local', password: 'demo1234' });
        expect(ok.error).toBeNull();
        expect(almacen.set).toHaveBeenCalledWith('susan_local_session', expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: 'lax' }));
        expect((await b.rpc('api_yo', {})).data.correo).toBe('docente1@susan.local');
        expect((await b.auth.getUser()).data.user.email).toBe('docente1@susan.local');

        // Un backend nuevo de otra "peticion" lee la misma cookie.
        const otro = await getServerBackend();
        expect((await otro.auth.getSession()).data.session.user.email).toBe('docente1@susan.local');
        expect((await otro.auth.getSession()).data.session.access_token).not.toBe(almacen.mapa.get('susan_local_session'));
    });

    it('admin: rpc con service_role ejecuta svc_* (no se rechaza por permiso)', async () => {
        const { getAdminBackend } = await import('./index.js');
        const b = await getAdminBackend();
        const r = await b.rpc('svc_crear_captura', { p_id_sesion: 999999, p_id_camara: 1, p_marca_tiempo: '2026-09-14T07:00:00Z', p_rostros: 0 });
        expect(r.error?.code).not.toBe('42501');
        const login = await b.auth.signInWithPassword({ email: 'admin@susan.local', password: 'demo1234' });
        expect(login.error).toBeNull();
        expect(almacen.set).not.toHaveBeenCalled(); // el admin no escribe cookies
    });
});
