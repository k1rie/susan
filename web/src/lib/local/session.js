// Sesion del modo local: cookie httpOnly con un token propio (NO es un JWT de Supabase).
// Formato: base64url(JSON{sub,exp}).base64url(HMAC-SHA256). Se firma con una clave derivada por
// dominio ('sesion' | 'storage') para que un token de URL firmada jamas valga como cookie.
import crypto from 'node:crypto';
import { serverEnv } from '@/config';

export const COOKIE_SESION = 'susan_local_session';
export const DURACION_SESION_SEG = 8 * 60 * 60;

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TOKEN = 4096;

const claveDerivada = (secreto, dominio) =>
    crypto.createHmac('sha256', String(secreto)).update(`susan-local:${dominio}:v1`).digest();

const hmac = (cuerpo, secreto, dominio) =>
    crypto.createHmac('sha256', claveDerivada(secreto, dominio)).update(cuerpo).digest();

/** Firma una carga JSON arbitraria. Devuelve `cuerpo.firma` (ambos base64url). */
export function firmarCarga(carga, secreto, dominio) {
    const cuerpo = Buffer.from(JSON.stringify(carga), 'utf8').toString('base64url');
    return `${cuerpo}.${hmac(cuerpo, secreto, dominio).toString('base64url')}`;
}

/**
 * Verifica firma (comparacion en tiempo constante) y expiracion (`exp`, segundos epoch).
 * Devuelve la carga o null; nunca lanza ante un token manipulado.
 */
export function verificarCarga(token, secreto, dominio, ahoraSeg = Math.floor(Date.now() / 1000)) {
    if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN) return null;
    const partes = token.split('.');
    if (partes.length !== 2) return null;
    const [cuerpo, firma] = partes;
    const esperada = hmac(cuerpo, secreto, dominio);
    const recibida = Buffer.from(firma, 'base64url');
    if (recibida.length !== esperada.length || !crypto.timingSafeEqual(recibida, esperada)) return null;
    let carga;
    try {
        carga = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
    if (!carga || typeof carga !== 'object' || Array.isArray(carga)) return null;
    if (!Number.isFinite(carga.exp) || carga.exp <= ahoraSeg) return null;
    return carga;
}

/** Token de sesion para el usuario `sub` (= auth.users.id). */
export function crearTokenSesion(sub, { secreto = serverEnv().localAuthSecret, ahoraSeg = Math.floor(Date.now() / 1000) } = {}) {
    return firmarCarga({ sub, exp: ahoraSeg + DURACION_SESION_SEG }, secreto, 'sesion');
}

/** Devuelve { sub, exp } si el token es valido y vigente; si no, null. */
export function verificarTokenSesion(token, { secreto = serverEnv().localAuthSecret, ahoraSeg } = {}) {
    const carga = verificarCarga(token, secreto, 'sesion', ahoraSeg);
    if (!carga || typeof carga.sub !== 'string' || !RE_UUID.test(carga.sub)) return null;
    return { sub: carga.sub, exp: carga.exp };
}

/** Opciones de la cookie: httpOnly (el JS del navegador no la lee), lax (frena CSRF de terceros), 8 h. */
export function opcionesCookieSesion() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: DURACION_SESION_SEG,
        secure: process.env.NODE_ENV === 'production',
    };
}

export const esUuid = (valor) => typeof valor === 'string' && RE_UUID.test(valor);
