import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));

import { getAdminBackend, getServerBackend } from '@/lib/backend';
import { ApiError } from '@/lib/api/errors';
import { creado, handle, json } from './route.js';
import { BYTES_JPEG, BYTES_PNG, YO, archivo, conParams, crearBackend, errorDeNegocio, fotosDistintas, pedir } from './testing.js';

let usuario;
let admin;

beforeEach(() => {
    usuario = crearBackend({ rpcs: { api_yo: () => YO.docente } });
    admin = crearBackend();
    getServerBackend.mockResolvedValue(usuario);
    getAdminBackend.mockResolvedValue(admin);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

const leer = async (res) => ({ status: res.status, cuerpo: await res.json(), headers: res.headers });

describe('handle: autenticación y autorización', () => {
    it('401 NO_AUTENTICADO sin sesión, antes de validar nada', async () => {
        getServerBackend.mockResolvedValue(crearBackend({ user: null }));
        const fn = vi.fn();
        const POST = handle({ params: z.object({ id: z.coerce.number() }) }, fn);
        const r = await leer(await POST(pedir('/api/x', { json: {} }), conParams({ id: 'no-numero' })));
        expect(r.status).toBe(401);
        expect(r.cuerpo.error.code).toBe('NO_AUTENTICADO');
        expect(fn).not.toHaveBeenCalled();
    });

    it('401 si api_yo responde NO_AUTENTICADO (JWT vencido)', async () => {
        getServerBackend.mockResolvedValue(crearBackend({ rpcs: { api_yo: () => errorDeNegocio('NO_AUTENTICADO', 'Debes iniciar sesión.') } }));
        const r = await leer(await handle({}, vi.fn())(pedir('/api/x', { method: 'GET' })));
        expect(r.status).toBe(401);
    });

    it('403 NO_AUTORIZADO si el rol no está permitido', async () => {
        const fn = vi.fn();
        const r = await leer(await handle({ roles: ['administrador'] }, fn)(pedir('/api/x', { method: 'GET' })));
        expect(r.status).toBe(403);
        expect(r.cuerpo.error.code).toBe('NO_AUTORIZADO');
        expect(fn).not.toHaveBeenCalled();
    });

    it('403 CUENTA_INACTIVA', async () => {
        getServerBackend.mockResolvedValue(crearBackend({ rpcs: { api_yo: () => ({ ...YO.docente, activo: false, home: null }) } }));
        const r = await leer(await handle({}, vi.fn())(pedir('/api/x', { method: 'GET' })));
        expect(r.status).toBe(403);
        expect(r.cuerpo.error.code).toBe('CUENTA_INACTIVA');
    });

    it('rechaza Origin ajeno en métodos con efectos (403) y deja pasar sin Origin o con el mismo host', async () => {
        const fn = vi.fn(() => ({ ok: true }));
        const POST = handle({}, fn);
        const ajeno = await leer(await POST(pedir('/api/x', { json: {}, headers: { origin: 'https://malo.example', host: 'localhost' } })));
        expect(ajeno.status).toBe(403);
        expect(ajeno.cuerpo.error.code).toBe('ORIGEN_NO_PERMITIDO');
        expect((await POST(pedir('/api/x', { json: {}, headers: { origin: 'http://localhost', host: 'localhost' } }))).status).toBe(200);
        expect((await POST(pedir('/api/x', { json: {} }))).status).toBe(200);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('arma ctx con user, me, ip, rpc (identidad del usuario), svc y admin (service_role)', async () => {
        usuario = crearBackend({ rpcs: { api_yo: () => YO.docente, api_algo: () => ({ de: 'usuario' }) } });
        admin = crearBackend({ rpcs: { svc_algo: () => ({ de: 'servicio' }) } });
        getServerBackend.mockResolvedValue(usuario);
        getAdminBackend.mockResolvedValue(admin);
        let capturado;
        const GET = handle({}, async (ctx) => {
            capturado = {
                me: ctx.me, user: ctx.user, ip: ctx.ip,
                a: await ctx.rpc('api_algo', {}), b: await ctx.svc('svc_algo', {}), admin: await ctx.admin(),
            };
            return { listo: true };
        });
        await GET(pedir('/api/x', { method: 'GET', headers: { 'x-forwarded-for': '203.0.113.9' } }));
        expect(capturado.me.rol).toBe('docente');
        expect(capturado.user).toEqual({ id: 'auth-1' });
        expect(capturado.ip).toBe('203.0.113.9');
        expect(capturado.a).toEqual({ de: 'usuario' });
        expect(capturado.b).toEqual({ de: 'servicio' });
        expect(capturado.admin).toBe(admin);
        expect(usuario.llamadas).toContain('api_algo');
        expect(admin.llamadas).toEqual(['svc_algo']);
    });
});

describe('handle: validación', () => {
    it('422 VALIDACION con details.campos por campo (cuerpo, query y params)', async () => {
        const POST = handle({
            input: z.object({ nombre: z.string().min(3), edad: z.number().int() }).strict(),
            params: z.object({ id: z.coerce.number().int().positive() }),
        }, vi.fn());
        const r = await leer(await POST(pedir('/api/x', { json: { nombre: 'a', edad: 'x', extra: 1 } }), conParams({ id: '5' })));
        expect(r.status).toBe(422);
        expect(r.cuerpo.error.code).toBe('VALIDACION');
        const campos = r.cuerpo.error.details.campos.map((c) => c.campo).sort();
        expect(campos).toEqual(['edad', 'extra', 'nombre']);
        expect(r.cuerpo.error.details.campos.every((c) => typeof c.mensaje === 'string' && c.mensaje)).toBe(true);

        const p = await leer(await POST(pedir('/api/x', { json: { nombre: 'abc', edad: 1 } }), conParams({ id: '-3' })));
        expect(p.status).toBe(422);
        expect(p.cuerpo.error.details.campos[0].campo).toBe('id');

        const GET = handle({ query: z.object({ limit: z.coerce.number().int().max(10) }) }, vi.fn());
        const q = await leer(await GET(pedir('/api/x?limit=99', { method: 'GET' })));
        expect(q.cuerpo.error.details.campos[0].campo).toBe('limit');
    });

    it('entrega body validado y params ya convertidos a la función', async () => {
        let ctx;
        const POST = handle({
            input: z.object({ n: z.number() }), params: z.object({ id: z.coerce.number() }),
        }, (c) => { ctx = c; return { ok: 1 }; });
        await POST(pedir('/api/x', { json: { n: 4 } }), conParams({ id: '8' }));
        expect(ctx.body).toEqual({ n: 4 });
        expect(ctx.params).toEqual({ id: 8 });
    });

    it('415 si el Content-Type no es JSON, 400 si el JSON es inválido', async () => {
        const POST = handle({ input: z.object({}) }, vi.fn());
        const texto = new Request('http://localhost/api/x', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'hola' });
        expect((await POST(texto)).status).toBe(415);
        const roto = new Request('http://localhost/api/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{no json' });
        const r = await leer(await POST(roto));
        expect(r.status).toBe(400);
        expect(r.cuerpo.error.code).toBe('PETICION_INVALIDA');
    });

    it('un POST sin cuerpo usa los valores por omisión del esquema', async () => {
        let ctx;
        const POST = handle({ input: z.object({ completa: z.boolean().optional().default(false) }) }, (c) => { ctx = c; });
        const r = await POST(new Request('http://localhost/api/x', { method: 'POST' }));
        expect(r.status).toBe(200);
        expect(ctx.body).toEqual({ completa: false });
    });
});

describe('handle: tamaño del cuerpo (413)', () => {
    it('rechaza por Content-Length declarado', async () => {
        const POST = handle({ input: z.object({}), maxBodyBytes: 100 }, vi.fn());
        const req = new Request('http://localhost/api/x', {
            method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '5000' }, body: '{}',
        });
        const r = await leer(await POST(req));
        expect(r.status).toBe(413);
        expect(r.cuerpo.error.code).toBe('LIMITE_EXCEDIDO');
    });

    it('rechaza aunque el Content-Length mienta o falte (cuerpo en streaming)', async () => {
        const POST = handle({ input: z.object({ a: z.string() }), maxBodyBytes: 100 }, vi.fn());
        const grande = JSON.stringify({ a: 'x'.repeat(500) });
        const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(grande)); c.close(); } });
        const req = new Request('http://localhost/api/x', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half',
        });
        expect((await POST(req)).status).toBe(413);
    });

    it('multipart: tope = suma de archivos + margen, con ARCHIVO_DEMASIADO_GRANDE', async () => {
        const POST = handle({ archivos: [{ campo: 'f', maxBytes: 1000, tipos: ['jpg'] }] }, vi.fn());
        const grande = new Uint8Array(200_000);
        grande.set(BYTES_JPEG);
        const r = await leer(await POST(pedir('/api/x', { form: { f: archivo(grande, 'image/jpeg') } })));
        expect(r.status).toBe(413);
        expect(r.cuerpo.error.code).toBe('ARCHIVO_DEMASIADO_GRANDE');
    });
});

