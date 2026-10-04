import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_AVANCE_MIN } from '@/lib/local/reloj.js';

// IS_LOCAL se evalua una sola vez al importar @/config; se vuelve dinamico para probar los modos (igual que handlers.test.js).
vi.mock('@/config', async (original) => {
    const real = await original();
    return {
        ...real,
        get IS_LOCAL() {
            return process.env.SUSAN_LOCAL === '1' || process.env.NEXT_PUBLIC_SUSAN_LOCAL === '1';
        },
    };
});

// La sesion se prueba en handlers.test.js (con BD). Aqui solo se necesita "hay un usuario": se simula su busqueda.
const UUID = '34cf6120-b7b9-b9cd-2db5-2f108d40b771';
vi.mock('@/lib/local/auth.js', async (original) => {
    const real = await original();
    return { ...real, obtenerUsuarioPorId: vi.fn(async (id) => ({ id, email: 'docente1@susan.local' })) };
});

const { obtenerReloj, cambiarReloj } = await import('./reloj.js');
const { crearTokenSesion } = await import('@/lib/local/session.js');

const ORIGEN = 'http://localhost:3101';
const COOKIE = `susan_local_session=${crearTokenSesion(UUID)}`;

function peticion({ metodo = 'POST', cuerpo, textoCrudo, cookie = COOKIE, origen = ORIGEN } = {}) {
    const headers = {};
    if (origen) headers.origin = origen;
    if (cookie) headers.cookie = cookie;
    let body;
    if (textoCrudo !== undefined) {
        headers['content-type'] = 'application/json';
        body = textoCrudo;
    } else if (cuerpo !== undefined) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(cuerpo);
    }
    return new NextRequest(`${ORIGEN}/api/_local/reloj`, { method: metodo, headers, body });
}

const get = (opciones) => obtenerReloj(peticion({ metodo: 'GET', origen: null, ...opciones }));
const post = (cuerpo, opciones) => cambiarReloj(peticion({ cuerpo, ...opciones }));

let dir;
let archivo;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'susan-reloj-h-'));
    archivo = path.join(dir, 'run', 'fake_now');
    vi.stubEnv('SUSAN_LOCAL', '1');
    vi.stubEnv('LOCAL_FAKE_NOW', '2026-09-14 07:12:00-06');
    vi.stubEnv('LOCAL_CLOCK_FILE', archivo);
});

afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('/api/_local/reloj no existe fuera del modo local', () => {
    it('SUSAN_LOCAL sin definir: 404 JSON en GET y POST, sin tocar el archivo', async () => {
        vi.stubEnv('SUSAN_LOCAL', '');
        vi.stubEnv('NEXT_PUBLIC_SUSAN_LOCAL', '');
        for (const res of [await get(), await post({ avanzarMin: 5 })]) {
            expect(res.status).toBe(404);
            expect((await res.json()).error.code).toBe('NO_ENCONTRADO');
        }
        expect(fs.existsSync(archivo)).toBe(false);
    });

    it('NODE_ENV=production: 404 aunque SUSAN_LOCAL=1', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        expect((await get()).status).toBe(404);
        expect((await post({ restablecer: true })).status).toBe(404);
        expect((await post({ avanzarMin: 5 })).status).toBe(404);
        expect(fs.existsSync(archivo)).toBe(false);
    });
});

describe('autenticacion y CSRF', () => {
    it('sin cookie de sesion: 401 NO_AUTENTICADO en GET y POST', async () => {
        for (const res of [await get({ cookie: null }), await post({ avanzarMin: 5 }, { cookie: null })]) {
            expect(res.status).toBe(401);
            expect((await res.json()).error.hint).toBe('NO_AUTENTICADO');
        }
        expect(fs.existsSync(archivo)).toBe(false);
    });

    it('cookie manipulada: 401', async () => {
        expect((await get({ cookie: 'susan_local_session=abc.def' })).status).toBe(401);
    });

    it('POST exige Origin igual al host (sin Origin u ajeno: 403 y no cambia nada)', async () => {
        for (const origen of [null, 'http://evil.example', 'http://localhost:9999', 'no-es-url']) {
            const res = await post({ avanzarMin: 5 }, { origen });
            expect(res.status, String(origen)).toBe(403);
            expect((await res.json()).error.code).toBe('ORIGEN_INVALIDO');
        }
        expect(fs.existsSync(archivo)).toBe(false);
    });

    it('GET no exige Origin (es de lectura) pero si sesion', async () => {
        expect((await get({ origen: null })).status).toBe(200);
    });
});

describe('GET', () => {
    it('devuelve { activo, corre, ahora, fecha, hora, inicial } con el valor inicial', async () => {
        const res = await get();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            activo: true,
            corre: false,
            ahora: '2026-09-14T07:12:00-06:00',
            fecha: '2026-09-14',
            hora: '07:12:00',
            inicial: '2026-09-14T07:12:00-06:00',
        });
    });

    it('con el reloj apagado responde 200 activo:false (la interfaz lo usa para ocultarse)', async () => {
        vi.stubEnv('LOCAL_FAKE_NOW', 'off');
        const cuerpo = await (await get()).json();
        expect(cuerpo).toMatchObject({ activo: false, corre: false, inicial: null });
        expect(cuerpo.ahora).toMatch(/-06:00$/);
    });
});

