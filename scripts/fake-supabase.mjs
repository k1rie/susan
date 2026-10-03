#!/usr/bin/env node
// Supabase SIMULADO fiel para verificar el MODO REAL de SUSAN sin un proyecto Supabase.
// Emula lo minimo de GoTrue (/auth/v1), PostgREST (/rest/v1/rpc) y Storage (/storage/v1) en
// 127.0.0.1:54399, sin dependencias nuevas: HTTP de Node, JWT HS256 con node:crypto y la BD local
// (extensions.crypt de auth.users) + el ejecutor de RPC local de web/src/lib/local/rpc.js.
//
// Uso:
//   LOCAL_DATABASE_URL=postgres://127.0.0.1:54329/susan_realmode node scripts/fake-supabase.mjs
//   node scripts/fake-supabase.mjs --print-keys     # imprime ANON_KEY y SERVICE_ROLE_KEY y sale
// Variables: STUB_PORT (54399), STUB_JWT_SECRET, STUB_JWT_TTL (3600 s; tambien POST /__stub/ttl?seconds=N),
//            STUB_STORAGE_DIR (carpeta temporal por omision).
//
// Fidelidad que se cuida a proposito (son los puntos donde un stub "comodo" ocultaria bugs):
//  - tokens JWT reales (exp, role, sub, session_id) y refresh tokens de UN solo uso (rotacion);
//  - GET /auth/v1/user valida la sesion en servidor (403 session_not_found tras cerrar sesion);
//  - PostgREST es sin estado: acepta un JWT valido hasta su exp aunque la sesion este cerrada;
//  - errores de PostgREST con sus status (P0001 -> 400, 42501 -> 401/403, PGRST301 -> 401, 23505 -> 409...);
//  - Storage responde 400 con statusCode '403' en el cuerpo para las politicas RLS, como el real;
//  - CORS (el cliente del navegador habla directo con este host).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(AQUI, '../web/src');

export const SECRETO_JWT = process.env.STUB_JWT_SECRET || 'fake-supabase-jwt-secret-for-susan-tests-0123456789';
export const PUERTO_STUB = Number(process.env.STUB_PORT || 54399);
const AUD = 'authenticated';

// ---- Alias '@/' para importar el ejecutor local fuera de Next/vitest -----------------------------
let aliasRegistrado = false;
function registrarAlias() {
    if (aliasRegistrado || process.env.VITEST) return;
    aliasRegistrado = true;
    const fuente = `
        import { pathToFileURL } from 'node:url';
        export async function resolve(spec, ctx, next) {
            if (spec.startsWith('@/')) {
                let p = ${JSON.stringify(SRC + '/')} + spec.slice(2);
                if (!/\\.[a-z]+$/.test(p)) p += '.js';
                return next(pathToFileURL(p).href, ctx);
            }
            return next(spec, ctx);
        }`;
    register(`data:text/javascript,${encodeURIComponent(fuente)}`, import.meta.url);
}

