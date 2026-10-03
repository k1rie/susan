import { SITE_URL } from '@/config';
import { callRpc, resolverBackend } from './client.js';
import { ApiError, STATUS_POR_CODIGO } from './errors.js';
import { emitirCambioSesion } from './sesionEventos.js';

export { suscribirCambioSesion } from './sesionEventos.js';

const MENSAJES_AUTH = {
    CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos.',
    DEMASIADOS_INTENTOS: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
    NO_AUTENTICADO: 'Tu sesión expiró. Inicia sesión de nuevo.',
    CONTRASENA_DEBIL: 'La contraseña es demasiado débil. Usa al menos 8 caracteres combinando letras y números.',
    CONTRASENA_IGUAL: 'La nueva contraseña debe ser distinta de la actual.',
    CUENTA_INACTIVA: 'Tu cuenta está desactivada. Contacta al administrador.',
    ERROR_RED: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    ERROR_INTERNO: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
};

function errorAuth(code, details = null) {
    return new ApiError({ code, message: MENSAJES_AUTH[code], status: STATUS_POR_CODIGO[code] ?? 500, details });
}

/**
 * Traduce un error de Supabase Auth a ApiError con mensaje en español. Se decide por `error.code` y, si
 * falta (versiones o modo local), por el texto del mensaje. El texto original no se propaga.
 * @param {any} error
 * @param {{ enInicio?: boolean }} [opciones] enInicio: user_banned/user_not_found se interpretan para el login
 * @returns {ApiError}
 */
export function traducirErrorAuth(error, { enInicio = false } = {}) {
    if (error instanceof ApiError) return error;
    const code = String(error?.code ?? '');
    const texto = String(error?.message ?? '');
    const status = Number(error?.status ?? 0);

    if (code === 'invalid_credentials' || /invalid login credentials/i.test(texto)) return errorAuth('CREDENCIALES_INVALIDAS');
    if (code === 'user_banned') return errorAuth(enInicio ? 'CUENTA_INACTIVA' : 'NO_AUTENTICADO');
    if (code === 'user_not_found') return errorAuth(enInicio ? 'CREDENCIALES_INVALIDAS' : 'NO_AUTENTICADO');
    if (
        code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || status === 429
        || /rate limit|too many requests/i.test(texto)
    ) {
        return errorAuth('DEMASIADOS_INTENTOS');
    }
    if (code === 'weak_password' || /password should be at least|weak password/i.test(texto)) return errorAuth('CONTRASENA_DEBIL');
    if (code === 'same_password' || /different from the old password/i.test(texto)) return errorAuth('CONTRASENA_IGUAL');
    if (
        code === 'session_not_found' || code === 'not_authenticated' || code === 'session_expired'
        || /auth session missing|session.*(expired|not found)|jwt expired/i.test(texto)
    ) {
        return errorAuth('NO_AUTENTICADO');
    }
    if (
        error?.name === 'AuthRetryableFetchError' || error instanceof TypeError
        || /failed to fetch|fetch failed|networkerror|network request failed/i.test(texto)
    ) {
        return errorAuth('ERROR_RED');
    }
    return errorAuth('ERROR_INTERNO', texto || null);
}

const normalizarCorreo = (correo) => String(correo ?? '').trim().toLowerCase();

/**
 * Inicia sesión y devuelve la identidad (api_yo). Una cuenta inactiva o sin perfil cierra la sesión recién
 * abierta: nadie debe quedar autenticado sin poder usar la aplicación.
 * @param {{ correo: string, contrasena: string }} credenciales
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} Me { id_usuario, auth_uid, correo, rol, activo, id_docente, id_alumno, nombre, home }
 * @throws {ApiError} CREDENCIALES_INVALIDAS, DEMASIADOS_INTENTOS, CUENTA_INACTIVA, CUENTA_NO_VINCULADA, ERROR_RED
 */
export async function iniciarSesion({ correo, contrasena }, opts = {}) {
    const backend = await resolverBackend(opts);
    let respuesta;
    try {
        respuesta = await backend.auth.signInWithPassword({ email: normalizarCorreo(correo), password: contrasena });
    } catch (e) {
        throw traducirErrorAuth(e, { enInicio: true });
    }
    if (respuesta?.error) throw traducirErrorAuth(respuesta.error, { enInicio: true });

    let me;
    try {
        me = await callRpc('api_yo', {}, { backend });
    } catch (e) {
        await backend.auth.signOut().catch(() => {});
        throw e;
    }
    if (me?.activo === false) {
        await backend.auth.signOut().catch(() => {});
        throw errorAuth('CUENTA_INACTIVA');
    }
    emitirCambioSesion('inicio');
    return me;
}

/** Cierra la sesión. Los errores se ignoran: si no se pudo avisar al servidor, localmente ya se considera cerrada. */
export async function cerrarSesion(opts = {}) {
    try {
        const backend = await resolverBackend(opts);
        await backend.auth.signOut();
    } catch {
        // Ver nota de la función.
    }
    emitirCambioSesion('cierre');
}

/**
 * Envía el correo de recuperación. Por anti-enumeración de cuentas solo se informan DEMASIADOS_INTENTOS y
 * ERROR_RED; cualquier otro resultado (incluido "correo no existe") se presenta como éxito.
 * @param {{ correo: string }} datos
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<void>}
 */
export async function recuperarContrasena({ correo }, opts = {}) {
    const backend = await resolverBackend(opts);
    let error = null;
    try {
        ({ error = null } = (await backend.auth.resetPasswordForEmail(normalizarCorreo(correo), {
            redirectTo: `${SITE_URL}/cambiar-contrasena`,
        })) ?? {});
    } catch (e) {
        error = e;
    }
    if (!error) return;
    const traducido = traducirErrorAuth(error);
    if (traducido.code === 'DEMASIADOS_INTENTOS' || traducido.code === 'ERROR_RED') throw traducido;
}

/**
 * Cambia la contraseña de la sesión actual (también al llegar desde el enlace de recuperación).
 * @param {{ contrasena: string }} datos
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<void>}
 * @throws {ApiError} CONTRASENA_DEBIL, CONTRASENA_IGUAL, NO_AUTENTICADO, ERROR_RED
 */
export async function cambiarContrasena({ contrasena }, opts = {}) {
    const backend = await resolverBackend(opts);
    let respuesta;
    try {
        respuesta = await backend.auth.updateUser({ password: contrasena });
    } catch (e) {
        throw traducirErrorAuth(e);
    }
    if (respuesta?.error) throw traducirErrorAuth(respuesta.error);
}

/**
 * ¿Hay sesión en el navegador? Solo para la pantalla de cambio de contraseña: NO autoriza nada (la
 * autorización siempre la decide el servidor con getUser()).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<{ autenticado: boolean }>}
 */
export async function obtenerSesion(opts = {}) {
    const backend = await resolverBackend(opts);
    try {
        const { data } = (await backend.auth.getSession()) ?? {};
        return { autenticado: Boolean(data?.session) };
    } catch (e) {
        throw traducirErrorAuth(e);
    }
}

/**
 * Suscribe a los cambios de autenticación del backend.
 * @param {(estado: { evento: string, autenticado: boolean }) => void} cb
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<() => void>} función para cancelar la suscripción
 */
export async function suscribirCambioAuth(cb, opts = {}) {
    const backend = await resolverBackend(opts);
    const { data } = backend.auth.onAuthStateChange((evento, sesion) => cb({ evento, autenticado: Boolean(sesion) })) ?? {};
    return () => data?.subscription?.unsubscribe?.();
}
