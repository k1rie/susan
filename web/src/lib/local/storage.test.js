import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BUCKET } from '@/config';
import { firmarCarga } from './session.js';
import {
    MAX_SUBIDA,
    crearStorageLocal,
    firmarObjeto,
    rutaEnDisco,
    segmentosSeguros,
    verificarTokenObjeto,
} from './storage.js';

const SECRETO = 'secreto-storage-prueba';
const SUB = '34cf6120-b7b9-b9cd-2db5-2f108d40b771';
let dir;

beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'susan-storage-'));
    vi.stubEnv('LOCAL_STORAGE_DIR', dir);
    vi.stubEnv('LOCAL_AUTH_SECRET', SECRETO);
});
afterAll(async () => {
    vi.unstubAllEnvs();
    await fs.rm(dir, { recursive: true, force: true });
});

describe('validacion de rutas de objeto', () => {
    it('acepta rutas relativas normales', () => {
        expect(segmentosSeguros('registro/12/foto.jpg')).toEqual(['registro', '12', 'foto.jpg']);
        expect(segmentosSeguros('indice/v1.json')).toEqual(['indice', 'v1.json']);
    });

    it.each([
        ['traversal', '../etc/passwd'],
        ['traversal intermedio', 'a/../../b'],
        ['segmento punto', 'a/./b'],
        ['absoluta', '/etc/passwd'],
        ['NUL', 'a\u0000b'],
        ['backslash', 'a\\b'],
        ['segmento vacio', 'a//b'],
        ['termina en barra', 'a/b/'],
        ['vacia', ''],
        ['no cadena', 42],
        ['salto de linea', 'a\nb'],
        ['demasiado larga', 'a'.repeat(2000)],
    ])('rechaza %s', (_n, ruta) => {
        expect(segmentosSeguros(ruta)).toBeNull();
    });

    it('rutaEnDisco queda siempre dentro de la raiz y de su bucket', () => {
        const r = rutaEnDisco('susan-test', 'a/b.txt');
        expect(r).toBe(path.join(dir, 'susan-test', 'a', 'b.txt'));
        expect(rutaEnDisco('../fuera', 'a')).toBeNull();
        expect(rutaEnDisco('susan-test', '../x')).toBeNull();
    });
});

describe('token de URL firmada', () => {
    it('round-trip valido', () => {
        const t = firmarObjeto('susan-test', 'a/b.txt', 60, { secreto: SECRETO, ahoraSeg: 1000 });
        expect(verificarTokenObjeto(t, { secreto: SECRETO, ahoraSeg: 1030 })).toEqual({ bucket: 'susan-test', path: 'a/b.txt' });
    });

    it('vencido', () => {
        const t = firmarObjeto('susan-test', 'a/b.txt', 60, { secreto: SECRETO, ahoraSeg: 1000 });
        expect(verificarTokenObjeto(t, { secreto: SECRETO, ahoraSeg: 1060 })).toBeNull();
    });

    it('limita la vigencia a 300 s aunque se pida mas', () => {
        const t = firmarObjeto('susan-test', 'a/b.txt', 99999, { secreto: SECRETO, ahoraSeg: 1000 });
        expect(verificarTokenObjeto(t, { secreto: SECRETO, ahoraSeg: 1299 })).not.toBeNull();
        expect(verificarTokenObjeto(t, { secreto: SECRETO, ahoraSeg: 1300 })).toBeNull();
    });

    it('manipulado: cambiar la ruta o la firma invalida', () => {
        const t = firmarObjeto('susan-test', 'a/b.txt', 60, { secreto: SECRETO, ahoraSeg: 1000 });
        const [, firma] = t.split('.');
        const otro = Buffer.from(JSON.stringify({ bucket: 'susan-test', path: 'secreto.txt', exp: 5000 })).toString('base64url');
        expect(verificarTokenObjeto(`${otro}.${firma}`, { secreto: SECRETO, ahoraSeg: 1000 })).toBeNull();
        expect(verificarTokenObjeto(`${t}x`, { secreto: SECRETO, ahoraSeg: 1000 })).toBeNull();
    });

    it('traversal dentro de un token bien firmado tambien se rechaza', () => {
        const t = firmarCarga({ bucket: 'susan-test', path: '../../etc/passwd', exp: 5000 }, SECRETO, 'storage');
        expect(verificarTokenObjeto(t, { secreto: SECRETO, ahoraSeg: 1000 })).toBeNull();
    });

    it('un token firmado como sesion no vale como objeto', () => {
        const t = firmarCarga({ bucket: 'susan-test', path: 'a', exp: 5000 }, SECRETO, 'sesion');
        expect(verificarTokenObjeto(t, { secreto: SECRETO, ahoraSeg: 1000 })).toBeNull();
    });
});