describe('handle: multipart', () => {
    it('separa campos y archivos validados; el archivo trae bytes, tipo y extensión', async () => {
        let ctx;
        const POST = handle({
            fields: z.object({ id: z.coerce.number() }),
            archivos: [{ campo: 'f', maxBytes: 10_000, tipos: ['jpg'] }],
        }, (c) => { ctx = c; return { ok: true }; });
        const r = await POST(pedir('/api/x', { form: { id: '9', f: archivo(BYTES_JPEG, 'image/jpeg', 'x.png') } }));
        expect(r.status).toBe(200);
        expect(ctx.body).toEqual({ id: 9 });
        expect(ctx.form.archivos.f).toMatchObject({ tipo: 'jpg', ext: 'jpg', size: BYTES_JPEG.length });
    });

    it('archivo obligatorio ausente -> 422 con el campo; opcional ausente -> null', async () => {
        const POST = handle({ archivos: [{ campo: 'f', maxBytes: 100, tipos: ['jpg'] }] }, vi.fn());
        const r = await leer(await POST(pedir('/api/x', { form: { otro: 'x' } })));
        expect(r.status).toBe(422);
        expect(r.cuerpo.error.details.campos[0].campo).toBe('f');

        let ctx;
        const opcional = handle({ fields: z.object({}), archivos: [{ campo: 'f', maxBytes: 100, tipos: ['jpg'], requerido: false }] }, (c) => { ctx = c; });
        await opcional(pedir('/api/x', { form: {} }));
        expect(ctx.form.archivos.f).toBeNull();
    });

    it('acepta JSON o multipart en la misma ruta cuando se declaran ambos', async () => {
        const esquema = z.object({ id_camara: z.coerce.number() });
        const cuerpos = [];
        const POST = handle({
            input: esquema, fields: esquema, archivos: [{ campo: 'image', maxBytes: 10_000, tipos: ['jpg'], requerido: false }],
        }, (c) => { cuerpos.push([c.body, c.form.archivos.image]); });
        await POST(pedir('/api/x', { json: { id_camara: 3 } }));
        await POST(pedir('/api/x', { form: { id_camara: '4', image: archivo(BYTES_JPEG, 'image/jpeg') } }));
        expect(cuerpos[0]).toEqual([{ id_camara: 3 }, null]);
        expect(cuerpos[1][0]).toEqual({ id_camara: 4 });
        expect(cuerpos[1][1].tipo).toBe('jpg');
    });
});

