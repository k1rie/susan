// Autenticación y autorización en servidor: layouts/páginas (RSC), Route Handlers y cron. Solo servidor.
import { createHash, timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, fromRpcError } from '@/lib/api/errors';
import { callRpc } from '@/lib/api/client';
import { SITE_URL, serverEnv } from '@/config';
import { getServerBackend } from '@/lib/backend';
import { ipDeOrigen } from './ip.js';

/**
 * Roles que pueden entrar a cada área de la aplicación (ARCHITECTURE §3).
 * El técnico y el administrador comparten /tecnico (el admin en solo lectura, lo aplica la base).
 */
export const ROLES_POR_AREA = Object.freeze({
    admin: ['administrador'],
    docente: ['docente'],
    alumno: ['alumno'],
    tecnico: ['tecnico', 'administrador'],
    reportes: ['administrador', 'docente'],
    analitica: ['administrador', 'docente'],
});

/** Ruta de inicio por rol, para cuando hay sesión pero el rol no corresponde al área. */
const HOME_POR_ROL = Object.freeze({
    administrador: '/admin',
    docente: '/docente',
    alumno: '/alumno',
    tecnico: '/tecnico',
});

const fallo = (code, message, status) => new ApiError({ code, message, status });

/**
 * Valida el JWT contra Auth (getUser, no getSession: getSession no verifica la firma en el servidor).
 * @returns {Promise<object | null>} usuario de Auth o null
 */
async function usuarioAuth(backend) {
    let resultado;
    try {
        resultado = await backend.auth.getUser();
    } catch (e) {
        if (esCaidaDeAuth(e)) throw authNoDisponible();
        return null;
    }
    // Un error de red o 5xx de Auth NO significa "sin sesión": expulsar al usuario por una caída transitoria es peor.
    if (esCaidaDeAuth(resultado?.error)) throw authNoDisponible();
    return resultado?.data?.user ?? null;
}

const esCaidaDeAuth = (e) => Boolean(e) && (e.name === 'AuthRetryableFetchError' || (typeof e.status === 'number' && e.status >= 500));
const authNoDisponible = () => fallo('AUTH_NO_DISPONIBLE', 'El servicio de autenticación no responde. Intenta de nuevo en unos segundos.', 503);

/**
 * Estado de la sesión actual en un RSC/Route Handler.
 * @returns {Promise<{ estado: 'ok', me: object, backend: object, user: object }
 *                  | { estado: 'sin_sesion' | 'inactiva' | 'sin_cuenta' }>}
 */
export async function obtenerSesion() {
    const backend = await getServerBackend();
    const user = await usuarioAuth(backend);
    if (!user) return { estado: 'sin_sesion' };
    let me;
    try {
        me = await callRpc('api_yo', {}, { backend });
    } catch (e) {
        const apiError = fromRpcError(e);
        if (apiError.code === 'NO_AUTENTICADO') return { estado: 'sin_sesion' };
        if (apiError.code === 'CUENTA_NO_VINCULADA') return { estado: 'sin_cuenta' };
        throw apiError;
    }
    if (me?.activo === false) return { estado: 'inactiva' };
    return { estado: 'ok', me, backend, user };
}

/** `roles` puede ser un arreglo, el nombre de un área de ROLES_POR_AREA o { roles }. */
function resolverRoles(roles) {
    if (!roles) return null;
    if (typeof roles === 'string') return ROLES_POR_AREA[roles] ?? [roles];
    if (Array.isArray(roles)) return roles;
    if (Array.isArray(roles.roles)) return roles.roles;
    return null;
}

/**
 * Para layouts y páginas del servidor. Redirige (y no vuelve) si no procede; si no, devuelve `me`.
 * sin sesión -> /login?next=<ruta> · inactiva -> /login?error=cuenta_inactiva · sin cuenta -> /login?error=sin_cuenta
 * rol fuera de `roles` -> la página de inicio del propio rol.
 * @param {string[] | string | { roles: string[] }} [roles]
 * @returns {Promise<object>} me
 */