// ---- JWT HS256 --------------------------------------------------------------------------------
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
export function firmarJwt(carga, secreto = SECRETO_JWT) {
    const cuerpo = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(carga)}`;
    return `${cuerpo}.${crypto.createHmac('sha256', secreto).update(cuerpo).digest('base64url')}`;
}
/** { ok, claims } | { ok:false, motivo:'expirado'|'firma'|'formato' } */
export function verificarJwt(token, secreto = SECRETO_JWT, ahora = Math.floor(Date.now() / 1000)) {
    const partes = typeof token === 'string' ? token.split('.') : [];
    if (partes.length !== 3) return { ok: false, motivo: 'formato' };
    const esperada = crypto.createHmac('sha256', secreto).update(`${partes[0]}.${partes[1]}`).digest();
    const recibida = Buffer.from(partes[2], 'base64url');
    if (recibida.length !== esperada.length || !crypto.timingSafeEqual(recibida, esperada)) return { ok: false, motivo: 'firma' };
    let claims;
    try {
        claims = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
    } catch {
        return { ok: false, motivo: 'formato' };
    }
    if (claims.exp !== undefined && claims.exp <= ahora) return { ok: false, motivo: 'expirado' };
    return { ok: true, claims };
}
/** Llaves de proyecto como las de Supabase (anon / service_role, caducan en 10 anios). */
export function llavesProyecto(secreto = SECRETO_JWT) {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 10 * 365 * 86400;
    return {
        anon: firmarJwt({ iss: 'supabase-demo', role: 'anon', iat, exp }, secreto),
        service_role: firmarJwt({ iss: 'supabase-demo', role: 'service_role', iat, exp }, secreto),
    };
}

// ---- Errores ----------------------------------------------------------------------------------
/** Status HTTP de PostgREST para un SQLSTATE (docs "Errors": https://docs.postgrest.org/en/stable/references/errors.html). */
export function statusDePg(code, autenticado) {
    if (!code) return 500;
    if (code.startsWith('PGRST')) {
        return { PGRST100: 400, PGRST202: 404, PGRST301: 401, PGRST302: 401 }[code] ?? 400;
    }
    if (code === '42501') return autenticado ? 403 : 401;
    if (code === '42883' || code === '42P01') return 404;
    if (code === '23503' || code === '23505') return 409;
    if (code === '25006') return 405;
    if (/^(08|53)/.test(code)) return 503;
    if (/^(0L|0P|28)/.test(code)) return 403;
    if (code === 'P0001') return 400;
    if (/^(09|25|2D|38|39|3B|40|54|55|57|58|F0|HV|XX|P0)/.test(code) || code === '42P17') return 500;
    return 400; // 22xxx, 23xxx restantes, 42xxx: errores del cliente
}

const authError = (res, status, error_code, msg, extra = {}) => responder(res, status, { code: status, error_code, msg, ...extra });
const storageError = (res, httpStatus, statusCode, error, message) =>
    responder(res, httpStatus, { statusCode: String(statusCode), error, message });

// ---- HTTP util --------------------------------------------------------------------------------
const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers':
        'authorization,apikey,content-type,x-client-info,x-supabase-api-version,x-upsert,cache-control,prefer,accept-profile,content-profile,range',
    'access-control-expose-headers': 'x-total-count,link,content-range',
    'access-control-max-age': '600',
};

function responder(res, status, cuerpo, cabeceras = {}) {
    const esBuffer = Buffer.isBuffer(cuerpo);
    const datos = esBuffer ? cuerpo : cuerpo === undefined ? '' : JSON.stringify(cuerpo);
    res.writeHead(status, {
        ...CORS,
        ...(esBuffer ? {} : { 'content-type': 'application/json; charset=utf-8' }),
        ...cabeceras,
    });
    res.end(datos);
}

async function leerCuerpo(req, max = 20 * 1024 * 1024) {
    const trozos = [];
    let total = 0;
    for await (const t of req) {
        total += t.length;
        if (total > max) throw Object.assign(new Error('Payload too large'), { status: 413 });
        trozos.push(t);
    }
    return Buffer.concat(trozos);
}
const leerJson = async (req) => {
    const b = await leerCuerpo(req);
    if (!b.length) return {};
    try {
        return JSON.parse(b.toString('utf8'));
    } catch {
        return null;
    }
};

const bearer = (req) => (/^Bearer (.+)$/i.exec(req.headers.authorization || '') || [])[1] || null;

// ---- Estado de GoTrue (en memoria) -------------------------------------------------------------
// sesiones: id -> { userId, creada }; refresh: token -> { sesion, userId, usado }
const sesiones = new Map();
const refresh = new Map();
let ttlSeg = Number(process.env.STUB_JWT_TTL || 3600);

function emitirSesion(user, sesionId) {
    const ahora = Math.floor(Date.now() / 1000);
    const claims = {
        iss: `http://127.0.0.1:${PUERTO_STUB}/auth/v1`,
        sub: user.id,
        aud: AUD,
        iat: ahora,
        exp: ahora + ttlSeg,
        email: user.email,
        phone: '',
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata,
        role: 'authenticated',
        aal: 'aal1',
        amr: [{ method: 'password', timestamp: ahora }],
        session_id: sesionId,
        is_anonymous: false,
    };
    const rt = crypto.randomBytes(8).toString('base64url');
    refresh.set(rt, { sesion: sesionId, userId: user.id, usado: false });
    return {
        access_token: firmarJwt(claims),
        token_type: 'bearer',
        expires_in: ttlSeg,
        expires_at: claims.exp,
        refresh_token: rt,
        user: { ...user, last_sign_in_at: new Date().toISOString() },
    };
}

