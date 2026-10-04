// Cliente tipado del servicio de reconocimiento (FastAPI + FAISS). Solo servidor.
// - Autentica con X-API-Key (clave solo en servidor), con timeout y reintentos acotados.
// - NUNCA propaga un campo vector/embedding aunque el servicio lo enviara (RNF-03).
// - Traduce los errores del servicio a ApiError tipados; no reenvía sus mensajes crudos.
import * as z from 'zod';
import { ApiError } from '@/lib/api/errors';
import { serverEnv } from '@/config';

const PAUSA_REINTENTO_MS = 150;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function error(code, message, status, details = null) {
    return new ApiError({ code, message, status, details });
}

/** Elimina recursivamente cualquier clave que parezca un vector o embedding. */
export function sinVectores(valor) {
    if (Array.isArray(valor)) return valor.map(sinVectores);
    if (valor && typeof valor === 'object') {
        const salida = {};
        for (const [k, v] of Object.entries(valor)) {
            if (/vector|embedding/i.test(k)) continue;
            salida[k] = sinVectores(v);
        }
        return salida;
    }
    return valor;
}

/** Traduce {status, cuerpo del servicio} a ApiError. El mensaje del servicio no se reenvía (puede nombrar IP internas). */
function errorDeServicio(status, cuerpo) {
    const codigoServicio = typeof cuerpo?.code === 'string' ? cuerpo.code : null;
    const detalle = codigoServicio ? { servicio: codigoServicio } : null;
    if (status === 401) {
        return error('SERVICIO_RECONOCIMIENTO_NO_AUTORIZADO',
            'El servidor no pudo autenticarse con el servicio de reconocimiento.', 502);
    }
    if (status === 409 && codigoServicio === 'INDEX_NOT_LOADED') {
        return error('INDEX_NOT_LOADED', 'El índice facial aún no está cargado.', 409, detalle);
    }
    if (status === 409 && codigoServicio === 'VERSION_IN_USE') {
        return error('INDICE_VERSION_EN_USO', 'Esa versión del índice está en uso y no se puede reconstruir.', 409, detalle);
    }
    if (status === 409 && codigoServicio === 'MANIFEST_SIN_REFS') {
        return error('INDICE_SIN_MANIFIESTO', 'Esa versión del índice no incluye el mapeo de plantillas.', 409, detalle);
    }
    if (status === 404 && codigoServicio === 'INDEX_NOT_FOUND') {
        return error('INDICE_NO_ENCONTRADO', 'La versión del índice no existe en el almacenamiento.', 404, detalle);
    }
    if (status === 422) {
        if (codigoServicio === 'CAMERA_URL_BLOCKED') {
            return error('CAMARA_URL_BLOQUEADA', 'La dirección de la cámara no está permitida.', 422, detalle);
        }
        if (codigoServicio === 'INDEX_INVALID') {
            return error('INDICE_INVALIDO', 'El archivo del índice facial no es válido.', 422, detalle);
        }
        if (codigoServicio === 'VALIDATION_ERROR') {
            return error('VALIDACION', 'La solicitud al servicio de reconocimiento no es válida.', 422, detalle);
        }
        return error('IMAGEN_INVALIDA', 'La imagen no es válida.', 422, detalle);
    }
    if (status === 504) {
        return error('CAMARA_INALCANZABLE', 'No se pudo obtener imagen de la cámara.', 504, detalle);
    }
    if (status === 502 && codigoServicio === 'STORAGE_ERROR') {
        return error('ALMACENAMIENTO_NO_DISPONIBLE', 'El servicio de reconocimiento no pudo usar el almacenamiento.', 502, detalle);
    }
    return error('SERVICIO_RECONOCIMIENTO_ERROR', 'El servicio de reconocimiento devolvió un error.', 502, detalle);
}

const noDisponible = () => error('SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', 'El servicio de reconocimiento no está disponible.', 503);

/**
 * Fetch con X-API-Key y timeout. Reintenta (acotado) solo fallos de transporte y 502/503, nunca 4xx ni 504
 * (una cámara inalcanzable volvería a esperar su timeout).
 * @param {string} path p. ej. '/v1/recognize'
 * @param {{ method?: string, headers?: object, body?: any, timeoutMs?: number, reintentos?: number }} [init]
 * @returns {Promise<Response>} respuesta 2xx
 * @throws {ApiError}
 */
