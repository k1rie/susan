import { ApiError, EVENTO_SESION_EXPIRADA, fromRpcError } from './errors.js';

export const PAGINA_DEFECTO = 50;
export const PAGINA_MAXIMA = 200;

const NOMBRE_RPC = /^(api|svc)_[a-z0-9_]+$/;

/** Valida que el nombre sea de una función de negocio (api_* o svc_*); evita llamar a funciones arbitrarias. */
export function rpcName(nombre) {
    if (typeof nombre !== 'string' || !NOMBRE_RPC.test(nombre)) {
        throw new ApiError({ code: 'ERROR_INTERNO', message: 'Nombre de función no válido.', status: 500 });
    }
    return nombre;
}

/** idSesion -> p_id_sesion. `p` (parámetro jsonb de los *_guardar) y los que ya traen `p_` no cambian. */
function nombreDeArgumento(clave) {
    if (clave === 'p' || clave.startsWith('p_')) return clave;
    // `datos` es el alias legible del parámetro jsonb `p` (alumnoGuardar({ datos: {...} })).
    if (clave === 'datos') return 'p';
    return `p_${clave.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`;
}

/**
 * { idSesion: 3, limit: 20, ignorado: undefined } -> { p_id_sesion: 3, p_limit: 20 }.
 * `undefined` se omite para que aplique el DEFAULT de SQL; `null` se conserva (es un valor). Los Date se
 * envían como ISO 8601; arreglos y objetos (jsonb, integer[]) pasan tal cual, sin tocar sus llaves.
 * @param {Record<string, any>} [args]
 * @returns {Record<string, any>}
 */
export function toRpcArgs(args = {}) {
    const salida = {};
    for (const [clave, valor] of Object.entries(args ?? {})) {
        if (valor === undefined) continue;
        salida[nombreDeArgumento(clave)] = valor instanceof Date ? valor.toISOString() : valor;
    }
    return salida;
}

/**
 * Backend a usar: el inyectado (servidor: getServerBackend()/getAdminBackend()) o, en el navegador, el
 * singleton de cliente. La importación es perezosa para que un módulo de servidor no entre al paquete del
 * cliente por esta ruta.
 * @param {{ backend?: object }} [opts]
 */
export async function resolverBackend(opts = {}) {
    if (opts?.backend) return opts.backend;
    if (typeof window === 'undefined') {
        throw new ApiError({
            code: 'ERROR_INTERNO',
            message: 'En el servidor hay que indicar el backend (getServerBackend).',
            status: 500,
        });
    }
    const { getBrowserBackend } = await import('@/lib/backend');
    return getBrowserBackend();
}

/**
 * Llama a una RPC y devuelve `data` o lanza ApiError.
 * @param {string} nombre nombre SQL ('api_yo', 'svc_crear_captura')
 * @param {Record<string, any>} [args] argumentos camelCase sin 'p_'
 * @param {{ backend?: object }} [opts] backend tipo supabase-js; si falta se usa el del navegador
 * @returns {Promise<any>} data (null si la función devuelve NULL)
 * @throws {ApiError}
 */
export async function callRpc(nombre, args = {}, { backend } = {}) {
    rpcName(nombre);
    let resultado;
    try {
        const destino = await resolverBackend({ backend });
        resultado = await destino.rpc(nombre, toRpcArgs(args));
    } catch (e) {
        throw fromRpcError(e);
    }
    const { data = null, error = null } = resultado ?? {};
    if (error) {
        const apiError = fromRpcError(error);
        if (apiError.code === 'NO_AUTENTICADO' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA));
        }
        throw apiError;
    }
    return data;
}
