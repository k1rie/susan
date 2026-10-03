// Utilidades comunes de los handlers de /api/_local/*. Estos handlers viven en la carpeta
// PRIVADA `_local` (Next no la enruta); las rutas reales estan en `api/%5Flocal/**` (el prefijo
// %5F es la forma de Next de tener un segmento de URL que empieza con guion bajo) y solo
// delegan aqui. Asi las pruebas y la logica quedan junto a la zona "_local" del contrato.
import { NextResponse } from 'next/server';
import { IS_LOCAL } from '@/config';
import { obtenerUsuarioPorId } from '@/lib/local/auth.js';
import { COOKIE_SESION, verificarTokenSesion } from '@/lib/local/session.js';

const MAX_JSON_BYTES = 5 * 1024 * 1024;

export const json = (cuerpo, status = 200, init = {}) => NextResponse.json(cuerpo, { status, ...init });

export const errorHttp = (message, code, status, hint = null) =>
    json({ data: null, error: { message, code, details: null, hint } }, status);

/**
 * Las rutas locales NO existen fuera del desarrollo local: 404 si falta SUSAN_LOCAL=1 o si
 * NODE_ENV es 'production' (aunque alguien deje la variable puesta). Devuelve Response o null.
 */
export function soloLocal() {
    if (!IS_LOCAL || process.env.NODE_ENV === 'production') {
        return json({ error: { code: 'NO_ENCONTRADO', message: 'No encontrado' } }, 404);
    }
    return null;
}

/** CSRF de las rutas de estado: la cabecera Origin debe existir y coincidir con el host de la peticion. */
export function origenValido(request) {
    const origen = request.headers.get('origin');
    const host = request.headers.get('host') || request.nextUrl?.host;
    if (!origen || !host) return false;
    try {
        return new URL(origen).host === host;
    } catch {
        return false;
    }
}

/** { user, exp } del usuario de la cookie (verificado contra auth.users) o null. */
export async function usuarioDe(request) {
    const sesion = verificarTokenSesion(request.cookies.get(COOKIE_SESION)?.value);
    if (!sesion) return null;
    const user = await obtenerUsuarioPorId(sesion.sub);
    return user ? { user, exp: sesion.exp } : null;
}

/** Lee el cuerpo JSON con tope de tamano; null si no es JSON valido o excede. */
export async function leerJson(request) {
    const largo = Number(request.headers.get('content-length') || 0);
    if (largo > MAX_JSON_BYTES) return null;
    try {
        const texto = await request.text();
        if (texto.length > MAX_JSON_BYTES) return null;
        const valor = JSON.parse(texto);
        return valor !== null && typeof valor === 'object' ? valor : null;
    } catch {
        return null;
    }
}

/**
 * Envoltorio de todos los handlers: solo local -> Origin (si `estado`) -> sesion (si `sesion`)
 * -> logica. Nunca deja escapar una excepcion con detalles internos.
 */
export async function manejar(request, { estado = true, sesion = true } = {}, logica) {
    const bloqueo = soloLocal();
    if (bloqueo) return bloqueo;
    if (estado && !origenValido(request)) {
        return errorHttp('Origen no permitido.', 'ORIGEN_INVALIDO', 403);
    }
    try {
        let usuario = null;
        if (sesion) {
            usuario = await usuarioDe(request);
            if (!usuario) return errorHttp('Se requiere una sesion valida.', '42501', 401, 'NO_AUTENTICADO');
        }
        return await logica({ usuario });
    } catch (e) {
        console.error('[local] error inesperado en un handler:', e?.code || e?.name || 'desconocido');
        return errorHttp('Error interno del adaptador local.', 'LOCAL_ERROR', 500);
    }
}

/** HTTP de un error de RPC (solo informativo: el cliente lee el cuerpo { data, error }). */
export function estatusDeErrorRpc(error) {
    const { code, hint } = error;
    if (code === '42501') return hint === 'NO_AUTENTICADO' ? 401 : 403;
    if (code === 'P0001') {
        if (hint === 'NO_AUTENTICADO') return 401;
        if (hint === 'NO_AUTORIZADO') return 403;
        if (hint === 'NO_ENCONTRADO') return 404;
        return 400;
    }
    if (code === 'PGRST202' || code === '42883') return 404;
    if (code === 'PGRST100' || /^22/.test(code || '')) return 400;
    if (/^23/.test(code || '')) return 409;
    if (code === 'LOCAL_DB_NO_DISPONIBLE') return 503;
    if (code === 'LOCAL_ERROR') return 500;
    return 400;
}

export { COOKIE_SESION };