export async function recognitionFetch(path, { method = 'GET', headers = {}, body, timeoutMs = 10_000, reintentos = 0 } = {}) {
    const { recognitionUrl, recognitionApiKey } = serverEnv();
    if (!recognitionApiKey) {
        throw error('CONFIGURACION_FALTANTE', 'El servicio de reconocimiento no está configurado.', 503);
    }
    let ultimo = noDisponible();
    for (let intento = 0; intento <= reintentos; intento += 1) {
        if (intento > 0) await esperar(PAUSA_REINTENTO_MS * intento);
        let respuesta;
        try {
            respuesta = await fetch(`${recognitionUrl}${path}`, {
                method,
                headers: { 'X-API-Key': recognitionApiKey, Accept: 'application/json', ...headers },
                body,
                signal: AbortSignal.timeout(timeoutMs),
                cache: 'no-store',
            });
        } catch {
            ultimo = noDisponible(); // conexión rechazada, DNS o timeout
            continue;
        }
        if (respuesta.ok) return respuesta;
        let cuerpo = null;
        try {
            cuerpo = await respuesta.json();
        } catch {
            cuerpo = null;
        }
        ultimo = errorDeServicio(respuesta.status, cuerpo);
        const transitorio = respuesta.status === 503
            || (respuesta.status === 502 && ultimo.code === 'SERVICIO_RECONOCIMIENTO_ERROR');
        if (!transitorio) throw ultimo;
        if (respuesta.status === 503) ultimo = noDisponible();
    }
    throw ultimo;
}

/** Lee el JSON de una respuesta OK, quita vectores y valida la forma con zod. */
async function leerJson(respuesta, esquema) {
    let datos;
    try {
        datos = sinVectores(await respuesta.json());
    } catch {
        throw error('SERVICIO_RECONOCIMIENTO_ERROR', 'El servicio de reconocimiento devolvió una respuesta ilegible.', 502);
    }
    const r = esquema.safeParse(datos);
    if (!r.success) {
        throw error('SERVICIO_RECONOCIMIENTO_ERROR', 'El servicio de reconocimiento devolvió una respuesta inesperada.', 502);
    }
    return r.data;
}

// ---- Esquemas de respuesta (z.object descarta las claves no declaradas) ----
const esquemaRostro = z.object({
    bbox: z.array(z.number()).length(4),
    det_score: z.number(),
    candidate: z.object({ faiss_id: z.number().int(), score: z.number() }).nullable().optional().transform((v) => v ?? null),
    objeto_recorte: z.string().nullable().optional().transform((v) => v ?? null),
});
const esquemaReconocer = z.object({
    index_version: z.string().nullable().optional().transform((v) => v ?? null),
    elapsed_ms: z.number().optional().transform((v) => v ?? 0),
    image: z.object({ width: z.number(), height: z.number() }),
    faces: z.array(esquemaRostro),
});
const esquemaMedidasCalidad = z.object({
    brillo: z.number(),
    nitidez: z.number(),
    tamano_rostro_px: z.number(),
    frontal: z.boolean(),
});
// `motivo_rechazo` es la frase del servicio (puede cambiar); `motivo_codigo` es el identificador estable que usa
// la pantalla para decidir el texto. Un servicio anterior a esta mejora no lo manda: queda en null.
const motivoCodigo = z.string().nullable().optional().transform((v) => v ?? null);
const esquemaCalidadFoto = z.object({
    rostros: z.number().int(),
    un_solo_rostro: z.boolean(),
    calidad: esquemaMedidasCalidad,
    motivo_rechazo: z.string().nullable(),
    motivo_codigo: motivoCodigo,
});
const numeroONulo = z.number().nullable().optional().transform((v) => v ?? null);
// /v1/photo/check-set: estado por foto y consistencia entre fotos. NUNCA trae vectores (RNF-03; sinVectores lo asegura).
export const ESTADOS_FOTO_CONJUNTO = ['aceptada', 'calidad', 'inconsistente', 'ilegible'];
const esquemaConjunto = z.object({
    total: z.number().int(),
    aceptadas: z.number().int(),
    minimo: z.number().int(),
    maximo: z.number().int(),
    suficiente: z.boolean(),
    consistente: z.boolean().nullable().optional().transform((v) => v ?? null),
    ambiguo: z.boolean().optional().transform((v) => v ?? false),
    umbral_coseno: z.number(),
    coseno_min: numeroONulo,
    coseno_medio: numeroONulo,
    coseno_max_par: numeroONulo,
    advertencias: z.array(z.string()).optional().transform((v) => v ?? []),
    fotos: z.array(z.object({
        indice: z.number().int(),
        estado: z.enum(ESTADOS_FOTO_CONJUNTO),
        rostros: z.number().int().nullable().optional().transform((v) => v ?? null),
        un_solo_rostro: z.boolean().nullable().optional().transform((v) => v ?? null),
        calidad: esquemaMedidasCalidad.nullable().optional().transform((v) => v ?? null),
        motivo_rechazo: z.string().nullable().optional().transform((v) => v ?? null),
        motivo_codigo: motivoCodigo,
        coseno_resto: numeroONulo,
    })),
});
const esquemaBuild = z.object({
    version: z.string(),
    objeto_indice: z.string().nullable(),
    dimension: z.number().int(),
    ntotal: z.number().int(),
    mapeo: z.array(z.object({ id_plantilla: z.number().int(), faiss_id: z.number().int() })),
    errores: z.array(z.object({
        id_plantilla: z.number().int(),
        motivo: z.string(),
        codigo: z.string().optional(), // p. ej. SIN_MUESTRAS_UTILIZABLES
    })),
    // Resumen escalar por plantilla de varias fotos (cuántas se usaron, cuáles se descartaron y su coseno). Sin vectores.
    muestras: z.array(z.object({
        id_plantilla: z.number().int(),
        total: z.number().int(),
        usadas: z.number().int(),
        descartadas: z.array(z.object({
            indice: z.number().int(),
            motivo: z.string(),
            coseno_resto: numeroONulo,
        })),
        coseno_min: numeroONulo,
        coseno_medio: numeroONulo,
        degradada: z.boolean(),
    })).optional().transform((v) => v ?? []),
});
const esquemaInfoIndice = z.object({
    version: z.string().nullable(),
    ntotal: z.number().int(),
    dimension: z.number().int(),
    model: z.string().nullable().optional().transform((v) => v ?? null),
    loaded_at: z.string().nullable().optional().transform((v) => v ?? null),
});
const esquemaActivar = esquemaInfoIndice.extend({
    active: z.boolean(),
    preloaded: z.boolean(),
    previous_version: z.string().nullable().optional().transform((v) => v ?? null),
});
const esquemaManifiesto = z.object({
    version: z.string(),
    ntotal: z.number().int(),
    dimension: z.number().int(),
    refs: z.array(z.object({ id_plantilla: z.number().int(), faiss_id: z.number().int() })),
});

