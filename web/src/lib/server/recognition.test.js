import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    activarIndice, construirIndice, infoIndice, manifiestoIndice, reconocer, recognitionFetch, sinVectores,
    verificarFotoServicio,
} from './recognition.js';
import { BYTES_JPEG } from './testing.js';

const jsonRes = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
const RESPUESTA_OK = {
    index_version: 'v003', elapsed_ms: 412, image: { width: 640, height: 480 },
    faces: [{ bbox: [1, 2, 30, 40], det_score: 0.98, candidate: { faiss_id: 1001, score: 0.912 }, objeto_recorte: 'recortes/1/2-3/1.jpg' }],
};
const imagen = () => new Blob([BYTES_JPEG], { type: 'image/jpeg' });

beforeEach(() => {
    vi.stubEnv('RECOGNITION_SERVICE_URL', 'http://svc.test:8000');
    vi.stubEnv('RECOGNITION_SERVICE_API_KEY', 'clave-de-prueba');
});
afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('sinVectores', () => {
    it('elimina a cualquier profundidad vectores y embeddings', () => {
        const limpio = sinVectores({ a: 1, vector: [1], faces: [{ embedding: [1], x: 2, nested: { query_vector: [1], vectors_b64: 'AA', ok: 1 } }] });
        expect(JSON.stringify(limpio)).not.toMatch(/vector|embedding/);
        expect(limpio.faces[0].x).toBe(2);
        expect(limpio.faces[0].nested.ok).toBe(1);
    });
});

describe('reconocer', () => {
    it('envía X-API-Key, multipart correcto y descarta vectores y campos desconocidos de la respuesta', async () => {
        const fetchMock = vi.fn(async () => jsonRes({
            ...RESPUESTA_OK,
            vector: [0.1],
            faces: [{ ...RESPUESTA_OK.faces[0], embedding: [0.2, 0.3], extra: 1 }],
        }));
        vi.stubGlobal('fetch', fetchMock);
        const r = await reconocer({ imagen: imagen(), allowedFaissIds: [1001, 1002], cropPrefix: 'recortes/1/2-3/' });
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('http://svc.test:8000/v1/recognize');
        expect(init.headers['X-API-Key']).toBe('clave-de-prueba');
        expect(init.body.get('allowed_faiss_ids')).toBe('[1001,1002]');
        expect(init.body.get('crop_prefix')).toBe('recortes/1/2-3/');
        expect(init.body.get('max_faces')).toBe('60');
        expect(init.body.get('image')).toBeInstanceOf(Blob);
        expect(JSON.stringify(r)).not.toMatch(/vector|embedding|extra/);
        expect(r.faces[0].candidate).toEqual({ faiss_id: 1001, score: 0.912 });
    });

    it('usa camera_url en lugar de imagen y rechaza URL con credenciales o esquemas raros', async () => {
        const fetchMock = vi.fn(async () => jsonRes(RESPUESTA_OK));
        vi.stubGlobal('fetch', fetchMock);
        await reconocer({ cameraUrl: 'http://10.0.0.5/snapshot.jpg', allowedFaissIds: [] });
        expect(fetchMock.mock.calls[0][1].body.get('camera_url')).toBe('http://10.0.0.5/snapshot.jpg');
        expect(fetchMock.mock.calls[0][1].body.get('image')).toBeNull();
        await expect(reconocer({ cameraUrl: 'http://u:p@10.0.0.5/x', allowedFaissIds: [] })).rejects.toMatchObject({ code: 'VALIDACION' });
        await expect(reconocer({ cameraUrl: 'file:///etc/passwd', allowedFaissIds: [] })).rejects.toMatchObject({ code: 'VALIDACION' });
        await expect(reconocer({ allowedFaissIds: [] })).rejects.toMatchObject({ code: 'VALIDACION' });
        await expect(reconocer({ imagen: imagen(), cameraUrl: 'http://a/', allowedFaissIds: [] })).rejects.toMatchObject({ code: 'VALIDACION' });
    });

    it('valida candidatos y prefijo antes de llamar', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(reconocer({ imagen: imagen(), allowedFaissIds: [-1] })).rejects.toMatchObject({ code: 'VALIDACION' });
        await expect(reconocer({ imagen: imagen(), allowedFaissIds: [1.5] })).rejects.toMatchObject({ code: 'VALIDACION' });
        await expect(reconocer({ imagen: imagen(), allowedFaissIds: [], cropPrefix: '../etc/' })).rejects.toMatchObject({ code: 'VALIDACION' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        [401, { code: 'UNAUTHORIZED' }, 'SERVICIO_RECONOCIMIENTO_NO_AUTORIZADO', 502],
        [409, { code: 'INDEX_NOT_LOADED' }, 'INDEX_NOT_LOADED', 409],
        [422, { code: 'INVALID_IMAGE' }, 'IMAGEN_INVALIDA', 422],
        [422, { code: 'CAMERA_URL_BLOCKED' }, 'CAMARA_URL_BLOQUEADA', 422],
        [504, { code: 'CAMERA_UNREACHABLE' }, 'CAMARA_INALCANZABLE', 504],
        [500, { code: 'X' }, 'SERVICIO_RECONOCIMIENTO_ERROR', 502],
    ])('mapea %i %j -> %s', async (status, cuerpo, code, esperado) => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ ...cuerpo, message: 'detalle interno 10.0.0.5' }, status)));
        const e = await reconocer({ imagen: imagen(), allowedFaissIds: [] }).catch((x) => x);
        expect(e).toMatchObject({ code, status: esperado });
        expect(JSON.stringify(e.toJSON())).not.toContain('10.0.0.5'); // no se reenvía el mensaje del servicio
    });

    it('conexión rechazada y timeout -> 503 SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE tras reintentos acotados', async () => {
        const fetchMock = vi.fn(async () => { throw new TypeError('fetch failed'); });
        vi.stubGlobal('fetch', fetchMock);
        const e = await reconocer({ imagen: imagen(), allowedFaissIds: [] }).catch((x) => x);
        expect(e).toMatchObject({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', status: 503 });
        expect(fetchMock).toHaveBeenCalledTimes(2); // 1 + 1 reintento
    });

    it('reintenta un 503 transitorio y se recupera; no reintenta errores 4xx ni 504', async () => {
        const secuencia = [jsonRes({ code: 'X' }, 503), jsonRes(RESPUESTA_OK)];
        const fetchMock = vi.fn(async () => secuencia.shift());
        vi.stubGlobal('fetch', fetchMock);
        await expect(reconocer({ imagen: imagen(), allowedFaissIds: [] })).resolves.toMatchObject({ index_version: 'v003' });
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const f2 = vi.fn(async () => jsonRes({ code: 'CAMERA_UNREACHABLE' }, 504));
        vi.stubGlobal('fetch', f2);
        await reconocer({ cameraUrl: 'http://10.0.0.5/s.jpg', allowedFaissIds: [] }).catch(() => {});
        expect(f2).toHaveBeenCalledTimes(1);
    });

    it('sin API key configurada responde 503 CONFIGURACION_FALTANTE sin llamar', async () => {
        vi.stubEnv('RECOGNITION_SERVICE_API_KEY', '');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(recognitionFetch('/v1/index')).rejects.toMatchObject({ code: 'CONFIGURACION_FALTANTE', status: 503 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('una respuesta con forma inesperada es SERVICIO_RECONOCIMIENTO_ERROR', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ faces: 'no' })));
        await expect(reconocer({ imagen: imagen(), allowedFaissIds: [] })).rejects.toMatchObject({ code: 'SERVICIO_RECONOCIMIENTO_ERROR' });
    });
});

