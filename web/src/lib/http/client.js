// Clientes de los Route Handlers (/api/*): fetch same-origin que devuelven el JSON de éxito o lanzan ApiError.
// Pensados para el navegador (también funcionan en pruebas con fetch simulado). Sin dependencias de servidor.
import { ApiError, EVENTO_SESION_EXPIRADA } from '@/lib/api/errors';

/** Códigos por status cuando la respuesta de error no trae el cuerpo { error } (p. ej. un proxy o el CDN). */
const CODIGO_POR_STATUS = {
    400: 'PETICION_INVALIDA',
    401: 'NO_AUTENTICADO',
    403: 'NO_AUTORIZADO',
    404: 'NO_ENCONTRADO',
    413: 'LIMITE_EXCEDIDO',
    415: 'TIPO_NO_SOPORTADO',
    422: 'VALIDACION',
    429: 'DEMASIADOS_INTENTOS',
    504: 'TIEMPO_AGOTADO',
};

const MENSAJE_POR_STATUS = {
    401: 'Tu sesión expiró. Inicia sesión de nuevo.',
    403: 'No tienes permiso para realizar esta acción.',
    404: 'El recurso no existe.',
    413: 'El archivo o el cuerpo supera el tamaño permitido.',
    429: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    504: 'La operación tardó demasiado. Inténtalo de nuevo.',
};

/** Serializa query omitiendo undefined/null; los arreglos repiten la clave. */
export function armarUrl(url, query) {
    if (!query) return url;
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(query)) {
        if (valor === undefined || valor === null) continue;
        if (Array.isArray(valor)) valor.forEach((v) => params.append(clave, String(v)));
        else params.append(clave, String(valor));
    }
    const texto = params.toString();
    if (!texto) return url;
    return `${url}${url.includes('?') ? '&' : '?'}${texto}`;
}

/** Construye el ApiError de una respuesta no OK: { error: { code, message, details? } } o, si no, uno por status. */
async function errorDeRespuesta(respuesta) {
    let cuerpo = null;
    try {
        cuerpo = await respuesta.json();
    } catch {
        cuerpo = null;
    }
    const e = cuerpo?.error;
    if (e && typeof e.code === 'string') {
        return new ApiError({
            code: e.code,
            message: typeof e.message === 'string' ? e.message : 'Ocurrió un error inesperado.',
            status: respuesta.status,
            details: e.details ?? null,
        });
    }
    return new ApiError({
        code: CODIGO_POR_STATUS[respuesta.status] ?? 'ERROR_INTERNO',
        message: MENSAJE_POR_STATUS[respuesta.status] ?? 'Ocurrió un error inesperado. Inténtalo de nuevo.',
        status: respuesta.status,
    });
}

const errorDeRed = () => new ApiError({
    code: 'ERROR_RED',
    message: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    status: 503,
});

/**
 * Núcleo. `body` puede ser un objeto (se envía como JSON), FormData (multipart; el navegador fija el boundary)
 * o undefined.
 * @param {string} method
 * @param {string} url
 * @param {{ body?: any, query?: object, headers?: object, signal?: AbortSignal }} [opts]
 * @returns {Promise<any>} JSON de éxito (null si 204)
 * @throws {ApiError}
 */
export async function requestJSON(method, url, { body, query, headers = {}, signal } = {}) {
    const init = {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', ...headers },
        signal,
    };
    if (body !== undefined) {
        if (typeof FormData !== 'undefined' && body instanceof FormData) {
            init.body = body;
        } else {
            init.body = JSON.stringify(body);
            init.headers['Content-Type'] = 'application/json';
        }
    }
    let respuesta;
    try {
        respuesta = await fetch(armarUrl(url, query), init);
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        throw errorDeRed();
    }
    if (!respuesta.ok) {
        const apiError = await errorDeRespuesta(respuesta);
        if (respuesta.status === 401 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA));
        }
        throw apiError;
    }
    if (respuesta.status === 204) return null;
    try {
        return await respuesta.json();
    } catch {
        throw new ApiError({ code: 'ERROR_INTERNO', message: 'La respuesta del servidor no es válida.', status: respuesta.status });
    }
}

export const getJSON = (url, { query, signal } = {}) => requestJSON('GET', url, { query, signal });
export const postJSON = (url, body, { query, signal } = {}) => requestJSON('POST', url, { body: body ?? {}, query, signal });
export const putJSON = (url, body, { query, signal } = {}) => requestJSON('PUT', url, { body, query, signal });
export const patchJSON = (url, body, { query, signal } = {}) => requestJSON('PATCH', url, { body, query, signal });
export const deleteJSON = (url, { query, signal } = {}) => requestJSON('DELETE', url, { query, signal });
export const postForm = (url, formData, { query, signal } = {}) => requestJSON('POST', url, { body: formData, query, signal });
