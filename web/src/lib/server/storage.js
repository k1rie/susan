// Almacenamiento de objetos del bucket privado (service_role). Solo servidor.
// Reglas: rutas SIEMPRE construidas aquí (nunca del cliente), tipo de archivo por firma binaria, URL firmadas
// con vigencia <= 300 s (RNF-04) y sin escribir rutas ni URL en logs.
import { randomUUID } from 'node:crypto';
import { ApiError } from '@/lib/api/errors';
import { callRpc } from '@/lib/api/client';
import { BUCKET } from '@/config';
import { getAdminBackend } from '@/lib/backend';

export const MAX_URL_SEGUNDOS = 300; // RNF-04: tope duro, independiente del parámetro
export const MAX_ARCHIVO_BYTES = 5 * 1024 * 1024; // 5 MiB: justificantes y fotos de plantilla
export const MAX_CONSENTIMIENTO_BYTES = 10 * 1024 * 1024; // el PDF firmado escaneado puede pesar más (UI: 10 MB)

// Plantilla facial de varias fotos. El techo de fotos lo comparten SQL (plantilla_foto.orden 1..8), el servicio de
// reconocimiento (TEMPLATE_MAX_PHOTOS <= 8) y esta capa; el mínimo no vive aquí: lo informa el servicio.
export const MAX_FOTOS_PLANTILLA = 8;
// El proxy de Next buferiza como máximo 10 MB por petición y TRUNCA en silencio lo que pase de ahí (el multipart
// llegaría roto). 9 MiB de fotos + el margen del multipart quedan siempre por debajo; un cuerpo mayor da 413 limpio.
export const MAX_PLANTILLA_BYTES_TOTAL = 9 * 1024 * 1024;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Patrones válidos de ruta por prefijo. El recorte admite {id_camara}-{epochMs} (ver captura/route.js). */
const PATRONES_RUTA = {
    registro: new RegExp(`^registro/\\d+/${UUID}\\.jpg$`),
    consentimientos: new RegExp(`^consentimientos/\\d+/${UUID}\\.pdf$`),
    justificantes: new RegExp(`^justificantes/\\d+/${UUID}\\.(pdf|jpg|png)$`),
    recortes: /^recortes\/\d+\/\d+(-\d+)?\/\d+\.jpg$/,
    indice: /^indice\/[A-Za-z0-9._-]+\.json$/,
};

/** Constructores de rutas relativas al bucket (la BD guarda solo estas rutas). */
export const rutaObjeto = {
    registro: (idAlumno) => `registro/${idAlumno}/${randomUUID()}.jpg`,
    consentimiento: (idAlumno) => `consentimientos/${idAlumno}/${randomUUID()}.pdf`,
    justificante: (idAlumno, ext) => {
        if (!['pdf', 'jpg', 'png'].includes(ext)) {
            throw new ApiError({ code: 'ARCHIVO_INVALIDO', message: 'Extensión no permitida.', status: 422 });
        }
        return `justificantes/${idAlumno}/${randomUUID()}.${ext}`;
    },
    indice: (version) => `indice/${version}.json`,
};

/**
 * Prefijo de recortes que se entrega al servicio de reconocimiento. Se necesita ANTES de conocer el
 * id_captura (el servicio sube los recortes durante /v1/recognize), de ahí {id_camara}-{epochMs}: es único
 * por fotograma y estable ante un reintento con la misma marca de tiempo (sobrescribe los mismos objetos).
 */
export function prefijoRecortes(idSesion, idCamara, epochMs) {
    return `recortes/${idSesion}/${idCamara}-${epochMs}/`;
}

/**
 * Rechaza (VALIDACION) rutas vacías, absolutas, con '..', '\\', '//' o que no coincidan con los patrones.
 * @param {string} ruta
 * @param {string[]} [prefijos]
 * @returns {string}
 */
export function validarRutaObjeto(ruta, prefijos = Object.keys(PATRONES_RUTA)) {
    const invalida = () => new ApiError({ code: 'VALIDACION', message: 'La ruta del objeto no es válida.', status: 422 });
    if (typeof ruta !== 'string' || !ruta || ruta.length > 255) throw invalida();
    if (ruta.startsWith('/') || ruta.includes('\\') || ruta.includes('//') || ruta.split('/').includes('..')) throw invalida();
    const prefijo = ruta.split('/')[0];
    if (!prefijos.includes(prefijo) || !PATRONES_RUTA[prefijo]?.test(ruta)) throw invalida();
    return ruta;
}

// ---------------------------------------------------------------------------------------------------------
// Vigencia de las URL firmadas
// ---------------------------------------------------------------------------------------------------------

let cacheVigencia = { valor: null, expira: 0 };

/** Solo para pruebas. */
export function reiniciarCacheVigencia() {
    cacheVigencia = { valor: null, expira: 0 };
}