const bytesDeImagen = (imagen, nombre) => {
    if (!imagen || typeof imagen.arrayBuffer !== 'function') {
        throw error('VALIDACION', 'Falta la imagen.', 422);
    }
    return [imagen, nombre];
};

/**
 * POST /v1/recognize. Exactamente uno de `imagen` (Blob) o `cameraUrl`.
 * @param {{ imagen?: Blob, cameraUrl?: string, allowedFaissIds: number[], cropPrefix?: string,
 *           maxFaces?: number, timeoutMs?: number }} p
 */
export async function reconocer({ imagen, cameraUrl, allowedFaissIds, cropPrefix, maxFaces = 60, timeoutMs = 15_000 }) {
    if (Boolean(imagen) === Boolean(cameraUrl)) {
        throw error('VALIDACION', 'Envía exactamente una imagen o una dirección de cámara.', 422);
    }
    if (!Array.isArray(allowedFaissIds) || !allowedFaissIds.every((i) => Number.isInteger(i) && i >= 0)) {
        throw error('VALIDACION', 'Los candidatos del reconocimiento no son válidos.', 422);
    }
    if (cropPrefix !== undefined && cropPrefix !== null && !/^recortes\/[\w-]+(\/[\w-]+)*\/$/.test(cropPrefix)) {
        throw error('VALIDACION', 'El prefijo de recortes no es válido.', 422);
    }
    const form = new FormData();
    if (imagen) {
        const [blob] = bytesDeImagen(imagen);
        form.append('image', blob, 'frame.jpg');
    } else {
        let url;
        try {
            url = new URL(cameraUrl);
        } catch {
            throw error('VALIDACION', 'La dirección de la cámara no es válida.', 422);
        }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
            throw error('VALIDACION', 'La dirección de la cámara no es válida.', 422);
        }
        form.append('camera_url', cameraUrl);
    }
    form.append('allowed_faiss_ids', JSON.stringify(allowedFaissIds));
    if (cropPrefix) form.append('crop_prefix', cropPrefix);
    form.append('max_faces', String(maxFaces));
    const r = await recognitionFetch('/v1/recognize', { method: 'POST', body: form, timeoutMs, reintentos: 1 });
    return leerJson(r, esquemaReconocer);
}