/** Usuario + sesion a partir de un access token; GoTrue valida que la sesion siga viva. */
async function usuarioDeToken(token, mods) {
    const v = verificarJwt(token);
    if (!v.ok) {
        return { error: v.motivo === 'expirado' ? ['bad_jwt', 403, 'invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired']
            : ['bad_jwt', 403, 'invalid JWT: unable to parse or verify signature'] };
    }
    const { claims } = v;
    if (claims.role === 'service_role' || claims.role === 'anon' || !claims.sub) {
        return { error: ['bad_jwt', 403, 'invalid claim: missing sub claim'] };
    }
    if (claims.session_id && !sesiones.has(claims.session_id)) {
        return { error: ['session_not_found', 403, 'Session from session_id claim in JWT does not exist'] };
    }
    const user = await mods.auth.obtenerUsuarioPorId(claims.sub);
    if (!user) return { error: ['user_not_found', 403, 'User from sub claim in JWT does not exist'] };
    return { user, claims };
}

// ---- Manejadores GoTrue -----------------------------------------------------------------------
async function manejarAuth(req, res, url, mods) {
    const ruta = url.pathname.slice('/auth/v1'.length);
    const metodo = req.method;

    if (ruta === '/token' && metodo === 'POST') {
        const tipo = url.searchParams.get('grant_type');
        const cuerpo = await leerJson(req);
        if (cuerpo === null) return authError(res, 400, 'bad_json', 'Could not parse request body as JSON');
        if (tipo === 'password') {
            const r = await mods.auth.verificarCredenciales(cuerpo.email, cuerpo.password);
            if (r.error) return authError(res, r.error.status || 400, r.error.code, r.error.message);
            const sid = crypto.randomUUID();
            sesiones.set(sid, { userId: r.user.id, creada: Date.now() });
            return responder(res, 200, emitirSesion(r.user, sid));
        }
        if (tipo === 'refresh_token') {
            const reg = refresh.get(cuerpo.refresh_token);
            if (!reg) return authError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
            // GoTrue: GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL (10 s por omision) tolera el reuso inmediato
            // (dos peticiones paralelas del navegador con la misma cookie caducada).
            const reuso = reg.usado && Date.now() - reg.usado < 10_000;
            if (!sesiones.has(reg.sesion) || (reg.usado && !reuso)) {
                return authError(res, 400, 'refresh_token_already_used', 'Invalid Refresh Token: Already Used');
            }
            if (!reg.usado) reg.usado = Date.now();
            const user = await mods.auth.obtenerUsuarioPorId(reg.userId);
            if (!user) return authError(res, 400, 'user_not_found', 'User not found');
            return responder(res, 200, emitirSesion(user, reg.sesion));
        }
        return authError(res, 400, 'validation_failed', 'unsupported_grant_type');
    }

    if (ruta === '/user' && metodo === 'GET') {
        const t = bearer(req);
        if (!t) return authError(res, 401, 'no_authorization', 'This endpoint requires a Bearer token');
        const r = await usuarioDeToken(t, mods);
        if (r.error) return authError(res, r.error[1], r.error[0], r.error[2]);
        return responder(res, 200, r.user);
    }

    if (ruta === '/user' && metodo === 'PUT') {
        const t = bearer(req);
        if (!t) return authError(res, 401, 'no_authorization', 'This endpoint requires a Bearer token');
        const r = await usuarioDeToken(t, mods);
        if (r.error) return authError(res, r.error[1], r.error[0], r.error[2]);
        const cuerpo = await leerJson(req);
        if (!cuerpo || cuerpo.password === undefined) return authError(res, 422, 'validation_failed', 'Only password updates are emulated');
        const c = await mods.auth.cambiarContrasena(r.user.id, cuerpo.password);
        if (c.error) return authError(res, c.error.status || 422, c.error.code, c.error.message);
        return responder(res, 200, c.user);
    }

    if (ruta === '/logout' && metodo === 'POST') {
        const t = bearer(req);
        const v = verificarJwt(t);
        // GoTrue exige un JWT valido (incluso caducado para cerrar sesion se rechaza con 401).
        if (!v.ok || !v.claims.session_id) return authError(res, 401, 'bad_jwt', 'invalid JWT');
        const scope = url.searchParams.get('scope') || 'global';
        for (const [id, s] of sesiones) {
            if ((scope === 'global' && s.userId === v.claims.sub) || id === v.claims.session_id) sesiones.delete(id);
        }
        return responder(res, 204, undefined);
    }

    if (ruta === '/recover' && metodo === 'POST') {
        const cuerpo = await leerJson(req);
        if (!cuerpo || typeof cuerpo.email !== 'string') return authError(res, 400, 'validation_failed', 'To reset a password, an email is required');
        stubEstado.recuperaciones.push({ email: cuerpo.email, redirect_to: url.searchParams.get('redirect_to') });
        return responder(res, 200, {}); // GoTrue no revela si la cuenta existe
    }

    if (ruta.startsWith('/admin/users')) {
        const t = bearer(req);
        const v = verificarJwt(t);
        if (!v.ok) return authError(res, 401, 'bad_jwt', 'invalid JWT: unable to parse or verify signature');
        if (v.claims.role !== 'service_role') return authError(res, 403, 'not_admin', 'User not allowed');
        const admin = mods.auth.crearAdminAuth();
        const id = ruta.split('/')[3];
        const falla = (r) => authError(res, r.error.status || 400, r.error.code, r.error.message);
        if (!id && metodo === 'POST') {
            const cuerpo = (await leerJson(req)) || {};
            const r = await admin.createUser(cuerpo);
            return r.error ? falla(r) : responder(res, 200, r.data.user);
        }
        if (!id && metodo === 'GET') {
            const page = Number(url.searchParams.get('page') || 1);
            const perPage = Number(url.searchParams.get('per_page') || 50);
            const r = await admin.listUsers({ page, perPage });
            if (r.error) return falla(r);
            const { total, nextPage, lastPage } = r.data;
            const enlaces = [];
            if (nextPage) enlaces.push(`<http://stub/admin/users?page=${nextPage}&per_page=${perPage}>; rel="next"`);
            enlaces.push(`<http://stub/admin/users?page=${lastPage}&per_page=${perPage}>; rel="last"`);
            return responder(res, 200, { users: r.data.users, aud: AUD }, { 'x-total-count': String(total), link: enlaces.join(',') });
        }
        if (id && metodo === 'PUT') {
            const r = await admin.updateUserById(id, (await leerJson(req)) || {});
            return r.error ? falla(r) : responder(res, 200, r.data.user);
        }
        if (id && metodo === 'GET') {
            const u = await mods.auth.obtenerUsuarioPorId(id);
            return u ? responder(res, 200, u) : authError(res, 404, 'user_not_found', 'User not found');
        }
        if (id && metodo === 'DELETE') {
            const r = await admin.deleteUser(id);
            if (r.error) return falla(r);
            for (const [sid, s] of sesiones) if (s.userId === id) sesiones.delete(sid);
            return responder(res, 200, {});
        }
    }
    return authError(res, 404, 'not_found', `Path ${ruta} not found`);
}

