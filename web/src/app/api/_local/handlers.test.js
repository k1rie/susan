import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { URL_BD_PRUEBAS, bdDisponible } from '@/lib/local/db.testutil.js';

// IS_LOCAL se evalua una sola vez al importar @/config; aqui se vuelve dinamico para poder
// probar los modos sin reimportar todo Next en cada caso (resetModules tarda segundos).
vi.mock('@/config', async (original) => {
    const real = await original();
    return {
        ...real,
        get IS_LOCAL() {
            return process.env.SUSAN_LOCAL === '1' || process.env.NEXT_PUBLIC_SUSAN_LOCAL === '1';
        },
    };
});

const hayBd = await bdDisponible();
const ORIGEN = 'http://localhost:3101';

function peticion(ruta, { metodo = 'POST', cuerpo, cookie, origen = ORIGEN, form } = {}) {
    const headers = {};
    if (origen) headers.origin = origen;
    if (cookie) headers.cookie = cookie;
    let body;
    if (form) {
        body = form;
    } else if (cuerpo !== undefined) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(cuerpo);
    }
    return new NextRequest(`${ORIGEN}/api/_local${ruta}`, { method: metodo, headers, body });
}

async function cargar() {
    const [auth, rpc, storage] = await Promise.all([
        import('./handlers/auth.js'),
        import('./handlers/rpc.js'),
        import('./handlers/storage.js'),
    ]);
    return { auth, rpc, storage };
}

const contexto = (name) => ({ params: Promise.resolve({ name }) });