describe('otros endpoints', () => {
    it('photo check, build, activate, info y manifest devuelven la forma validada', async () => {
        const respuestas = {
            '/v1/photo/check': { rostros: 1, un_solo_rostro: true, calidad: { brillo: 120, nitidez: 80, tamano_rostro_px: 150, frontal: true }, motivo_rechazo: null },
            '/v1/index/build': { version: 'v004', objeto_indice: 'indice/v004.json', dimension: 512, ntotal: 1, mapeo: [{ id_plantilla: 1, faiss_id: 5 }], errores: [] },
            '/v1/index/activate': { version: 'v004', ntotal: 1, dimension: 512, model: 'fake', loaded_at: 'x', active: false, preloaded: true, previous_version: 'v003' },
            '/v1/index': { version: 'v004', ntotal: 1, dimension: 512, model: 'fake', loaded_at: 'x' },
            '/v1/index/v004/manifest': { version: 'v004', ntotal: 1, dimension: 512, refs: [{ id_plantilla: 1, faiss_id: 5 }] },
        };
        const fetchMock = vi.fn(async (url) => jsonRes(respuestas[new URL(url).pathname]));
        vi.stubGlobal('fetch', fetchMock);
        expect((await verificarFotoServicio(imagen())).un_solo_rostro).toBe(true);
        const b = await construirIndice({ version: 'v004', baseVersion: 'v003', entries: [{ id_plantilla: 1, faiss_id: 5, keep: true }] });
        expect(b.mapeo).toHaveLength(1);
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ version: 'v004', base_version: 'v003', entries: [{ id_plantilla: 1, faiss_id: 5, keep: true }] });
        expect((await activarIndice({ version: 'v004', preloadOnly: true })).preloaded).toBe(true);
        expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ version: 'v004', preload_only: true });
        expect((await infoIndice()).version).toBe('v004');
        expect((await manifiestoIndice('v004')).refs).toHaveLength(1);
        await expect(manifiestoIndice('../x')).rejects.toMatchObject({ code: 'VALIDACION' });
    });
});