// ---- PostgREST --------------------------------------------------------------------------------
async function manejarRest(req, res, url, mods) {
    const m = /^\/rest\/v1\/rpc\/([^/]+)$/.exec(url.pathname);
    if (!m) return responder(res, 404, { code: 'PGRST125', message: `Invalid path specified in request URL`, details: null, hint: null });
    if (req.method !== 'POST' && req.method !== 'GET') return responder(res, 405, { code: 'PGRST117', message: 'Unsupported HTTP method', details: null, hint: null });
    const apikey = req.headers.apikey;
    const token = bearer(req) || apikey;
    if (!token) {
        return responder(res, 401, { message: 'No API key found in request', hint: 'No `apikey` request header or url param was found.' });
    }
    const v = verificarJwt(token);
    if (!v.ok) {
        const msg = v.motivo === 'expirado' ? 'JWT expired' : 'JWSError JWSInvalidSignature';
        return responder(res, 401, { code: 'PGRST301', details: null, hint: null, message: msg },
            { 'www-authenticate': `Bearer error="invalid_token", error_description="${msg}"` });
    }
    const rol = v.claims.role;
    const nombre = decodeURIComponent(m[1]);
    const args = req.method === 'GET' ? Object.fromEntries(url.searchParams) : await leerJson(req);
    if (args === null) return responder(res, 400, { code: 'PGRST102', message: 'Empty or invalid json', details: null, hint: null });

    if (rol === 'anon') {
        // anon no tiene EXECUTE en api_*/svc_*: PostgREST lo responde 401 (rol no autenticado).
        return responder(res, 401, { code: '42501', details: null, hint: null, message: `permission denied for function ${nombre}` });
    }
    if (rol !== 'authenticated' && rol !== 'service_role') {
        return responder(res, 401, { code: 'PGRST302', details: null, hint: null, message: 'Anonymous access is disabled' });
    }
    const r = await mods.rpc.ejecutarRpc(nombre, args, { rol, claims: { sub: v.claims.sub, email: v.claims.email } });
    if (r.error) {
        const status = statusDePg(r.error.code, true);
        return responder(res, status, { code: r.error.code, details: r.error.details ?? null, hint: r.error.hint ?? null, message: r.error.message });
    }
    return responder(res, 200, r.data === undefined ? null : r.data);
}