export async function requerirSesion(roles) {
    const sesion = await obtenerSesion();
    // redirect() lanza una excepción especial de Next: debe llamarse fuera de cualquier try/catch.
    if (sesion.estado === 'sin_sesion') {
        let ruta = null;
        try {
            ruta = (await headers()).get('x-pathname');
        } catch {
            ruta = null;
        }
        // Solo rutas internas relativas: evita que `next` sea un redireccionamiento abierto.
        const seguro = ruta && ruta.startsWith('/') && !ruta.startsWith('//') && !ruta.includes('\\');
        redirect(seguro ? `/login?next=${encodeURIComponent(ruta)}` : '/login');
    }
    if (sesion.estado === 'inactiva') redirect('/login?error=cuenta_inactiva');
    if (sesion.estado === 'sin_cuenta') redirect('/login?error=sin_cuenta');
    const permitidos = resolverRoles(roles);
    if (permitidos && !permitidos.includes(sesion.me.rol)) {
        redirect(sesion.me.home || HOME_POR_ROL[sesion.me.rol] || '/login');
    }
    return sesion.me;
}

/**
 * Lanza ApiError(ORIGEN_NO_PERMITIDO) si el método tiene efectos y `Origin` está presente y su host no es el
 * de la petición (defensa CSRF adicional a SameSite). Sin `Origin` permite: no es un navegador.
 */
export function verificarOrigen(request) {
    const metodo = String(request.method || 'GET').toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(metodo)) return;
    const origen = request.headers.get('origin');
    if (origen === null || origen === undefined) return;
    const rechazo = () => fallo('ORIGEN_NO_PERMITIDO', 'Origen de la petición no permitido.', 403);
    let hostOrigen;
    try {
        hostOrigen = new URL(origen).host;
    } catch {
        throw rechazo(); // incluye Origin: "null"
    }
    const reenviado = (request.headers.get('x-forwarded-host') || '').split(',')[0].trim();
    const permitidos = new Set([request.headers.get('host'), reenviado].filter(Boolean));
    try {
        permitidos.add(new URL(SITE_URL).host);
    } catch {
        // SITE_URL mal formada: solo cuenta el host de la petición
    }
    if (!permitidos.has(hostOrigen)) throw rechazo();
}

/** Comparación en tiempo constante: se comparan resúmenes SHA-256 (misma longitud) con timingSafeEqual. */
export function compararSecreto(recibido, esperado) {
    const a = createHash('sha256').update(String(recibido ?? '')).digest();
    const b = createHash('sha256').update(String(esperado ?? '')).digest();
    return timingSafeEqual(a, b);
}

/**
 * Autoriza un job: `Authorization: Bearer <CRON_SECRET>`. Sin secreto configurado nunca se acepta nada.
 * @throws {ApiError} CONFIGURACION_FALTANTE (503) | NO_AUTENTICADO (401)
 */
export function verificarCron(request) {
    const { cronSecret } = serverEnv();
    if (!cronSecret) throw fallo('CONFIGURACION_FALTANTE', 'El servicio no está configurado.', 503);
    const cabecera = request.headers.get('authorization') || '';
    const m = cabecera.match(/^Bearer (.+)$/i);
    // Se compara siempre (aunque falte el bearer) para no distinguir los casos por tiempo.
    const ok = compararSecreto(m ? m[1] : '', cronSecret);
    if (!m || !ok) throw fallo('NO_AUTENTICADO', 'Debes iniciar sesión.', 401);
}

/**
 * Primeros pasos de handle() para auth:'usuario'.
 * @returns {Promise<{ backend: object, me: object, user: object, ip: string | null }>}
 */
export async function exigirUsuario(request, { roles } = {}) {
    verificarOrigen(request);
    const ip = ipDeOrigen(request);
    const backend = await getServerBackend();
    const user = await usuarioAuth(backend);
    if (!user) throw fallo('NO_AUTENTICADO', 'Debes iniciar sesión.', 401);
    const me = await callRpc('api_yo', {}, { backend });
    if (me?.activo === false) throw fallo('CUENTA_INACTIVA', 'Tu cuenta está inactiva. Contacta al administrador.', 403);
    const permitidos = resolverRoles(roles);
    if (permitidos && !permitidos.includes(me?.rol)) {
        throw fallo('NO_AUTORIZADO', 'No tienes permiso para realizar esta operación.', 403);
    }
    return { backend, me, user, ip };
}