describe('handle: varios archivos con el mismo nombre', () => {
    const jpg = (bytes, nombre = 'f.jpg') => archivo(bytes, 'image/jpeg', nombre);
    const spec = (extra = {}) => ({ campo: 'fotos', maxBytes: 10_000, tipos: ['jpg'], multiple: true, ...extra });

    it('los archivos repetidos llegan en orden de llegada (no se pisan) con su tipo y tamaño', async () => {
        let ctx;
        const POST = handle({ archivos: [spec()] }, (c) => { ctx = c; return { ok: true }; });
        const bytes = fotosDistintas(3);
        const r = await POST(pedir('/api/x', { form: { fotos: bytes.map((b) => jpg(b)) } }));
        expect(r.status).toBe(200);
        expect(ctx.form.archivos.fotos).toHaveLength(3);
        expect(ctx.form.archivos.fotos.map((f) => f.size)).toEqual(bytes.map((b) => b.length));
        expect(ctx.form.archivos.fotos.map((f) => [...f.bytes.subarray(-1)][0])).toEqual([1, 2, 3]);
        expect(ctx.form.archivos.fotos[0]).toMatchObject({ tipo: 'jpg', ext: 'jpg' });
    });

    it('una sola foto en un campo múltiple sigue siendo un arreglo; sin archivos y no requerido, []', async () => {
        const vistos = [];
        const POST = handle({ archivos: [spec({ requerido: false })] }, (c) => { vistos.push(c.form.archivos.fotos); });
        await POST(pedir('/api/x', { form: { fotos: jpg(BYTES_JPEG) } }));
        await POST(pedir('/api/x', { form: { otro: 'x' } }));
        await POST(pedir('/api/x', { form: {} }));
        expect(vistos[0]).toHaveLength(1);
        expect(vistos[1]).toEqual([]);
        expect(vistos[2]).toEqual([]);
    });

    it('un campo múltiple obligatorio sin archivos da 422 con el campo', async () => {
        const r = await leer(await handle({ archivos: [spec()] }, vi.fn())(pedir('/api/x', { form: { otro: 'x' } })));
        expect(r.status).toBe(422);
        expect(r.cuerpo.error.details.campos[0].campo).toBe('fotos');
    });

    it('más de maxArchivos: 422 DEMASIADOS_ARCHIVOS con maximo y recibidos, sin leer los archivos', async () => {
        const fn = vi.fn();
        const POST = handle({ archivos: [spec({ maxArchivos: 2 })] }, fn);
        const r = await leer(await POST(pedir('/api/x', { form: { fotos: fotosDistintas(3).map((b) => jpg(b)) } })));
        expect(r.status).toBe(422);
        expect(r.cuerpo.error).toMatchObject({ code: 'DEMASIADOS_ARCHIVOS', details: { campo: 'fotos', maximo: 2, recibidos: 3 } });
        expect(fn).not.toHaveBeenCalled();
    });

    it('la suma de bytes del campo sobre maxBytesTotal da 413 aunque cada archivo quepa', async () => {
        const grande = (n) => { const b = new Uint8Array(n); b.set(BYTES_JPEG); return jpg(b); };
        const POST = handle({ archivos: [spec({ maxBytesTotal: 5_000 })], maxMultipartBytes: 100_000 }, vi.fn());
        const r = await leer(await POST(pedir('/api/x', { form: { fotos: [grande(3_000), grande(3_000)] } })));
        expect(r.status).toBe(413);
        expect(r.cuerpo.error).toMatchObject({ code: 'ARCHIVO_DEMASIADO_GRANDE', details: { campo: 'fotos' } });
    });

    it('un error de un archivo lleva campo e indice para marcar la foto exacta', async () => {
        const POST = handle({ archivos: [spec()] }, vi.fn());
        const falso = jpg(new TextEncoder().encode('no es jpeg'));
        const r = await leer(await POST(pedir('/api/x', { form: { fotos: [jpg(BYTES_JPEG), falso] } })));
        expect(r.status).toBe(422);
        expect(r.cuerpo.error).toMatchObject({ code: 'ARCHIVO_INVALIDO', details: { campo: 'fotos', indice: 1 } });

        const png = await leer(await POST(pedir('/api/x', { form: { fotos: [archivo(BYTES_PNG, 'image/png'), jpg(BYTES_JPEG)] } })));
        expect(png.status).toBe(415);
        expect(png.cuerpo.error.details).toMatchObject({ campo: 'fotos', indice: 0 });

        const grande = new Uint8Array(20_000);
        grande.set(BYTES_JPEG);
        const pesado = await leer(await POST(pedir('/api/x', { form: { fotos: [jpg(BYTES_JPEG), jpg(BYTES_JPEG), jpg(grande)] } })));
        expect(pesado.status).toBe(413);
        expect(pesado.cuerpo.error.details).toMatchObject({ campo: 'fotos', indice: 2 });
    });

    it('un campo simple repetido es 422 (no gana el último en silencio)', async () => {
        const POST = handle({ archivos: [{ campo: 'foto', maxBytes: 10_000, tipos: ['jpg'] }] }, vi.fn());
        const r = await leer(await POST(pedir('/api/x', { form: { foto: [jpg(BYTES_JPEG), jpg(BYTES_JPEG)] } })));
        expect(r.status).toBe(422);
        expect(r.cuerpo.error.details.campos[0]).toMatchObject({ campo: 'foto', mensaje: 'Solo se admite un archivo en este campo.' });
    });

    it('foto (simple) y fotos (múltiple) pueden llegar juntas: cada campo recibe lo suyo', async () => {
        let ctx;
        const POST = handle({
            archivos: [{ campo: 'foto', maxBytes: 10_000, tipos: ['jpg'], requerido: false }, spec({ requerido: false })],
        }, (c) => { ctx = c; });
        await POST(pedir('/api/x', { form: { foto: jpg(BYTES_JPEG), fotos: fotosDistintas(2).map((b) => jpg(b)) } }));
        expect(ctx.form.archivos.foto.tipo).toBe('jpg');
        expect(ctx.form.archivos.fotos).toHaveLength(2);
    });

    it('maxMultipartBytes fija el tope del cuerpo: más allá, 413 limpio en lugar de un formData truncado', async () => {
        const POST = handle({ archivos: [spec({ maxBytes: 1_000_000 })], maxMultipartBytes: 5_000 }, vi.fn());
        const grande = new Uint8Array(20_000);
        grande.set(BYTES_JPEG);
        const r = await leer(await POST(pedir('/api/x', { form: { fotos: [jpg(grande)] } })));
        expect(r.status).toBe(413);
        expect(r.cuerpo.error.code).toBe('ARCHIVO_DEMASIADO_GRANDE');
    });
});

