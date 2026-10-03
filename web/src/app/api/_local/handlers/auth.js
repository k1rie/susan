// Handlers /api/_local/auth/*: login, logout, session, password, reset.
import { z } from 'zod';
import { aSesion, cambiarContrasena, solicitarRecuperacion, verificarCredenciales } from '@/lib/local/auth.js';
import { COOKIE_SESION, crearTokenSesion, opcionesCookieSesion, verificarTokenSesion } from '@/lib/local/session.js';
import { errorHttp, json, leerJson, manejar, usuarioDe } from './comun.js';

const esquemaLogin = z.object({ email: z.string().min(1).max(320), password: z.string().min(1).max(200) });
const esquemaClave = z.object({ password: z.string().min(1).max(200) });
const esquemaReset = z.object({ email: z.string().min(1).max(320), redirectTo: z.string().max(2048).optional() });

const estatusAuth = (error) => (error?.status >= 400 && error.status < 600 ? error.status : 400);

export function login(request) {
    return manejar(request, { sesion: false }, async () => {
        const cuerpo = esquemaLogin.safeParse(await leerJson(request));
        if (!cuerpo.success) return errorHttp('Correo y contrasena son obligatorios.', 'validation_failed', 400);
        const r = await verificarCredenciales(cuerpo.data.email, cuerpo.data.password);
        if (r.error) return json({ data: { user: null, session: null }, error: r.error }, estatusAuth(r.error));
        const token = crearTokenSesion(r.user.id);
        const res = json({ data: { user: r.user, session: aSesion(r.user, verificarTokenSesion(token).exp) }, error: null });
        res.cookies.set(COOKIE_SESION, token, opcionesCookieSesion());
        return res;
    });
}

// Idempotente a proposito: cerrar sesion con una cookie ya vencida debe limpiarla, no dar 401.
export function logout(request) {
    return manejar(request, { sesion: false }, async () => {
        const res = json({ error: null });
        res.cookies.set(COOKIE_SESION, '', { ...opcionesCookieSesion(), maxAge: 0 });
        return res;
    });
}

export function session(request) {
    return manejar(request, { estado: false, sesion: false }, async () => {
        const u = await usuarioDe(request);
        return json({ data: u ? { user: u.user, session: aSesion(u.user, u.exp) } : { user: null, session: null }, error: null });
    });
}

export function password(request) {
    return manejar(request, {}, async ({ usuario }) => {
        const cuerpo = esquemaClave.safeParse(await leerJson(request));
        if (!cuerpo.success) return errorHttp('La contrasena es obligatoria.', 'validation_failed', 400);
        const r = await cambiarContrasena(usuario.user.id, cuerpo.data.password);
        if (r.error) return json({ data: { user: null }, error: r.error }, estatusAuth(r.error));
        return json({ data: { user: r.user }, error: null });
    });
}

export function reset(request) {
    return manejar(request, { sesion: false }, async () => {
        const cuerpo = esquemaReset.safeParse(await leerJson(request));
        if (!cuerpo.success) return errorHttp('El correo es obligatorio.', 'validation_failed', 400);
        // Responde igual exista o no la cuenta (no revela cuentas), como Supabase.
        return json(solicitarRecuperacion());
    });
}
