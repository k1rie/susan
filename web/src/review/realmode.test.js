// Camino REAL de Supabase (@supabase/ssr + supabase-js) contra scripts/fake-supabase.mjs.
// El modo real nunca se habia ejecutado: aqui los clientes de supabase-js hablan HTTP de verdad con un
// GoTrue/PostgREST/Storage simulado (la BD local aporta auth.users y las RPC). Si la BD local no responde,
// la suite se omite. Las cuentas que crea se borran al terminar (finally).
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { URL_BD_PRUEBAS, bdDisponible } from '@/lib/local/db.testutil.js';
import { iniciarStub, llavesProyecto } from '../../../scripts/fake-supabase.mjs';

const hayBd = await bdDisponible();

// Almacen de cookies de "una peticion" (lo que daria next/headers). Se vacia con almacen.mapa.clear().
const almacen = vi.hoisted(() => ({ mapa: new Map() }));
vi.mock('@/lib/backend/cookies.js', () => ({
    cookiesDePeticion: async () => ({
        getAll: () => [...almacen.mapa].map(([name, value]) => ({ name, value })),
        get: (name) => (almacen.mapa.has(name) ? { name, value: almacen.mapa.get(name) } : undefined),
        set: (name, value, opciones) => {
            if (value === '' || opciones?.maxAge === 0) almacen.mapa.delete(name);
            else almacen.mapa.set(name, value);
        },
        delete: (name) => almacen.mapa.delete(name),
    }),
}));