/** POST /v1/photo/check: calidad de la foto de plantilla. */
export async function verificarFotoServicio(imagen) {
    const form = new FormData();
    form.append('image', bytesDeImagen(imagen)[0], 'foto.jpg');
    const r = await recognitionFetch('/v1/photo/check', { method: 'POST', body: form, timeoutMs: 20_000, reintentos: 1 });
    return leerJson(r, esquemaCalidadFoto);
}

/**
 * La respuesta de /check-set debe cubrir EXACTAMENTE las n fotos enviadas y en orden: la pantalla y el alta aplican
 * cada resultado por posición, así que un servicio que omita, repita o desordene fotos no puede pasar inadvertido
 * (se descartaría la foto equivocada o se subiría una sin verificar).
 * @throws {ApiError} 502 SERVICIO_RECONOCIMIENTO_ERROR
 */
export function validarFormaConjunto(conjunto, n) {
    const ok = Array.isArray(conjunto?.fotos)
        && conjunto.fotos.length === n
        && conjunto.fotos.every((f, i) => f?.indice === i);
    if (!ok) {
        throw error('SERVICIO_RECONOCIMIENTO_ERROR', 'El servicio de reconocimiento devolvió una respuesta inesperada.', 502);
    }
    return conjunto;
}

/**
 * POST /v1/photo/check-set: calidad de cada toma y consistencia de identidad entre ellas (1 a 8 fotos).
 * No guarda nada ni devuelve vectores. Hasta 8 fotos de ~300 KB: 30 s de margen, un reintento ante 502/503.
 * @param {Blob[]} imagenes
 */
export async function verificarFotosServicio(imagenes) {
    if (!Array.isArray(imagenes) || imagenes.length === 0) throw error('VALIDACION', 'Falta la imagen.', 422);
    const form = new FormData();
    imagenes.forEach((imagen, i) => form.append('images', bytesDeImagen(imagen)[0], `foto-${i + 1}.jpg`));
    const r = await recognitionFetch('/v1/photo/check-set', { method: 'POST', body: form, timeoutMs: 30_000, reintentos: 1 });
    return validarFormaConjunto(await leerJson(r, esquemaConjunto), imagenes.length);
}

/**
 * POST /v1/index/build. `entries`: [{ id_plantilla, faiss_id, keep: true } | { id_plantilla, faiss_id, objeto_foto }
 * | { id_plantilla, faiss_id, objetos_foto: [2 a 8 rutas] }] (la tercera forma promedia las fotos en un centroide).
 */
export async function construirIndice({ version, baseVersion = null, entries }) {
    const r = await recognitionFetch('/v1/index/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, base_version: baseVersion, entries }),
        timeoutMs: 300_000, // vectorizar fotos nuevas puede tardar; el bloqueo de BD dura 20 min
    });
    return leerJson(r, esquemaBuild);
}

/** POST /v1/index/activate (preload_only=true solo precarga sin cambiar el puntero). */
export async function activarIndice({ version, preloadOnly = false }) {
    const r = await recognitionFetch('/v1/index/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, preload_only: preloadOnly }),
        timeoutMs: 120_000,
        reintentos: 1, // activar es idempotente
    });
    return leerJson(r, esquemaActivar);
}

/** GET /v1/index: versión cargada en memoria del servicio. */
export async function infoIndice() {
    return leerJson(await recognitionFetch('/v1/index', { reintentos: 1, timeoutMs: 5_000 }), esquemaInfoIndice);
}

/** GET /v1/index/{version}/manifest: `refs` = mapeo para svc_indice_revertir. */
export async function manifiestoIndice(version) {
    if (!/^[A-Za-z0-9._-]{1,12}$/.test(String(version))) throw error('VALIDACION', 'La versión del índice no es válida.', 422);
    return leerJson(await recognitionFetch(`/v1/index/${version}/manifest`, { reintentos: 1, timeoutMs: 30_000 }), esquemaManifiesto);
}

/** Nombres cortos del contrato de unión con el resto del núcleo. */
export const recognition = {
    recognize: reconocer,
    photoCheck: verificarFotoServicio,
    photoCheckSet: verificarFotosServicio,
    indexBuild: construirIndice,
    indexActivate: activarIndice,
    indexInfo: infoIndice,
    manifest: manifiestoIndice,
};