describe('handle: errores', () => {
    it('ApiError lanzado por la función conserva status y details', async () => {
        const GET = handle({}, () => { throw new ApiError({ code: 'CONFLICTO_X', message: 'Choque', status: 409, details: { a: 1 } }); });
        const r = await leer(await GET(pedir('/api/x', { method: 'GET' })));
        expect(r.status).toBe(409);
        expect(r.cuerpo).toEqual({ error: { code: 'CONFLICTO_X', message: 'Choque', details: { a: 1 } } });
    });

    it('error de negocio de una RPC (HINT) -> código y status del registro', async () => {
        usuario = crearBackend({ rpcs: { api_yo: () => YO.docente, api_corregir_asistencia: () => errorDeNegocio('RN_08_PLAZO_VENCIDO', 'El plazo de corrección terminó.') } });
        getServerBackend.mockResolvedValue(usuario);
        const POST = handle({}, (ctx) => ctx.rpc('api_corregir_asistencia', { idAsistencia: 1 }));
        const r = await leer(await POST(pedir('/api/x', { json: {} })));
        expect(r.status).toBe(409);
        expect(r.cuerpo.error).toMatchObject({ code: 'RN_08_PLAZO_VENCIDO', message: 'El plazo de corrección terminó.' });
    });

    it('errores desconocidos NO filtran detalles internos y se registran sin el mensaje', async () => {
        const GET = handle({}, () => { throw new Error('SECRETO: conexion postgres://user:pass@host fallo con correo a@b.c'); });
        const r = await leer(await GET(pedir('/api/x', { method: 'GET' })));
        expect(r.status).toBe(500);
        expect(r.cuerpo.error.code).toBe('ERROR_INTERNO');
        expect(JSON.stringify(r.cuerpo)).not.toMatch(/SECRETO|postgres|pass|a@b/);
        const log = console.error.mock.calls.flat().join(' ');
        expect(log).toContain('ERROR_INTERNO');
        expect(log).not.toMatch(/SECRETO|postgres|pass|a@b/);
    });

    it('un RAISE sin HINT (texto crudo de Postgres) no sale en details', async () => {
        usuario = crearBackend({ rpcs: { api_yo: () => YO.docente, api_x: () => ({ __error: { code: 'P0001', message: 'fila (a@b.c) rota', details: null, hint: null } }) } });
        getServerBackend.mockResolvedValue(usuario);
        const r = await leer(await handle({}, (ctx) => ctx.rpc('api_x', {}))(pedir('/api/x', { method: 'GET' })));
        expect(r.status).toBe(500);
        expect(JSON.stringify(r.cuerpo)).not.toContain('a@b.c');
        expect(r.cuerpo.error.details).toBeUndefined();
    });

    it('429 agrega Retry-After desde details.reintentar_en_seg', async () => {
        const POST = handle({}, () => { throw new ApiError({ code: 'DEMASIADOS_INTENTOS', message: 'x', status: 429, details: { reintentar_en_seg: 7 } }); });
        const res = await POST(pedir('/api/x', { json: {} }));
        expect(res.status).toBe(429);
        expect(res.headers.get('retry-after')).toBe('7');
    });
});

describe('handle: respuestas', () => {
    it('Cache-Control no-store; undefined -> {ok:true}; Response pasa tal cual; creado = 201', async () => {
        const g1 = await handle({}, () => ({ a: 1 }))(pedir('/api/x', { method: 'GET' }));
        expect(g1.headers.get('cache-control')).toBe('no-store');
        expect(g1.headers.get('x-content-type-options')).toBe('nosniff');
        expect(await handle({}, () => undefined)(pedir('/api/x', { method: 'GET' })).then((r) => r.json())).toEqual({ ok: true });
        const propia = new Response('hola', { status: 202 });
        expect(await handle({}, () => propia)(pedir('/api/x', { method: 'GET' }))).toBe(propia);
        expect((await handle({}, () => creado({ id: 1 }))(pedir('/api/x', { json: {} }))).status).toBe(201);
        expect(json({ a: 1 }, 200).headers.get('cache-control')).toBe('no-store');
    });

    it("auth:'publica' no consulta sesión", async () => {
        const res = await handle({ auth: 'publica' }, () => ({ estado: 'ok' }))(pedir('/api/salud', { method: 'GET' }));
        expect(res.status).toBe(200);
        expect(getServerBackend).not.toHaveBeenCalled();
    });
});