// ---- Storage ----------------------------------------------------------------------------------
const RE_BUCKET = /^[a-z0-9][a-z0-9._-]{1,62}$/;
const MAX_OBJETO = 10 * 1024 * 1024;

function rutaStorage(raiz, bucket, ruta) {
    const segs = ruta.split('/');
    if (!RE_BUCKET.test(bucket) || segs.some((s) => s === '' || s === '.' || s === '..' || /[\0\\]/.test(s))) return null;
    return path.join(raiz, bucket, ...segs);
}

/** Politica del bucket privado de la app (0090_storage_policies.sql): solo service_role. */
function permiso(claims, bucket) {
    if (!claims) return false;
    if (claims.role === 'service_role') return true;
    if (claims.role === 'authenticated') return bucket !== (process.env.STUB_PRIVATE_BUCKET || 'susan-private');
    return false;
}

async function manejarStorage(req, res, url, ctx) {
    const resto = url.pathname.slice('/storage/v1'.length);
    const dec = (s) => s.split('/').map(decodeURIComponent).join('/');
    const metodo = req.method;
    const obtenerClaims = () => {
        const v = verificarJwt(bearer(req) || req.headers.apikey);
        return v.ok ? v.claims : null;
    };
    const denegar = () => storageError(res, 400, 403, 'Unauthorized', 'new row violates row-level security policy');

    // GET /object/sign/<bucket>/<path>?token=  (publico: la autoridad es el token)
    let m = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(resto);
    if (m && metodo === 'GET') {
        const [bucket, ruta] = [decodeURIComponent(m[1]), dec(m[2])];
        const v = verificarJwt(url.searchParams.get('token'));
        if (!v.ok || v.claims.url !== `${bucket}/${ruta}`) return storageError(res, 400, 400, 'InvalidJWT', v.ok ? 'invalid signature' : 'jwt expired or invalid');
        return servirObjeto(res, ctx.raiz, bucket, ruta);
    }
    // POST /object/sign/<bucket>/<path>  { expiresIn }
    if (m && metodo === 'POST') {
        const [bucket, ruta] = [decodeURIComponent(m[1]), dec(m[2])];
        if (!permiso(obtenerClaims(), bucket)) return denegar();
        const cuerpo = (await leerJson(req)) || {};
        const dur = Number(cuerpo.expiresIn);
        if (!Number.isFinite(dur) || dur <= 0) return storageError(res, 400, 400, 'invalid_request', 'expiresIn must be a positive number');
        const archivo = rutaStorage(ctx.raiz, bucket, ruta);
        const st = archivo && (await fs.stat(archivo).catch(() => null));
        if (!st?.isFile()) return storageError(res, 400, 404, 'not_found', 'Object not found');
        const ahora = Math.floor(Date.now() / 1000);
        const token = firmarJwt({ url: `${bucket}/${ruta}`, iat: ahora, exp: ahora + Math.floor(dur) });
        return responder(res, 200, { signedURL: `/object/sign/${bucket}/${ruta.split('/').map(encodeURIComponent).join('/')}?token=${token}` });
    }
    // DELETE /object/<bucket>  { prefixes: [...] }
    m = /^\/object\/([^/]+)$/.exec(resto);
    if (m && metodo === 'DELETE') {
        const bucket = decodeURIComponent(m[1]);
        if (!permiso(obtenerClaims(), bucket)) return denegar();
        const cuerpo = (await leerJson(req)) || {};
        if (!Array.isArray(cuerpo.prefixes)) return storageError(res, 400, 400, 'invalid_request', 'prefixes must be an array');
        const quitados = [];
        for (const p of cuerpo.prefixes) {
            const archivo = rutaStorage(ctx.raiz, bucket, p);
            if (!archivo) continue;
            if (await fs.unlink(archivo).then(() => true, () => false)) {
                quitados.push({ id: crypto.randomUUID(), name: p, bucket_id: bucket, owner: '', metadata: null });
            }
        }
        return responder(res, 200, quitados);
    }
    // GET /object/authenticated/<bucket>/<path>  (download) | GET /object/<bucket>/<path>
    m = /^\/object\/(?:authenticated\/)?([^/]+)\/(.+)$/.exec(resto);
    if (m && metodo === 'GET') {
        const [bucket, ruta] = [decodeURIComponent(m[1]), dec(m[2])];
        if (!permiso(obtenerClaims(), bucket)) return denegar();
        return servirObjeto(res, ctx.raiz, bucket, ruta);
    }
    // POST|PUT /object/<bucket>/<path>  (upload / update)
    if (m && (metodo === 'POST' || metodo === 'PUT')) {
        const [bucket, ruta] = [decodeURIComponent(m[1]), dec(m[2])];
        if (!permiso(obtenerClaims(), bucket)) return denegar();
        const archivo = rutaStorage(ctx.raiz, bucket, ruta);
        if (!archivo) return storageError(res, 400, 400, 'InvalidKey', 'Invalid key');
        let cuerpo;
        try {
            cuerpo = await leerCuerpo(req, MAX_OBJETO + 1024 * 1024);
        } catch {
            return storageError(res, 413, 413, 'Payload too large', 'The object exceeded the maximum allowed size');
        }
        const tipo = req.headers['content-type'] || '';
        let bytes = cuerpo;
        if (/^multipart\/form-data/i.test(tipo)) {
            // supabase-js con Blob/File: FormData { cacheControl, '': archivo }
            const fd = await new Response(cuerpo, { headers: { 'content-type': tipo } }).formData();
            const parte = fd.get('') ?? [...fd.values()].find((x) => typeof x !== 'string');
            if (!parte || typeof parte === 'string') return storageError(res, 400, 400, 'invalid_request', 'Missing file');
            bytes = Buffer.from(await parte.arrayBuffer());
        }
        if (bytes.length > MAX_OBJETO) return storageError(res, 413, 413, 'Payload too large', 'The object exceeded the maximum allowed size');
        const upsert = metodo === 'PUT' || String(req.headers['x-upsert']).toLowerCase() === 'true';
        await fs.mkdir(path.dirname(archivo), { recursive: true });
        if (!upsert && (await fs.stat(archivo).catch(() => null))) {
            return storageError(res, 400, 409, 'Duplicate', 'The resource already exists');
        }
        await fs.writeFile(archivo, bytes);
        return responder(res, 200, { Id: crypto.randomUUID(), Key: `${bucket}/${ruta}` });
    }
    return storageError(res, 404, 404, 'not_found', `Path ${resto} not found`);
}