/** Parámetro vigencia_url_firmada_seg con caché de 60 s (se lee con la identidad del usuario). */
async function vigenciaParametro(backend) {
    const ahora = Date.now();
    if (cacheVigencia.valor !== null && ahora < cacheVigencia.expira) return cacheVigencia.valor;
    const parametros = await callRpc('api_parametros_publicos', {}, { backend });
    const v = Number(parametros?.vigencia_url_firmada_seg);
    const valor = Number.isFinite(v) && v > 0 ? v : MAX_URL_SEGUNDOS;
    cacheVigencia = { valor, expira: ahora + 60_000 };
    return valor;
}

/**
 * Segundos efectivos = max(1, min(solicitado ?? vigencia, vigencia, 300)).
 * `vigencia` es el valor que la propia RPC de autorización ya devolvió (vigencia_url_firmada_seg o
 * vigencia_seg); si no se conoce se lee el parámetro. Cualquier valor no numérico cae al tope de 300.
 * @param {number | null | undefined} solicitado
 * @param {{ backend?: object, vigencia?: number | null }} [opts]
 * @returns {Promise<number>}
 */
export async function segundosEfectivos(solicitado, { backend, vigencia } = {}) {
    let tope = Number(vigencia);
    if (!Number.isFinite(tope) || tope <= 0) tope = backend ? await vigenciaParametro(backend) : MAX_URL_SEGUNDOS;
    const pedido = Number.isFinite(Number(solicitado)) && Number(solicitado) > 0 ? Number(solicitado) : tope;
    return Math.max(1, Math.floor(Math.min(pedido, tope, MAX_URL_SEGUNDOS)));
}

/** Variante síncrona para cuando la RPC ya trajo la vigencia. */
export function ttlUrlFirmada(vigencia) {
    const v = Number(vigencia);
    const base = Number.isFinite(v) && v > 0 ? v : MAX_URL_SEGUNDOS;
    return Math.max(1, Math.floor(Math.min(base, MAX_URL_SEGUNDOS)));
}

async function adminDe(opts) {
    return opts?.admin ?? getAdminBackend();
}

/**
 * URL firmada de un objeto del bucket privado. NO asienta bitácora: el llamador debe haber autorizado el
 * acceso y registrado la consulta ANTES (RF-19).
 * @returns {Promise<{ url: string, expira_en: string, segundos: number }>}
 * @throws {ApiError} VALIDACION | ALMACENAMIENTO_NO_DISPONIBLE
 */
export async function urlFirmada(ruta, { segundos, admin, backend, vigencia } = {}) {
    validarRutaObjeto(ruta);
    const ttl = await segundosEfectivos(segundos, { backend, vigencia });
    let resultado;
    try {
        const cliente = await adminDe({ admin });
        resultado = await cliente.storage.from(BUCKET).createSignedUrl(ruta, ttl);
    } catch {
        resultado = null;
    }
    const url = resultado?.data?.signedUrl;
    if (resultado?.error || !url) {
        throw new ApiError({
            code: 'ALMACENAMIENTO_NO_DISPONIBLE',
            message: 'No se pudo generar el enlace del archivo. Inténtalo de nuevo.',
            status: 502,
        });
    }
    return { url, expira_en: new Date(Date.now() + ttl * 1000).toISOString(), segundos: ttl };
}

/**
 * Varias rutas con el mismo TTL; la que falle sale con url: null (no tumba todo el lote).
 * @returns {Promise<{ ruta: string, url: string | null, expira_en: string | null }[]>}
 */
export async function urlsFirmadas(rutas, opts = {}) {
    const ttl = await segundosEfectivos(opts.segundos, opts);
    return Promise.all(rutas.map(async (ruta) => {
        try {
            const f = await urlFirmada(ruta, { ...opts, segundos: ttl, vigencia: ttl });
            return { ruta, url: f.url, expira_en: f.expira_en };
        } catch {
            return { ruta, url: null, expira_en: null };
        }
    }));
}

// ---------------------------------------------------------------------------------------------------------
// Subida y borrado
// ---------------------------------------------------------------------------------------------------------

/** Sube con service_role. upsert=false: nunca sobrescribe en silencio. */
export async function subirObjeto(ruta, cuerpo, { contentType, upsert = false, admin } = {}) {
    validarRutaObjeto(ruta);
    let error = null;
    try {
        const cliente = await adminDe({ admin });
        ({ error } = await cliente.storage.from(BUCKET).upload(ruta, cuerpo, { contentType, upsert }));
    } catch (e) {
        error = e ?? new Error('fallo');
    }
    if (error) {
        console.error('[storage] fallo la subida de un objeto'); // sin ruta: puede incluir el id del alumno
        throw new ApiError({
            code: 'ALMACENAMIENTO_NO_DISPONIBLE',
            message: 'No se pudo guardar el archivo. Inténtalo de nuevo.',
            status: 502,
        });
    }
    return ruta;
}