function todosLosHandlers(h) {
    return [
        () => h.auth.login(peticion('/auth/login', { cuerpo: { email: 'a@b.c', password: 'x' } })),
        () => h.auth.logout(peticion('/auth/logout')),
        () => h.auth.session(peticion('/auth/session', { metodo: 'GET', origen: null })),
        () => h.auth.password(peticion('/auth/password', { cuerpo: { password: 'x' } })),
        () => h.auth.reset(peticion('/auth/reset', { cuerpo: { email: 'a@b.c' } })),
        () => h.rpc.rpc(peticion('/rpc/api_yo', { cuerpo: { args: {} } }), contexto('api_yo')),
        () => h.storage.upload(peticion('/storage/upload', { form: new FormData() })),
        () => h.storage.download(peticion('/storage/download', { cuerpo: {} })),
        () => h.storage.remove(peticion('/storage/remove', { cuerpo: {} })),
        () => h.storage.signedUrl(peticion('/storage/signed-url', { cuerpo: {} })),
        () => h.storage.objeto(peticion('/storage/object?token=x', { metodo: 'GET', origen: null })),
    ];
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('las rutas _local no existen fuera del modo local', () => {
    it('SUSAN_LOCAL sin definir: 404 JSON en todas', async () => {
        vi.stubEnv('SUSAN_LOCAL', '');
        vi.stubEnv('NEXT_PUBLIC_SUSAN_LOCAL', '');
        const h = await cargar();
        for (const llamar of todosLosHandlers(h)) {
            const res = await llamar();
            expect(res.status).toBe(404);
            expect((await res.json()).error.code).toBe('NO_ENCONTRADO');
        }
    });

    it('NODE_ENV=production: 404 aunque SUSAN_LOCAL=1', async () => {
        vi.stubEnv('SUSAN_LOCAL', '1');
        vi.stubEnv('NODE_ENV', 'production');
        const h = await cargar();
        for (const llamar of todosLosHandlers(h)) {
            expect((await llamar()).status).toBe(404);
        }
    });
});

describe('validaciones sin base de datos (modo local)', () => {
    let h;
    beforeAll(async () => {
        h = await cargar();
    });
    beforeEach(() => {
        vi.stubEnv('SUSAN_LOCAL', '1');
    });

    it('rpc/[name] rechaza svc_* con 403 (jamas por HTTP)', async () => {
        const res = await h.rpc.rpc(peticion('/rpc/svc_crear_captura', { cuerpo: { args: {} } }), contexto('svc_crear_captura'));
        expect(res.status).toBe(403);
        expect((await res.json()).error.code).toBe('42501');
    });

    it.each(['pg_sleep', 'API_YO', 'api_yo;select', 'app.now', 'api-yo', '..%2f', ''])('rpc/[name] rechaza el nombre invalido %j', async (nombre) => {
        const res = await h.rpc.rpc(peticion('/rpc/x', { cuerpo: { args: {} } }), contexto(nombre));
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('PGRST202');
    });

    it('rutas de estado exigen Origin igual al host (sin Origin u Origin ajeno: 403)', async () => {
        for (const origen of [null, 'http://evil.example', 'http://localhost:9999', 'no-es-url']) {
            const res = await h.auth.login(peticion('/auth/login', { cuerpo: { email: 'a@b.c', password: 'x' }, origen }));
            expect(res.status, String(origen)).toBe(403);
            expect((await res.json()).error.code).toBe('ORIGEN_INVALIDO');
        }
        const rpc = await h.rpc.rpc(peticion('/rpc/api_yo', { cuerpo: { args: {} }, origen: 'http://evil.example' }), contexto('api_yo'));
        expect(rpc.status).toBe(403);
    });

    it('sin cookie: rpc, password y storage dan 401; session responde sin usuario', async () => {
        const rpc = await h.rpc.rpc(peticion('/rpc/api_yo', { cuerpo: { args: {} } }), contexto('api_yo'));
        expect(rpc.status).toBe(401);
        expect((await rpc.json()).error.hint).toBe('NO_AUTENTICADO');
        expect((await h.auth.password(peticion('/auth/password', { cuerpo: { password: 'Clave-larga-123' } }))).status).toBe(401);
        expect((await h.storage.remove(peticion('/storage/remove', { cuerpo: { bucket: 'susan-test', paths: ['a'] } }))).status).toBe(401);
        expect((await h.storage.objeto(peticion('/storage/object?token=x', { metodo: 'GET', origen: null }))).status).toBe(401);
        const ses = await h.auth.session(peticion('/auth/session', { metodo: 'GET', origen: null }));
        expect(ses.status).toBe(200);
        expect((await ses.json()).data).toEqual({ user: null, session: null });
    });

    it('cookie manipulada o vencida equivale a no tener sesion', async () => {
        const { crearTokenSesion } = await import('@/lib/local/session.js');
        const vencida = crearTokenSesion('34cf6120-b7b9-b9cd-2db5-2f108d40b771', { ahoraSeg: 1000 });
        for (const valor of [vencida, 'abc.def', crearTokenSesion('34cf6120-b7b9-b9cd-2db5-2f108d40b771', { secreto: 'otro' })]) {
            const res = await h.rpc.rpc(peticion('/rpc/api_yo', { cuerpo: { args: {} }, cookie: `susan_local_session=${valor}` }), contexto('api_yo'));
            expect(res.status).toBe(401);
        }
    });

    it('login con cuerpo invalido: 400 sin tocar la base', async () => {
        const res = await h.auth.login(peticion('/auth/login', { cuerpo: { email: 1 } }));
        expect(res.status).toBe(400);
    });

    it('logout es idempotente y limpia la cookie', async () => {
        const res = await h.auth.logout(peticion('/auth/logout'));
        expect(res.status).toBe(200);
        expect(res.headers.get('set-cookie')).toMatch(/susan_local_session=;/);
    });

    it('reset responde ok y no revela si existe la cuenta', async () => {
        const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const res = await h.auth.reset(peticion('/auth/reset', { cuerpo: { email: 'nadie@susan.local' } }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ data: {}, error: null });
        expect(aviso).toHaveBeenCalledOnce();
        expect(String(aviso.mock.calls[0])).not.toContain('nadie@susan.local');
    });
});

describe.skipIf(!hayBd)('flujo completo contra la BD local', () => {
    let h;
    let dir;
    let cerrarPool;

    beforeAll(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'susan-handlers-'));
        process.env.LOCAL_DATABASE_URL = URL_BD_PRUEBAS;
        h = await cargar();
        ({ cerrarPool } = await import('@/lib/local/pool.js'));
    });
    beforeEach(() => {
        vi.stubEnv('SUSAN_LOCAL', '1');
        vi.stubEnv('LOCAL_STORAGE_DIR', dir);
    });
    afterAll(async () => {
        await cerrarPool?.();
        await fs.rm(dir, { recursive: true, force: true });
    });

    async function iniciar(email = 'docente1@susan.local', password = 'demo1234') {
        const res = await h.auth.login(peticion('/auth/login', { cuerpo: { email, password } }));
        return { res, cookie: res.cookies.get('susan_local_session')?.value };
    }

    it('login incorrecto: 400 y sin cookie', async () => {
        const { res, cookie } = await iniciar('docente1@susan.local', 'mal');
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('invalid_credentials');
        expect(cookie).toBeUndefined();
    });

    it('login correcto fija cookie httpOnly y rpc/api_yo y api_docente_panel devuelven datos del usuario', async () => {
        const { res, cookie } = await iniciar();
        expect(res.status).toBe(200);
        expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/i);
        expect(res.headers.get('set-cookie')).toMatch(/SameSite=lax/i);
        const cuerpo = await res.json();
        expect(cuerpo.data.user.email).toBe('docente1@susan.local');
        expect(JSON.stringify(cuerpo)).not.toMatch(/encrypted_password|\$2[aby]\$/);

        const c = `susan_local_session=${cookie}`;
        const yo = await h.rpc.rpc(peticion('/rpc/api_yo', { cuerpo: { args: {} }, cookie: c }), contexto('api_yo'));
        expect(yo.status).toBe(200);
        expect((await yo.json()).data.correo).toBe('docente1@susan.local');

        const panel = await h.rpc.rpc(peticion('/rpc/api_docente_panel', { cuerpo: { args: {} }, cookie: c }), contexto('api_docente_panel'));
        expect(panel.status).toBe(200);
        const datos = (await panel.json()).data;
        expect(datos).toBeTruthy();
        expect(JSON.stringify(datos)).toMatch(/3A/);

        const ses = await h.auth.session(peticion('/auth/session', { metodo: 'GET', origen: null, cookie: c }));
        expect((await ses.json()).data.user.email).toBe('docente1@susan.local');
    });

    it('un error de negocio llega como { error: { hint } } con status HTTP coherente', async () => {
        const { cookie } = await iniciar('e260001@susan.local');
        const res = await h.rpc.rpc(
            peticion('/rpc/api_admin_resumen', { cuerpo: { args: {} }, cookie: `susan_local_session=${cookie}` }),
            contexto('api_admin_resumen'),
        );
        expect(res.status).toBe(403);
        expect((await res.json()).error.hint).toBe('NO_AUTORIZADO');
    });

    it('storage: subir, firmar, descargar por token, borrar; el bucket privado esta cerrado', async () => {
        const { cookie } = await iniciar('admin@susan.local');
        const c = `susan_local_session=${cookie}`;

        const form = new FormData();
        form.append('bucket', 'susan-test');
        form.append('path', 'demo/hola.txt');
        form.append('file', new Blob(['hola mundo']), 'x');
        const sube = await h.storage.upload(peticion('/storage/upload', { form, cookie: c }));
        expect(sube.status).toBe(200);

        const firma = await h.storage.signedUrl(peticion('/storage/signed-url', { cuerpo: { bucket: 'susan-test', path: 'demo/hola.txt', expiresIn: 60 }, cookie: c }));
        const { signedUrl } = (await firma.json()).data;

        const obj = await h.storage.objeto(peticion(signedUrl.replace('/api/_local', ''), { metodo: 'GET', origen: null, cookie: c }));
        expect(obj.status).toBe(200);
        expect(await obj.text()).toBe('hola mundo');
        expect(obj.headers.get('x-content-type-options')).toBe('nosniff');

        const malo = await h.storage.objeto(peticion(`/storage/object?token=${signedUrl.split('token=')[1]}x`, { metodo: 'GET', origen: null, cookie: c }));
        expect(malo.status).toBe(403);

        const baja = await h.storage.download(peticion('/storage/download', { cuerpo: { bucket: 'susan-test', path: 'demo/hola.txt' }, cookie: c }));
        expect(await baja.text()).toBe('hola mundo');

        const traversal = await h.storage.download(peticion('/storage/download', { cuerpo: { bucket: 'susan-test', path: '../../x' }, cookie: c }));
        expect(traversal.status).toBe(400);

        const privado = await h.storage.download(peticion('/storage/download', { cuerpo: { bucket: 'susan-private', path: 'a.txt' }, cookie: c }));
        expect(privado.status).toBe(403);

        const quita = await h.storage.remove(peticion('/storage/remove', { cuerpo: { bucket: 'susan-test', paths: ['demo/hola.txt'] }, cookie: c }));
        expect((await quita.json()).data).toHaveLength(1);
    });

    it('upload rechaza archivos de mas de 10 MB', async () => {
        const { cookie } = await iniciar('admin@susan.local');
        const form = new FormData();
        form.append('bucket', 'susan-test');
        form.append('path', 'grande.bin');
        form.append('file', new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)]), 'x');
        const res = await h.storage.upload(peticion('/storage/upload', { form, cookie: `susan_local_session=${cookie}` }));
        expect(res.status).toBe(413);
    });

    it('password: cambia y restaura la contrasena de una cuenta de prueba', async () => {
        const { crearAdminAuth } = await import('@/lib/local/auth.js');
        const admin = crearAdminAuth();
        const correo = `pw-${Date.now()}@susan.local`;
        const { data } = await admin.createUser({ email: correo, password: 'Clave-inicial-123' });
        try {
            const { cookie } = await iniciar(correo, 'Clave-inicial-123');
            const c = `susan_local_session=${cookie}`;
            expect((await h.auth.password(peticion('/auth/password', { cuerpo: { password: 'corta' }, cookie: c }))).status).toBe(422);
            expect((await h.auth.password(peticion('/auth/password', { cuerpo: { password: 'Clave-inicial-123' }, cookie: c }))).status).toBe(422);
            expect((await h.auth.password(peticion('/auth/password', { cuerpo: { password: 'Clave-nueva-4567' }, cookie: c }))).status).toBe(200);
            expect((await iniciar(correo, 'Clave-nueva-4567')).res.status).toBe(200);
        } finally {
            await admin.deleteUser(data.user.id);
        }
    });
});