const cabeceraCookie = () => [...almacen.mapa].map(([n, v]) => `${n}=${v}`).join('; ');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!hayBd)('modo real contra el Supabase simulado', () => {
    let stub;
    let servidor; // crearBackendServidor / crearBackendAdmin
    let proxyMod;
    let pool;

    beforeAll(async () => {
        process.env.LOCAL_DATABASE_URL = URL_BD_PRUEBAS;
        const modulos = { auth: await import('@/lib/local/auth.js'), rpc: await import('@/lib/local/rpc.js') };
        pool = await import('@/lib/local/pool.js');
        stub = await iniciarStub({ puerto: 0, modulos });
        const llaves = llavesProyecto();
        vi.stubEnv('SUSAN_LOCAL', '');
        vi.stubEnv('NEXT_PUBLIC_SUSAN_LOCAL', '');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', stub.url);
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', llaves.anon);
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', llaves.service_role);
        vi.resetModules(); // @/config lee el entorno al importarse
        servidor = await import('@/lib/backend/server.js');
        proxyMod = await import('@/lib/backend/proxy.js');
    });

    afterAll(async () => {
        await stub?.cerrar();
        await pool?.cerrarPool();
        vi.unstubAllEnvs();
    });

    const iniciar = async (email = 'docente1@susan.local', password = 'demo1234') => {
        almacen.mapa.clear();
        const b = await servidor.crearBackendServidor();
        const r = await b.auth.signInWithPassword({ email, password });
        return { b, r };
    };

    it('login: sesion en cookie sb-<ref>-auth-token con formato base64- y RPC api_yo por PostgREST', async () => {
        const { b, r } = await iniciar();
        expect(r.error).toBeNull();
        const nombres = [...almacen.mapa.keys()];
        expect(nombres).toHaveLength(1);
        expect(nombres[0]).toMatch(/^sb-[a-z0-9-]+-auth-token$/);
        expect(almacen.mapa.get(nombres[0])).toMatch(/^base64-/);
        const yo = await b.rpc('api_yo', {});
        expect(yo.error).toBeNull();
        expect(yo.data).toMatchObject({ rol: 'docente', activo: true, correo: 'docente1@susan.local' });
    });

    it('login con clave mala: invalid_credentials y ninguna cookie', async () => {
        const { r } = await iniciar('docente1@susan.local', 'incorrecta1');
        expect(r.error?.code).toBe('invalid_credentials');
        expect(almacen.mapa.size).toBe(0);
    });

    it('una peticion nueva con las mismas cookies valida la sesion contra GoTrue (getUser)', async () => {
        await iniciar();
        const b2 = await servidor.crearBackendServidor();
        const { data, error } = await b2.auth.getUser();
        expect(error).toBeNull();
        expect(data.user.email).toBe('docente1@susan.local');
    });

    it('sin sesion: getUser falla y la RPC se niega (42501 -> 401 PostgREST con la llave anon)', async () => {
        almacen.mapa.clear();
        const b = await servidor.crearBackendServidor();
        expect((await b.auth.getUser()).data.user).toBeNull();
        const r = await b.rpc('api_yo', {});
        expect(r.error?.code).toBe('42501');
        expect(r.status).toBe(401);
    });

    it('error de negocio P0001 de PostgREST llega a fromRpcError con su HINT (docente en RPC de administrador)', async () => {
        const { b } = await iniciar();
        const { callRpc } = await import('@/lib/api/client.js');
        await expect(callRpc('api_usuarios_listar', { limit: 5, offset: 0 }, { backend: b })).rejects.toMatchObject({
            name: 'ApiError',
            status: 403,
        });
    });

    it('cookies en trozos: con user_metadata grande la sesion se parte en .0/.1 y se vuelve a leer', async () => {
        const admin = await servidor.crearBackendAdmin();
        const correo = `rm.trozos.${Date.now()}@susan.local`;
        const clave = 'Prueba12345x';
        const grande = Array.from({ length: 400 }, (_, i) => `k${i}-${'ab'.repeat(8)}`).join('|'); // ~8 KB de metadatos
        const creada = await admin.auth.admin.createUser({ email: correo, password: clave, email_confirm: true, user_metadata: { relleno: grande } });
        expect(creada.error).toBeNull();
        try {
            const { r } = await iniciar(correo, clave);
            expect(r.error).toBeNull();
            const nombres = [...almacen.mapa.keys()].sort();
            expect(nombres.length).toBeGreaterThan(1);
            expect(nombres[0]).toMatch(/-auth-token\.0$/);
            for (const v of almacen.mapa.values()) expect(v.length).toBeLessThanOrEqual(3180);
            const b2 = await servidor.crearBackendServidor();
            expect((await b2.auth.getUser()).data.user.email).toBe(correo);
        } finally {
            await admin.auth.admin.deleteUser(creada.data.user.id);
        }
    });

    it('proxy: sin cookie o con cookie basura no hay usuario; con sesion si', async () => {
        const pedir = (cookie) => new NextRequest('http://localhost:3000/docente', { headers: cookie ? { cookie } : {} });
        expect((await proxyMod.actualizarSesion(pedir())).user).toBeNull();
        expect((await proxyMod.actualizarSesion(pedir('sb-x-auth-token=basura'))).user).toBeNull();
        await iniciar();
        const { user } = await proxyMod.actualizarSesion(pedir(cabeceraCookie()));
        expect(user?.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('proxy: access_token caducado + refresh vigente -> sesion refrescada y Set-Cookie con tokens nuevos', async () => {
        stub.ajustarTtl(1);
        await iniciar();
        stub.ajustarTtl(3600);
        const viejo = cabeceraCookie();
        await dormir(1500); // el access_token ya vencio
        const { user, response } = await proxyMod.actualizarSesion(new NextRequest('http://localhost:3000/docente', { headers: { cookie: viejo } }));
        expect(user).not.toBeNull();
        const nuevas = response.cookies.getAll();
        expect(nuevas.length).toBeGreaterThan(0);
        expect(nuevas[0].value).not.toBe(viejo.split('=').slice(1).join('='));
        expect(response.headers.get('cache-control')).toMatch(/no-cache|no-store|private/);
    });

    it('proxy: refresh_token ya usado fuera del intervalo de reuso o sesion cerrada -> sin usuario y cookie borrada', async () => {
        const { b } = await iniciar();
        const copia = cabeceraCookie();
        await b.auth.signOut(); // revoca la sesion en GoTrue y borra las cookies
        expect(almacen.mapa.size).toBe(0);
        const { user } = await proxyMod.actualizarSesion(new NextRequest('http://localhost:3000/docente', { headers: { cookie: copia } }));
        expect(user).toBeNull(); // GET /auth/v1/user -> 403 session_not_found
    });

    it('backend admin (service_role): createUser, duplicado, listUsers paginado, updateUserById y deleteUser', async () => {
        const admin = await servidor.crearBackendAdmin();
        expect(Object.keys(admin.auth.admin).sort()).toEqual(['createUser', 'deleteUser', 'listUsers', 'updateUserById']);
        const correo = `rm.admin.${Date.now()}@susan.local`;
        const c = await admin.auth.admin.createUser({ email: correo, password: 'Prueba12345x', email_confirm: true });
        expect(c.error).toBeNull();
        const id = c.data.user.id;
        try {
            const dup = await admin.auth.admin.createUser({ email: correo, password: 'Prueba12345x', email_confirm: true });
            expect(dup.error?.code).toBe('email_exists');
            const debil = await admin.auth.admin.createUser({ email: `d.${correo}`, password: 'corta', email_confirm: true });
            expect(debil.error?.code).toBe('weak_password');
            const lista = await admin.auth.admin.listUsers({ page: 1, perPage: 5 });
            expect(lista.error).toBeNull();
            expect(lista.data.users.length).toBeLessThanOrEqual(5);
            const u = await admin.auth.admin.updateUserById(id, { password: 'OtraClave98765' });
            expect(u.error).toBeNull();
            const { r } = await iniciar(correo, 'OtraClave98765');
            expect(r.error).toBeNull();
        } finally {
            const d = await admin.auth.admin.deleteUser(id);
            expect(d.error).toBeNull();
        }
        expect((await admin.auth.admin.deleteUser(id)).error?.code).toBe('user_not_found');
    });

    it('RPC svc_*: service_role las ejecuta; el JWT de un usuario no (42501 -> 403 con sesion)', async () => {
        const admin = await servidor.crearBackendAdmin();
        const ok = await admin.rpc('svc_indice_en_uso', {});
        expect(ok.error).toBeNull();
        const { b } = await iniciar('admin@susan.local');
        const no = await b.rpc('svc_indice_en_uso', {});
        expect(no.error?.code).toBe('42501');
        expect(no.status).toBe(403);
    });

    it('un JWT de usuario NO puede usar la API admin de Auth (403 not_admin)', async () => {
        const { b } = await iniciar();
        const { data } = await b.auth.getSession();
        const r = await fetch(`${stub.url}/auth/v1/admin/users`, { headers: { authorization: `Bearer ${data.session.access_token}` } });
        expect(r.status).toBe(403);
    });

    it('Storage con service_role: subir (Buffer y Blob), duplicado 409, URL firmada, descarga, borrado', async () => {
        const admin = await servidor.crearBackendAdmin();
        const bucket = admin.storage.from('susan-private');
        const ruta = `justificantes/1/rm-${Date.now()}.png`;
        const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
        const up = await bucket.upload(ruta, bytes, { contentType: 'image/png', upsert: false });
        expect(up.error).toBeNull();
        expect(up.data.path).toBe(ruta);
        const dup = await bucket.upload(ruta, bytes, { contentType: 'image/png', upsert: false });
        expect(dup.error?.statusCode).toBe('409');
        const blob = await bucket.upload(`${ruta}.blob`, new Blob([bytes], { type: 'image/png' }), { upsert: false });
        expect(blob.error).toBeNull();
        const firmada = await bucket.createSignedUrl(ruta, 60);
        expect(firmada.error).toBeNull();
        expect(firmada.data.signedUrl).toMatch(/\/storage\/v1\/object\/sign\/susan-private\/justificantes\/1\/rm-.*\?token=/);
        const res = await fetch(firmada.data.signedUrl);
        expect(res.status).toBe(200);
        expect(Buffer.from(await res.arrayBuffer()).equals(bytes)).toBe(true);
        const manipulada = firmada.data.signedUrl.replace(/token=[^.]+/, 'token=AAAA');
        expect((await fetch(manipulada)).status).toBe(400);
        const dl = await bucket.download(ruta);
        expect(dl.error).toBeNull();
        expect(Buffer.from(await dl.data.arrayBuffer()).equals(bytes)).toBe(true);
        const rm = await bucket.remove([ruta, `${ruta}.blob`]);
        expect(rm.error).toBeNull();
        expect(rm.data).toHaveLength(2);
        expect((await bucket.createSignedUrl(ruta, 60)).error?.statusCode).toBe('404');
    });

    it('Storage: el bucket privado esta CERRADO al JWT de usuario (politica RESTRICTIVE)', async () => {
        const { b } = await iniciar();
        const r = await b.storage.from('susan-private').upload(`registro/1/x-${Date.now()}.jpg`, Buffer.from('x'));
        expect(r.error?.statusCode).toBe('403');
    });
});