async function servirObjeto(res, raiz, bucket, ruta) {
    const archivo = rutaStorage(raiz, bucket, ruta);
    const datos = archivo && (await fs.readFile(archivo).catch(() => null));
    if (!datos) return storageError(res, 400, 404, 'not_found', 'Object not found');
    const ext = path.extname(ruta).toLowerCase();
    const tipo = { '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf' }[ext] || 'application/octet-stream';
    return responder(res, 200, datos, { 'content-type': tipo, 'cache-control': 'max-age=3600', 'content-length': String(datos.length) });
}

// ---- Servidor ---------------------------------------------------------------------------------
export const stubEstado = { recuperaciones: [], peticiones: [] };

/**
 * Arranca el stub. Devuelve { url, server, cerrar() }.
 * @param {{ puerto?: number, hostname?: string, raizStorage?: string, modulos?: { auth: object, rpc: object } }} [opciones]
 */
export async function iniciarStub({ puerto = PUERTO_STUB, hostname = '127.0.0.1', raizStorage, modulos } = {}) {
    // `modulos` ({ auth, rpc }) permite inyectar los modulos locales ya cargados (vitest los resuelve con su alias '@').
    if (!modulos) registrarAlias();
    const mods = modulos || {
        auth: await import(pathToFileURL(path.join(SRC, 'lib/local/auth.js')).href),
        rpc: await import(pathToFileURL(path.join(SRC, 'lib/local/rpc.js')).href),
    };
    const raiz = raizStorage || process.env.STUB_STORAGE_DIR || (await fs.mkdtemp(path.join(os.tmpdir(), 'fake-supabase-')));
    const ctx = { raiz };
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || 'stub'}`);
        stubEstado.peticiones.push(`${req.method} ${url.pathname}`);
        if (stubEstado.peticiones.length > 5000) stubEstado.peticiones.shift();
        try {
            if (req.method === 'OPTIONS') return responder(res, 204, undefined);
            if (url.pathname === '/__stub/ttl' && req.method === 'POST') {
                ttlSeg = Math.max(1, Number(url.searchParams.get('seconds')) || 3600);
                return responder(res, 200, { ttl: ttlSeg });
            }
            if (url.pathname === '/__stub/log') return responder(res, 200, { peticiones: stubEstado.peticiones, recuperaciones: stubEstado.recuperaciones });
            if (url.pathname === '/__stub/sesiones') return responder(res, 200, { sesiones: sesiones.size, refresh: refresh.size });
            if (url.pathname.startsWith('/auth/v1/')) return await manejarAuth(req, res, url, mods);
            if (url.pathname.startsWith('/rest/v1/')) return await manejarRest(req, res, url, mods);
            if (url.pathname.startsWith('/storage/v1/')) return await manejarStorage(req, res, url, ctx);
            return responder(res, 404, { message: 'not found' });
        } catch (e) {
            console.error('[fake-supabase]', e);
            return responder(res, 500, { message: 'stub error', details: String(e?.message || e) });
        }
    });
    await new Promise((ok, fail) => {
        server.once('error', fail);
        server.listen(puerto, hostname, ok);
    });
    const dir = server.address();
    return {
        url: `http://${hostname}:${dir.port}`,
        server,
        raizStorage: raiz,
        ajustarTtl: (s) => { ttlSeg = s; },
        async cerrar() {
            server.closeAllConnections?.();
            await new Promise((ok) => server.close(ok));
            if (modulos) return; // quien inyecta los modulos cierra su propio pool
            const { cerrarPool } = await import(pathToFileURL(path.join(SRC, 'lib/local/pool.js')).href);
            await cerrarPool();
        },
    };
}

// ---- CLI --------------------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.includes('--print-keys')) {
        const k = llavesProyecto();
        console.log(`ANON_KEY=${k.anon}\nSERVICE_ROLE_KEY=${k.service_role}`);
    } else {
        const s = await iniciarStub();
        console.log(`[fake-supabase] escuchando en ${s.url} (storage: ${s.raizStorage}, BD: ${process.env.LOCAL_DATABASE_URL || 'por omision'})`);
        const salir = async () => { await s.cerrar(); process.exit(0); };
        process.on('SIGTERM', salir);
        process.on('SIGINT', salir);
    }
}
