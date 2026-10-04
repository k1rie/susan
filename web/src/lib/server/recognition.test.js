import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    activarIndice, construirIndice, infoIndice, manifiestoIndice, reconocer, recognitionFetch, sinVectores,
    validarFormaConjunto, verificarFotoServicio, verificarFotosServicio,
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

describe('photo/check: motivo_codigo', () => {
    const CALIDAD = { brillo: 120, nitidez: 80, tamano_rostro_px: 150, frontal: false };

    it('conserva el código estable cuando el servicio lo manda y lo deja en null si no (servicio anterior)', async () => {
        const base = { rostros: 1, un_solo_rostro: true, calidad: CALIDAD, motivo_rechazo: 'El rostro no esta de frente.' };
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ ...base, motivo_codigo: 'NO_FRONTAL' })));
        expect((await verificarFotoServicio(imagen())).motivo_codigo).toBe('NO_FRONTAL');
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes(base)));
        expect((await verificarFotoServicio(imagen())).motivo_codigo).toBeNull();
    });
});

describe('verificarFotosServicio (check-set)', () => {
    const CALIDAD = { brillo: 120.5, nitidez: 88.2, tamano_rostro_px: 210, frontal: true };
    const foto = (indice, extra = {}) => ({
        indice, estado: 'aceptada', rostros: 1, un_solo_rostro: true, calidad: CALIDAD,
        motivo_rechazo: null, motivo_codigo: null, coseno_resto: 0.8, ...extra,
    });
    const conjunto = (fotos, extra = {}) => ({
        total: fotos.length, aceptadas: fotos.length, minimo: 3, maximo: 8, suficiente: true, consistente: true,
        ambiguo: false, umbral_coseno: 0.35, coseno_min: 0.6, coseno_medio: 0.8, coseno_max_par: 0.93,
        advertencias: [], fotos, ...extra,
    });
    const blobs = (n) => Array.from({ length: n }, imagen);

    it('envía "images" repetido con X-API-Key, 30 s de margen y devuelve la forma validada', async () => {
        const fetchMock = vi.fn(async () => jsonRes(conjunto([foto(0), foto(1), foto(2)])));
        vi.stubGlobal('fetch', fetchMock);
        const r = await verificarFotosServicio(blobs(3));
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('http://svc.test:8000/v1/photo/check-set');
        expect(init.headers['X-API-Key']).toBe('clave-de-prueba');
        expect(init.body.getAll('images')).toHaveLength(3);
        expect(r).toMatchObject({ total: 3, aceptadas: 3, suficiente: true, consistente: true, umbral_coseno: 0.35 });
        expect(r.fotos[1]).toMatchObject({ indice: 1, estado: 'aceptada', coseno_resto: 0.8 });
    });

    it('descarta cualquier vector o embedding que el servicio mandara por error (RNF-03)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes({
            ...conjunto([foto(0)]), embedding: [0.1], fotos: [{ ...foto(0), vector: [0.2], query_vector: [0.3] }],
        })));
        expect(JSON.stringify(await verificarFotosServicio(blobs(1)))).not.toMatch(/vector|embedding/);
    });

    it('rellena los valores por omisión de un servicio mínimo y acepta fotos ilegibles sin calidad', async () => {
        const ilegible = { indice: 1, estado: 'ilegible', calidad: null, motivo_codigo: 'IMAGEN_INVALIDA' };
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes({
            total: 2, aceptadas: 1, minimo: 3, maximo: 8, suficiente: false, umbral_coseno: 0.35, fotos: [foto(0), ilegible],
        })));
        const r = await verificarFotosServicio(blobs(2));
        expect(r).toMatchObject({ consistente: null, ambiguo: false, advertencias: [], coseno_medio: null });
        expect(r.fotos[1]).toMatchObject({ estado: 'ilegible', calidad: null, rostros: null, motivo_rechazo: null, coseno_resto: null });
    });

    it('la respuesta debe cubrir exactamente las n fotos y en orden, o es 502 SERVICIO_RECONOCIMIENTO_ERROR', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes(conjunto([foto(0), foto(1)]))));
        await expect(verificarFotosServicio(blobs(3))).rejects.toMatchObject({ code: 'SERVICIO_RECONOCIMIENTO_ERROR', status: 502 });
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes(conjunto([foto(1), foto(0)]))));
        await expect(verificarFotosServicio(blobs(2))).rejects.toMatchObject({ code: 'SERVICIO_RECONOCIMIENTO_ERROR' });
        expect(() => validarFormaConjunto(conjunto([foto(0), foto(0)]), 2)).toThrow();
        expect(validarFormaConjunto(conjunto([foto(0), foto(1)]), 2).fotos).toHaveLength(2);
    });

    it('un estado desconocido o una forma rota es SERVICIO_RECONOCIMIENTO_ERROR', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes(conjunto([foto(0, { estado: 'rara' })]))));
        await expect(verificarFotosServicio(blobs(1))).rejects.toMatchObject({ code: 'SERVICIO_RECONOCIMIENTO_ERROR' });
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ fotos: 'no' })));
        await expect(verificarFotosServicio(blobs(1))).rejects.toMatchObject({ code: 'SERVICIO_RECONOCIMIENTO_ERROR' });
    });

    it('sin imágenes no llama al servicio; un 422 del servicio es VALIDACION; sin servicio, 503 tras un reintento', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(verificarFotosServicio([])).rejects.toMatchObject({ code: 'VALIDACION' });
        expect(fetchMock).not.toHaveBeenCalled();
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ code: 'VALIDATION_ERROR' }, 422)));
        await expect(verificarFotosServicio(blobs(2))).rejects.toMatchObject({ code: 'VALIDACION', status: 422 });
        const caido = vi.fn(async () => { throw new TypeError('fetch failed'); });
        vi.stubGlobal('fetch', caido);
        await expect(verificarFotosServicio(blobs(2))).rejects.toMatchObject({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', status: 503 });
        expect(caido).toHaveBeenCalledTimes(2);
    });
});

