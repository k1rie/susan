import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));

import { ApiError } from '@/lib/api/errors';
import {
    MAX_ARCHIVO_BYTES, detectarTipo, leerArchivoValidado, prefijoRecortes, reiniciarCacheVigencia,
    rutaObjeto, segundosEfectivos, subirObjeto, ttlUrlFirmada, urlFirmada, urlsFirmadas, validarRutaObjeto,
} from './storage.js';
import { BYTES_JPEG, BYTES_PDF, BYTES_PNG, archivo, crearBackend } from './testing.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => reiniciarCacheVigencia());

describe('detectarTipo (firma binaria)', () => {
    it('reconoce pdf, jpg y png y rechaza lo demás', () => {
        expect(detectarTipo(BYTES_PDF)).toBe('pdf');
        expect(detectarTipo(BYTES_JPEG)).toBe('jpg');
        expect(detectarTipo(BYTES_PNG)).toBe('png');
        expect(detectarTipo(new TextEncoder().encode('MZ ejecutable'))).toBeNull();
        expect(detectarTipo(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull(); // PNG truncado
        expect(detectarTipo(new Uint8Array([]))).toBeNull();
    });
});

describe('leerArchivoValidado', () => {
    it('acepta un JPEG real y la extensión sale del tipo detectado, no del nombre', async () => {
        const r = await leerArchivoValidado(archivo(BYTES_JPEG, 'image/jpeg', 'virus.exe'));
        expect(r).toMatchObject({ tipo: 'jpg', ext: 'jpg', contentType: 'image/jpeg' });
    });
    it('rechaza una firma falsa: declara PDF pero los bytes no lo son (422 ARCHIVO_INVALIDO)', async () => {
        const falso = archivo(new TextEncoder().encode('<html>no soy pdf</html>'), 'application/pdf', 'doc.pdf');
        await expect(leerArchivoValidado(falso)).rejects.toMatchObject({ code: 'ARCHIVO_INVALIDO', status: 422 });
    });
    it('rechaza cuando el tipo real no coincide con el declarado (PNG declarado como JPEG)', async () => {
        await expect(leerArchivoValidado(archivo(BYTES_PNG, 'image/jpeg'))).rejects.toMatchObject({ code: 'ARCHIVO_INVALIDO' });
    });
    it('rechaza un tipo declarado no permitido (415) y uno vacío (422)', async () => {
        await expect(leerArchivoValidado(archivo(BYTES_JPEG, 'image/gif'))).rejects.toMatchObject({ status: 415, code: 'TIPO_NO_PERMITIDO' });
        await expect(leerArchivoValidado(archivo(BYTES_PDF, 'application/pdf'), { permitidos: ['jpg'] })).rejects.toMatchObject({ status: 415 });
        await expect(leerArchivoValidado(archivo(new Uint8Array(0), 'image/jpeg'))).rejects.toMatchObject({ status: 422 });
    });
    it('rechaza más de 5 MiB con 413 ARCHIVO_DEMASIADO_GRANDE', async () => {
        const grande = new Uint8Array(MAX_ARCHIVO_BYTES + 1);
        grande.set(BYTES_JPEG);
        await expect(leerArchivoValidado(archivo(grande, 'image/jpeg'))).rejects.toMatchObject({ status: 413, code: 'ARCHIVO_DEMASIADO_GRANDE' });
        const justo = new Uint8Array(MAX_ARCHIVO_BYTES);
        justo.set(BYTES_JPEG);
        await expect(leerArchivoValidado(archivo(justo, 'image/jpeg'))).resolves.toMatchObject({ size: MAX_ARCHIVO_BYTES });
    });
});

describe('rutas de objeto construidas en servidor', () => {
    it('usan uuid v4 y nunca nada del cliente', () => {
        const r = rutaObjeto.justificante(44, 'pdf');
        expect(r).toMatch(/^justificantes\/44\/[0-9a-f-]{36}\.pdf$/);
        expect(r.split('/')[2].replace('.pdf', '')).toMatch(UUID);
        expect(rutaObjeto.registro(5)).toMatch(/^registro\/5\/[0-9a-f-]{36}\.jpg$/);
        expect(rutaObjeto.consentimiento(5)).toMatch(/^consentimientos\/5\/[0-9a-f-]{36}\.pdf$/);
        expect(rutaObjeto.justificante(44, 'pdf')).not.toBe(r); // dos subidas, dos rutas
        expect(() => rutaObjeto.justificante(44, '../x')).toThrow(ApiError);
    });
    it('el prefijo de recortes lleva sesión, cámara y marca de tiempo', () => {
        expect(prefijoRecortes(12, 3, 1789000000000)).toBe('recortes/12/3-1789000000000/');
        expect(validarRutaObjeto('recortes/12/3-1789000000000/1.jpg')).toBeTruthy();
        expect(validarRutaObjeto('recortes/88/1204/3.jpg')).toBeTruthy();
    });
    it('validarRutaObjeto rechaza traversal, absolutas y patrones ajenos', () => {
        for (const mala of ['', '/registro/1/x.jpg', 'registro/../x', 'registro/1//a.jpg', 'registro/1/a.jpg', 'otro/1/2.jpg', 'recortes\\1\\2.jpg']) {
            expect(() => validarRutaObjeto(mala), mala).toThrow(ApiError);
        }
    });
});

describe('subirObjeto', () => {
    it('sube con upsert=false y falla con 502 sin filtrar la ruta', async () => {
        const admin = crearBackend();
        const ruta = rutaObjeto.registro(9);
        await subirObjeto(ruta, BYTES_JPEG, { contentType: 'image/jpeg', admin });
        expect(admin.bucket.upload).toHaveBeenCalledWith(ruta, BYTES_JPEG, { contentType: 'image/jpeg', upsert: false });
        const roto = crearBackend({ storage: { upload: vi.fn(async () => ({ error: { message: ruta } })) } });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const e = await subirObjeto(ruta, BYTES_JPEG, { admin: roto }).catch((x) => x);
        expect(e).toMatchObject({ code: 'ALMACENAMIENTO_NO_DISPONIBLE', status: 502 });
        expect(console.error.mock.calls.flat().join(' ')).not.toContain(ruta);
    });
});

describe('TTL de URL firmada (RNF-04: <= 300 s)', () => {
    it('ttlUrlFirmada acota a 300 y tolera valores inválidos', () => {
        expect(ttlUrlFirmada(300)).toBe(300);
        expect(ttlUrlFirmada(9999)).toBe(300);
        expect(ttlUrlFirmada(60)).toBe(60);
        expect(ttlUrlFirmada(0)).toBe(300);
        expect(ttlUrlFirmada('x')).toBe(300);
        expect(ttlUrlFirmada(null)).toBe(300);
        expect(ttlUrlFirmada(-5)).toBe(300);
    });
    it('segundosEfectivos = max(1, min(solicitado, vigencia, 300))', async () => {
        expect(await segundosEfectivos(undefined, { vigencia: 120 })).toBe(120);
        expect(await segundosEfectivos(500, { vigencia: 120 })).toBe(120);
        expect(await segundosEfectivos(30, { vigencia: 120 })).toBe(30);
        expect(await segundosEfectivos(1000, { vigencia: 1000 })).toBe(300);
        expect(await segundosEfectivos(0.2, { vigencia: 120 })).toBe(1);
    });
    it('lee el parámetro cuando la RPC no trajo vigencia y lo cachea; un parámetro > 300 se acota', async () => {
        const backend = crearBackend({ rpcs: { api_parametros_publicos: () => ({ vigencia_url_firmada_seg: 900 }) } });
        expect(await segundosEfectivos(undefined, { backend })).toBe(300);
        expect(await segundosEfectivos(undefined, { backend })).toBe(300);
        expect(backend.rpc).toHaveBeenCalledTimes(1);
    });
    it('urlFirmada pide a Storage exactamente el TTL acotado', async () => {
        const admin = crearBackend();
        const f = await urlFirmada('registro/3/0f8e1c2a-aaaa-4bbb-8ccc-123456789abc.jpg', { admin, segundos: 99999, vigencia: 900 });
        expect(f.segundos).toBe(300);
        expect(admin.bucket.createSignedUrl.mock.calls[0][1]).toBe(300);
        expect(new Date(f.expira_en).getTime() - Date.now()).toBeLessThanOrEqual(300_500);
    });
    it('urlFirmada falla con 502 si Storage no firma; urlsFirmadas deja url null en esa ruta sin tumbar el lote', async () => {
        const buena = 'recortes/1/2/1.jpg';
        const mala = 'recortes/1/2/2.jpg';
        const admin = crearBackend({
            storage: {
                createSignedUrl: vi.fn(async (r) => (r === mala ? { data: null, error: { message: 'x' } } : { data: { signedUrl: `u/${r}` }, error: null })),
            },
        });
        await expect(urlFirmada(mala, { admin })).rejects.toMatchObject({ status: 502 });
        const lote = await urlsFirmadas([buena, mala], { admin, vigencia: 300 });
        expect(lote[0].url).toBe(`u/${buena}`);
        expect(lote[1]).toEqual({ ruta: mala, url: null, expira_en: null });
    });
});