/** Borra objetos (compensaciones, purga de recortes). Un objeto ausente no es error. */
export async function eliminarObjetos(rutas, { admin } = {}) {
    if (!rutas?.length) return;
    let error = null;
    try {
        const cliente = await adminDe({ admin });
        ({ error } = await cliente.storage.from(BUCKET).remove(rutas));
    } catch (e) {
        error = e ?? new Error('fallo');
    }
    if (error) {
        throw new ApiError({
            code: 'ALMACENAMIENTO_NO_DISPONIBLE',
            message: 'No se pudieron borrar los archivos.',
            status: 502,
        });
    }
}

/** Borrado de compensación: nunca lanza (el error original es el que importa). */
export async function eliminarObjetoSilencioso(ruta, opts) {
    try {
        await eliminarObjetos([ruta], opts);
    } catch {
        console.error('[storage] no se pudo borrar un objeto huérfano tras un fallo');
    }
}

// ---------------------------------------------------------------------------------------------------------
// Validación de archivos subidos
// ---------------------------------------------------------------------------------------------------------

export const TIPOS_ARCHIVO = {
    pdf: { mime: 'application/pdf', ext: 'pdf' },
    jpg: { mime: 'image/jpeg', ext: 'jpg' },
    png: { mime: 'image/png', ext: 'png' },
};

/** 'image/jpg' no es estándar pero algunos clientes lo envían. */
function tipoDeMime(mime) {
    const m = String(mime ?? '').toLowerCase().split(';')[0].trim();
    if (m === 'image/jpg') return 'jpg';
    return Object.keys(TIPOS_ARCHIVO).find((k) => TIPOS_ARCHIVO[k].mime === m) ?? null;
}

/**
 * Tipo real por firma binaria: %PDF- | FF D8 FF | 89 50 4E 47 0D 0A 1A 0A.
 * @param {Uint8Array} bytes
 * @returns {'pdf' | 'jpg' | 'png' | null}
 */
export function detectarTipo(bytes) {
    if (!bytes || bytes.length < 4) return null;
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return 'pdf';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return 'png';
    return null;
}

/**
 * Valida un archivo recibido (File/Blob): tamaño, tipo declarado y firma binaria. La extensión sale del tipo
 * DETECTADO, nunca del nombre del archivo.
 * @param {Blob} archivo
 * @param {{ permitidos?: ('pdf'|'jpg'|'png')[], maxBytes?: number }} [opts]
 * @returns {Promise<{ bytes: Buffer, tipo: string, ext: string, contentType: string, size: number }>}
 */
export async function leerArchivoValidado(archivo, { permitidos = ['pdf', 'jpg', 'png'], maxBytes = MAX_ARCHIVO_BYTES } = {}) {
    if (!archivo || typeof archivo.arrayBuffer !== 'function') {
        throw new ApiError({ code: 'VALIDACION', message: 'Falta el archivo.', status: 422 });
    }
    if (archivo.size < 1) {
        throw new ApiError({ code: 'VALIDACION', message: 'El archivo está vacío.', status: 422 });
    }
    if (archivo.size > maxBytes) {
        throw new ApiError({
            code: 'ARCHIVO_DEMASIADO_GRANDE',
            message: `El archivo supera el máximo de ${Math.floor(maxBytes / (1024 * 1024))} MB.`,
            status: 413,
        });
    }
    const declarado = tipoDeMime(archivo.type);
    if (!declarado || !permitidos.includes(declarado)) {
        throw new ApiError({
            code: 'TIPO_NO_PERMITIDO',
            message: `Tipo de archivo no permitido. Usa: ${permitidos.map((p) => p.toUpperCase()).join(', ')}.`,
            status: 415,
        });
    }
    const bytes = Buffer.from(await archivo.arrayBuffer());
    // Se comprueba otra vez con los bytes reales: `size` lo declara el multipart, esto es lo recibido.
    if (bytes.length > maxBytes) {
        throw new ApiError({ code: 'ARCHIVO_DEMASIADO_GRANDE', message: 'El archivo supera el tamaño permitido.', status: 413 });
    }
    const real = detectarTipo(bytes);
    if (real !== declarado) {
        throw new ApiError({
            code: 'ARCHIVO_INVALIDO',
            message: 'El contenido del archivo no corresponde a su tipo.',
            status: 422,
        });
    }
    return { bytes, tipo: real, ext: TIPOS_ARCHIVO[real].ext, contentType: TIPOS_ARCHIVO[real].mime, size: bytes.length };
}

/** Extensión (pdf|jpg|png) de una ruta de objeto; null si no la tiene. */
export function tipoDeRuta(ruta) {
    const m = String(ruta ?? '').match(/\.(pdf|jpg|png)$/);
    return m ? m[1] : null;
}