describe('POST', () => {
    it('avanzarMin mueve el reloj y GET lo refleja (es persistente)', async () => {
        const res = await post({ avanzarMin: 30 });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ activo: true, ahora: '2026-09-14T07:42:00-06:00', hora: '07:42:00', fecha: '2026-09-14' });
        expect((await (await get()).json()).hora).toBe('07:42:00');
        expect((await (await post({ avanzarMin: -12 })).json()).hora).toBe('07:30:00');
    });

    it('fijar acepta hora de la sede con o sin segundos', async () => {
        expect((await (await post({ fijar: '2026-09-14 07:03' })).json()).hora).toBe('07:03:00');
        const cuerpo = await (await post({ fijar: '2026-09-15T06:55:30' })).json();
        expect(cuerpo).toMatchObject({ fecha: '2026-09-15', hora: '06:55:30', ahora: '2026-09-15T06:55:30-06:00' });
        expect((await (await post({ fijar: '  2026-09-14 08:00  ' })).json()).hora).toBe('08:00:00');
    });

    it('restablecer vuelve al valor inicial', async () => {
        await post({ avanzarMin: 45 });
        const res = await post({ restablecer: true });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ hora: '07:12:00', corre: false });
        expect(fs.existsSync(archivo)).toBe(false);
    });

    it('correr echa a andar y congela', async () => {
        expect((await (await post({ correr: true })).json()).corre).toBe(true);
        expect((await (await get()).json()).corre).toBe(true);
        expect((await (await post({ correr: false })).json()).corre).toBe(false);
    });

    it('acepta el limite exacto del salto (una semana)', async () => {
        expect((await (await post({ avanzarMin: MAX_AVANCE_MIN })).json()).fecha).toBe('2026-09-21');
    });

    it.each([
        ['cuerpo vacio', {}],
        ['avanzarMin cero', { avanzarMin: 0 }],
        ['avanzarMin decimal', { avanzarMin: 1.5 }],
        ['avanzarMin texto', { avanzarMin: '5' }],
        ['avanzarMin nulo', { avanzarMin: null }],
        ['avanzarMin sobre el tope', { avanzarMin: MAX_AVANCE_MIN + 1 }],
        ['avanzarMin bajo el tope', { avanzarMin: -MAX_AVANCE_MIN - 1 }],
        ['fijar sin forma de fecha', { fijar: 'ayer' }],
        ['fijar sin hora', { fijar: '2026-09-14' }],
        ['fijar con zona (el cuerpo solo admite hora de la sede)', { fijar: '2026-09-14 07:12:00-05' }],
        ['fijar no texto', { fijar: 20260914 }],
        ['restablecer en falso', { restablecer: false }],
        ['correr no booleano', { correr: 'si' }],
        ['dos operaciones a la vez', { avanzarMin: 5, fijar: '2026-09-14 08:00' }],
        ['llave desconocida', { avanzarMin: 5, extra: 1 }],
        ['llave desconocida sola', { adelantar: 5 }],
    ])('rechaza con 400 validation_failed: %s', async (_nombre, cuerpo) => {
        const res = await post(cuerpo);
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('validation_failed');
        expect(fs.existsSync(archivo)).toBe(false);
    });

    it('cuerpo que no es JSON, vacio o un arreglo: 400', async () => {
        for (const textoCrudo of ['{no json', '', '[1,2]', '5', 'null']) {
            const res = await cambiarReloj(peticion({ textoCrudo }));
            expect(res.status, JSON.stringify(textoCrudo)).toBe(400);
        }
    });

    it('una fecha con forma valida pero inexistente (31 de febrero): 400 FORMATO_INVALIDO', async () => {
        const res = await post({ fijar: '2026-02-31 10:00' });
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('FORMATO_INVALIDO');
    });

    it('fuera de 2000-2099: 400 FUERA_DE_RANGO y no cambia el estado', async () => {
        for (const fijar of ['1999-12-31 23:59', '2100-01-01 00:00']) {
            const res = await post({ fijar });
            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe('FUERA_DE_RANGO');
        }
        expect((await (await get()).json()).hora).toBe('07:12:00');
    });

    it('con el reloj apagado: 409 RELOJ_NO_ACTIVO en toda operacion (nada se escribe)', async () => {
        vi.stubEnv('LOCAL_FAKE_NOW', 'off');
        for (const cuerpo of [{ avanzarMin: 5 }, { fijar: '2026-09-14 08:00' }, { restablecer: true }, { correr: true }]) {
            const res = await post(cuerpo);
            expect(res.status).toBe(409);
            expect((await res.json()).error.code).toBe('RELOJ_NO_ACTIVO');
        }
        expect(fs.existsSync(archivo)).toBe(false);
    });

    it('un fallo de disco se responde 500 generico (sin rutas ni detalles internos) y no deja temporales', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        // El destino es un directorio: el rename del archivo temporal falla con un error de sistema.
        const destino = path.join(dir, 'ocupado');
        fs.mkdirSync(destino, { recursive: true });
        fs.writeFileSync(path.join(destino, 'dentro'), 'x');
        vi.stubEnv('LOCAL_CLOCK_FILE', destino);
        const res = await post({ avanzarMin: 5 });
        expect(res.status).toBe(500);
        const cuerpo = await res.json();
        expect(cuerpo.error.code).toBe('LOCAL_ERROR');
        expect(JSON.stringify(cuerpo)).not.toContain(dir);
        expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
        expect(error).toHaveBeenCalled();
    });
});