describe('construirIndice: forma multifoto', () => {
    const BUILD = { version: 'v004', objeto_indice: 'indice/v004.json', dimension: 512, ntotal: 1, mapeo: [{ id_plantilla: 41, faiss_id: 1043 }], errores: [] };

    it('envía {objetos_foto} tal cual y trae muestras (escalares) sin vectores', async () => {
        const fetchMock = vi.fn(async () => jsonRes({
            ...BUILD,
            muestras: [{
                id_plantilla: 41, total: 5, usadas: 4,
                descartadas: [{ indice: 2, motivo: 'inconsistente', coseno_resto: 0.21 }],
                coseno_min: 0.51, coseno_medio: 0.74, degradada: true, centroide: [0.1], vector: [0.2],
            }],
        }));
        vi.stubGlobal('fetch', fetchMock);
        const entries = [{ id_plantilla: 41, faiss_id: 1043, objetos_foto: ['registro/17/a.jpg', 'registro/17/b.jpg'] }];
        const r = await construirIndice({ version: 'v004', baseVersion: null, entries });
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).entries).toEqual(entries);
        expect(r.muestras).toEqual([{
            id_plantilla: 41, total: 5, usadas: 4,
            descartadas: [{ indice: 2, motivo: 'inconsistente', coseno_resto: 0.21 }],
            coseno_min: 0.51, coseno_medio: 0.74, degradada: true,
        }]);
        expect(JSON.stringify(r)).not.toMatch(/vector|embedding|centroide/);
    });

    it('un servicio anterior sin muestras da []; los errores conservan su codigo', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes(BUILD)));
        expect((await construirIndice({ version: 'v004', entries: [] })).muestras).toEqual([]);
        vi.stubGlobal('fetch', vi.fn(async () => jsonRes({
            ...BUILD, objeto_indice: null, mapeo: [],
            errores: [{ id_plantilla: 41, motivo: 'Ninguna de las 5 fotos es utilizable.', codigo: 'SIN_MUESTRAS_UTILIZABLES' }],
            muestras: [{ id_plantilla: 41, total: 5, usadas: 0, descartadas: [], coseno_min: null, coseno_medio: null, degradada: true }],
        })));
        const r = await construirIndice({ version: 'v004', entries: [] });
        expect(r.errores[0]).toEqual({ id_plantilla: 41, motivo: 'Ninguna de las 5 fotos es utilizable.', codigo: 'SIN_MUESTRAS_UTILIZABLES' });
        expect(r.muestras[0].coseno_medio).toBeNull();
    });
});