describe('storage en disco (privilegios de servicio)', () => {
    const s = () => crearStorageLocal({ privilegios: 'servicio' }).from('susan-test');

    it('sube, descarga, firma y borra', async () => {
        const subida = await s().upload('docs/a.txt', Buffer.from('hola'), {});
        expect(subida.error).toBeNull();
        expect(subida.data.path).toBe('docs/a.txt');
        expect(await fs.readFile(path.join(dir, 'susan-test', 'docs', 'a.txt'), 'utf8')).toBe('hola');

        const bajada = await s().download('docs/a.txt');
        expect(await bajada.data.text()).toBe('hola');

        const firma = await s().createSignedUrl('docs/a.txt', 60);
        expect(firma.data.signedUrl).toMatch(/^\/api\/_local\/storage\/object\?token=[\w-]+\.[\w-]+$/);
        const token = new URL(firma.data.signedUrl, 'http://x').searchParams.get('token');
        expect(verificarTokenObjeto(token)).toEqual({ bucket: 'susan-test', path: 'docs/a.txt' });

        const quitado = await s().remove(['docs/a.txt', 'docs/no-existe.txt']);
        expect(quitado.data).toEqual([{ name: 'docs/a.txt', bucket_id: 'susan-test' }]);
        expect((await s().download('docs/a.txt')).error.statusCode).toBe('404');
    });

    it('sin upsert no pisa; con upsert si', async () => {
        await s().upload('dup.txt', Buffer.from('uno'));
        const dup = await s().upload('dup.txt', Buffer.from('dos'));
        expect(dup.error.statusCode).toBe('409');
        expect((await s().upload('dup.txt', Buffer.from('dos'), { upsert: true })).error).toBeNull();
        expect(await (await s().download('dup.txt')).data.text()).toBe('dos');
    });

    it('acepta Blob y Uint8Array, y no deja temporales', async () => {
        await s().upload('blob.bin', new Blob([new Uint8Array([1, 2, 3])]));
        await s().upload('u8.bin', new Uint8Array([4, 5]));
        expect((await fs.readdir(path.join(dir, 'susan-test'))).filter((n) => n.endsWith('.tmp'))).toEqual([]);
        expect(Buffer.from(await (await s().download('blob.bin')).data.arrayBuffer())).toEqual(Buffer.from([1, 2, 3]));
    });

    it('rechaza rutas peligrosas en todas las operaciones y nada sale de la raiz', async () => {
        for (const ruta of ['../x.txt', '/abs.txt', 'a\\b.txt', 'a//b.txt']) {
            expect((await s().upload(ruta, Buffer.from('x'))).error.statusCode).toBe('400');
            expect((await s().download(ruta)).error.statusCode).toBe('400');
            expect((await s().createSignedUrl(ruta, 60)).error.statusCode).toBe('400');
            expect((await s().remove([ruta])).error.statusCode).toBe('400');
        }
        await expect(fs.stat(path.join(dir, '..', 'x.txt'))).rejects.toThrow();
    });

    it('rechaza bucket invalido, cuerpo no soportado y objetos de mas de 10 MB', async () => {
        const malo = crearStorageLocal().from('../fuera');
        expect((await malo.upload('a.txt', Buffer.from('x'))).error.statusCode).toBe('400');
        expect((await s().upload('a.txt', { raro: true })).error.statusCode).toBe('400');
        expect((await s().upload('grande.bin', Buffer.alloc(MAX_SUBIDA + 1))).error.statusCode).toBe('413');
    });

    it('createSignedUrl de un objeto inexistente da 404', async () => {
        expect((await s().createSignedUrl('nada.txt', 60)).error.statusCode).toBe('404');
    });
});

describe('storage con privilegios de usuario', () => {
    it('sin sesion: 401', async () => {
        const r = await crearStorageLocal({ privilegios: 'usuario' }).from('susan-test').upload('a.txt', Buffer.from('x'));
        expect(r.error.statusCode).toBe('401');
    });

    it('el bucket privado de la app esta cerrado al usuario (politica RESTRICTIVE de 0090)', async () => {
        const u = crearStorageLocal({ privilegios: 'usuario', sub: SUB }).from(BUCKET);
        expect((await u.upload('a.txt', Buffer.from('x'))).error.statusCode).toBe('403');
        expect((await u.download('a.txt')).error.statusCode).toBe('403');
        expect((await u.remove(['a.txt'])).error.statusCode).toBe('403');
        expect((await u.createSignedUrl('a.txt', 60)).error.statusCode).toBe('403');
    });

    it('otros buckets de desarrollo si funcionan', async () => {
        const u = crearStorageLocal({ privilegios: 'usuario', sub: SUB }).from('susan-test');
        expect((await u.upload('u.txt', Buffer.from('x'))).error).toBeNull();
    });
});
