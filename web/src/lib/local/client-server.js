// Backend local "del usuario" para RSC y Route Handlers: lee la cookie de sesion de la peticion
// (await cookies(), asincrono en Next 16) y habla directo con PostgreSQL. Misma superficie que
// el cliente de @supabase/ssr en servidor.
import { cookiesDePeticion } from '@/lib/backend/cookies.js';
import {
    aSesion,
    cambiarContrasena,
    errorAuth,
    errorSinSesion,
    obtenerUsuarioPorId,
    solicitarRecuperacion,
    verificarCredenciales,
} from './auth.js';
import { ejecutarRpc } from './rpc.js';
import { COOKIE_SESION, crearTokenSesion, opcionesCookieSesion, verificarTokenSesion } from './session.js';
import { crearStorageLocal } from './storage.js';

export async function crearBackendServidorLocal() {
    const almacen = await cookiesDePeticion();
    const leerSesion = () => verificarTokenSesion(almacen.get(COOKIE_SESION)?.value);
    let cache = null; // { sub, user }: el backend vive una sola peticion

    async function usuarioActual() {
        const s = leerSesion();
        if (!s) return null;
        if (cache?.sub !== s.sub) cache = { sub: s.sub, user: await obtenerUsuarioPorId(s.sub) };
        return cache.user ? { user: cache.user, exp: s.exp } : null;
    }

    // En un Server Component la cookie no se puede escribir: Next lanza y se ignora (el proxy ya refresca).
    const escribirCookie = (token) => {
        try {
            almacen.set(COOKIE_SESION, token, opcionesCookieSesion());
        } catch {
            /* solo lectura en RSC */
        }
    };
    const borrarCookie = () => {
        try {
            almacen.delete(COOKIE_SESION);
        } catch {
            /* solo lectura en RSC */
        }
    };

    const auth = {
        async getUser() {
            const u = await usuarioActual();
            return u ? { data: { user: u.user }, error: null } : { data: { user: null }, error: errorSinSesion() };
        },
        async getSession() {
            const u = await usuarioActual();
            return { data: { session: u ? aSesion(u.user, u.exp) : null }, error: null };
        },
        async signInWithPassword({ email, password } = {}) {
            const r = await verificarCredenciales(email, password);
            if (r.error) return { data: { user: null, session: null }, error: r.error };
            const token = crearTokenSesion(r.user.id);
            escribirCookie(token);
            cache = { sub: r.user.id, user: r.user };
            const sesion = verificarTokenSesion(token);
            return { data: { user: r.user, session: aSesion(r.user, sesion.exp) }, error: null };
        },
        async signOut() {
            borrarCookie();
            cache = null;
            return { error: null };
        },
        async resetPasswordForEmail() {
            return solicitarRecuperacion();
        },
        async updateUser(attrs = {}) {
            const u = await usuarioActual();
            if (!u) return { data: { user: null }, error: errorSinSesion() };
            if (attrs.password === undefined) {
                return { data: { user: null }, error: errorAuth('validation_failed', 'Solo se admite cambiar la contrasena.', 422) };
            }
            const r = await cambiarContrasena(u.user.id, attrs.password);
            if (r.error) return { data: { user: null }, error: r.error };
            return { data: { user: r.user }, error: null };
        },
        // En servidor no hay eventos que escuchar; existe para igualar la superficie.
        onAuthStateChange() {
            return { data: { subscription: { unsubscribe() {} } } };
        },
    };

    return {
        auth,
        async rpc(nombre, args) {
            const u = await usuarioActual();
            return ejecutarRpc(nombre, args, {
                rol: 'authenticated',
                claims: u ? { sub: u.user.id, email: u.user.email } : {},
            });
        },
        storage: crearStorageLocal({ privilegios: 'usuario', sub: leerSesion()?.sub }),
    };
}
