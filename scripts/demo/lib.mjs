// Utilidades comunes de los scripts de la demostración (SOLO modo local). Las usa scripts/demo/seed-demo.mjs.
//
// Dependencias: ninguna fuera del proyecto. `pg` se toma de web/node_modules (como hace scripts/seed-auth-users.mjs con
// supabase-js) y las funciones puras de web/src/lib/demo/*.js se cargan como módulos sueltos.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BUCKET = 'susan-private';
export const CUENTAS = Object.freeze({
    admin: 'admin@susan.local',
    tecnico: 'tecnico@susan.local',
    docente1: 'docente1@susan.local',
});

const require = createRequire(path.join(RAIZ, 'web', 'package.json'));
export const pg = require('pg');

// ---------------------------------------------------------------------------------------------------- registro
export const log = (texto) => console.log(`[demo] ${texto}`);
export const aviso = (texto) => console.warn(`[demo] AVISO: ${texto}`);

export class ErrorDemo extends Error {}
export const fallar = (texto) => {
    throw new ErrorDemo(texto);
};

// ---------------------------------------------------------------------------------------------------- entorno
const LOCALES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/** Configuración desde el entorno, con los mismos valores por omisión que scripts/dev-all.sh. */
export function entorno(env = process.env) {
    const dirLocal = env.SUSAN_LOCAL_DIR;
    if (!dirLocal) fallar('Falta SUSAN_LOCAL_DIR: ejecuta el script con scripts/seed-demo.sh (que lo calcula).');
    const bdUrl = env.LOCAL_DATABASE_URL
        || `postgres://127.0.0.1:${env.SUSAN_PGPORT || 54329}/${env.SUSAN_DB || 'susan'}`;
    return {
        dirLocal,
        raizStorage: path.join(env.LOCAL_STORAGE_DIR || path.join(dirLocal, 'storage'), BUCKET),
        bdUrl,
        web: `http://localhost:${env.WEB_PORT || 3000}`,
        servicio: `http://127.0.0.1:${env.RECOGNITION_PORT || 8000}`,
        claveServicio: env.RECOGNITION_SERVICE_API_KEY || 'dev-local-key',
        // Ancla del escenario: el mismo reloj que scripts/dev-all.sh fija para la web ('off' = reloj real en la web, pero
        // el guion de la demostración siempre se narra en este instante).
        ahora: env.SUSAN_FAKE_NOW && env.SUSAN_FAKE_NOW !== 'off' ? env.SUSAN_FAKE_NOW : '2026-09-14 07:12:00-06',
    };
}

/** Conecta a la base local y se niega a seguir si no es una base de demostración local. */
export async function conectar(cfg) {
    let host;
    try {
        host = new URL(cfg.bdUrl).hostname;
    } catch {
        fallar('LOCAL_DATABASE_URL no es una URL válida.');
    }
    if (!LOCALES.has(host)) fallar(`La demostración solo corre contra una base local (host ${host}).`);
    const cliente = new pg.Client({ connectionString: cfg.bdUrl });
    await cliente.connect();
    // El reloj simulado solo existe en bases locales (db-common.sh lo habilita con ALTER DATABASE ... SET). Si falta,
    // esto no es la base de desarrollo y NO se toca: los datos de la demostración nunca van a otro entorno.
    const { rows } = await cliente.query(`
        SELECT count(*)::int AS n
          FROM pg_db_role_setting s JOIN pg_database d ON d.oid = s.setdatabase
         WHERE d.datname = current_database() AND s.setrole = 0 AND s.setconfig @> ARRAY['app.allow_fake_clock=on']`);
    if (rows[0].n === 0) {
        await cliente.end();
        fallar('Esta base no tiene habilitado el reloj de demostración (app.allow_fake_clock): no es la base local de desarrollo.');
    }
    await cliente.query("SELECT set_config('app.fake_now', $1, false)", [cfg.ahora]);
    return cliente;
}

/**
 * Archivo de estado del reloj de demostración de la web (web/src/lib/local/reloj.js, docs/DEMO-RELOJ.md). Borrarlo es lo
 * mismo que pulsar «Restablecer»: la web vuelve a LOCAL_FAKE_NOW (lunes 14-sep-2026 07:12), detenido.
 */
export const archivoRelojDemo = (cfg, env = process.env) => (
    env.LOCAL_CLOCK_FILE ? path.resolve(env.LOCAL_CLOCK_FILE) : path.join(cfg.dirLocal, 'run', 'fake_now'));

/** Fija el instante de app.now() para lo que se ejecute a continuación en esta conexión. */
export const fijarReloj = (cliente, instante) => cliente.query("SELECT set_config('app.fake_now', $1, false)", [instante]);

// ---------------------------------------------------------------------------------------------------- módulos puros
/** Importa un módulo sin dependencias de web/src/lib/demo (sin '@/' ni "type": "module" de por medio). */
export async function cargarModulo(nombre) {
    const fuente = fs.readFileSync(path.join(RAIZ, 'web', 'src', 'lib', 'demo', nombre), 'utf8');
    return import(`data:text/javascript;base64,${Buffer.from(fuente, 'utf8').toString('base64')}`);
}

// ---------------------------------------------------------------------------------------------------- RPC
const RE_FUNCION = /^(api|svc)_[a-z0-9_]+$/;
const RE_ARGUMENTO = /^p_[a-z0-9_]+$/;

/**
 * Ejecuta una RPC api_* como lo hace el adaptador local de la web (web/src/lib/local/rpc.js): transacción,
 * `SET LOCAL ROLE authenticated` y los claims del usuario. Así corren las mismas reglas y la misma RLS que en la app.
 * @param {pg.Client} cliente
 * @param {string} correo cuenta con la que se actúa
 * @param {string} funcion api_*
 * @param {Record<string, any>} args llaves p_*; los objetos/arreglos jsonb deben venir ya como JSON.stringify
 * @param {{ ahora?: string }} [opciones] ahora = valor de app.fake_now solo para esta llamada
 */
export async function rpcComo(cliente, correo, funcion, args = {}, { ahora } = {}) {
    if (!RE_FUNCION.test(funcion)) fallar(`Nombre de función no permitido: ${funcion}`);
    const llaves = Object.keys(args);
    if (!llaves.every((k) => RE_ARGUMENTO.test(k))) fallar('Nombre de argumento no permitido.');
    await cliente.query('BEGIN');
    try {
        const { rows } = await cliente.query('SELECT auth_uid::text AS uid FROM usuario WHERE correo = $1', [correo]);
        if (!rows[0]) fallar(`No existe la cuenta ${correo}.`);
        const claims = { sub: rows[0].uid, role: 'authenticated', aud: 'authenticated', email: correo };
        await cliente.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
        if (ahora) await cliente.query("SELECT set_config('app.fake_now', $1, true)", [ahora]);
        await cliente.query('SET LOCAL ROLE authenticated');
        const asignaciones = llaves.map((k, i) => `${k} => $${i + 1}`).join(', ');
        const { rows: salida } = await cliente.query(`SELECT public.${funcion}(${asignaciones}) AS r`, llaves.map((k) => args[k]));
        await cliente.query('COMMIT');
        return salida[0].r;
    } catch (e) {
        await cliente.query('ROLLBACK');
        throw e;
    }
}

// ---------------------------------------------------------------------------------------------------- HTTP
/** Contraseña de DESARROLLO de las cuentas locales: la que fija la propia semilla (supabase/seed/10_local_auth.sql). */
export function claveDeDesarrollo(env = process.env) {
    if (env.SUSAN_DEMO_PASSWORD) return env.SUSAN_DEMO_PASSWORD;
    const sql = fs.readFileSync(path.join(RAIZ, 'supabase', 'seed', '10_local_auth.sql'), 'utf8');
    const m = /crypt\('([^']+)'/.exec(sql);
    if (!m) fallar('No se encontró la contraseña de desarrollo en supabase/seed/10_local_auth.sql (define SUSAN_DEMO_PASSWORD).');
    return m[1];
}

/** Inicia sesión por la ruta local de la web y devuelve la cabecera Cookie para las siguientes llamadas. */
export async function iniciarSesion(cfg, correo) {
    const res = await fetch(`${cfg.web}/api/_local/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: cfg.web },
        body: JSON.stringify({ email: correo, password: claveDeDesarrollo() }),
        signal: AbortSignal.timeout(120_000),
    });
    const cuerpo = await res.json().catch(() => null);
    if (!res.ok || cuerpo?.error) fallar(`No se pudo iniciar sesión como ${correo} (HTTP ${res.status}).`);
    const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('susan_local_session='));
    if (!cookie) fallar('La web no entregó la cookie de sesión.');
    return cookie;
}

/**
 * Llamada a una ruta de la web con la sesión dada. Devuelve { status, cuerpo }; no lanza por un HTTP de error.
 * @param {{ metodo?: string, json?: any, form?: FormData, timeoutMs?: number }} [opciones]
 */
export async function llamarWeb(cfg, cookie, ruta, { metodo = 'GET', json, form, timeoutMs = 300_000 } = {}) {
    // Origin = la propia web: las rutas con efectos lo exigen (defensa CSRF de verificarOrigen y de /api/_local/*).
    const headers = { cookie, origin: cfg.web };
    let body;
    if (json !== undefined) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(json);
    } else if (form) {
        body = form;
    }
    const res = await fetch(`${cfg.web}${ruta}`, { method: metodo, headers, body, signal: AbortSignal.timeout(timeoutMs) });
    const cuerpo = await res.json().catch(() => null);
    return { status: res.status, cuerpo };
}

/** Llamada al servicio de reconocimiento (con su clave de desarrollo). */
export async function llamarServicio(cfg, ruta, { metodo = 'GET', form, timeoutMs = 30_000 } = {}) {
    const res = await fetch(`${cfg.servicio}${ruta}`, {
        method: metodo,
        headers: { 'X-API-Key': cfg.claveServicio },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
    });
    const cuerpo = await res.json().catch(() => null);
    return { status: res.status, cuerpo };
}

// ---------------------------------------------------------------------------------------------------- archivos
/** UUID con forma válida y estable (md5 de una semilla de texto): una ruta de objeto no cambia entre ejecuciones. */
export function uuidDeterminista(texto) {
    const h = crypto.createHash('md5').update(texto).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Ruta absoluta de un objeto del bucket local; null si la ruta intenta salir de la raíz. */
export function rutaEnDisco(cfg, ruta) {
    const destino = path.resolve(cfg.raizStorage, ruta);
    return destino.startsWith(cfg.raizStorage + path.sep) ? destino : null;
}

export const existeObjeto = (cfg, ruta) => {
    const destino = rutaEnDisco(cfg, ruta);
    return Boolean(destino) && fs.existsSync(destino);
};

/** Escribe un objeto del bucket (atómico). Devuelve true si lo escribió y false si ya existía y no se pidió sobrescribir. */
export function escribirObjeto(cfg, ruta, bytes, { sobrescribir = false } = {}) {
    const destino = rutaEnDisco(cfg, ruta);
    if (!destino) fallar('Ruta de objeto no válida.');
    if (!sobrescribir && fs.existsSync(destino)) return false;
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    const tmp = `${destino}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, destino);
    return true;
}

/**
 * Dibuja JPEG de rostros sintéticos con el Python del venv de recognition-service (Pillow + numpy, y el propio código
 * del embedder fake para el color). Cada elemento: { destino (absoluta), semilla, tipo: 'registro' | 'recorte' }.
 * @returns {{ escritas: number, omitidas: number }}
 */
export function renderizarRostros(imagenes) {
    if (imagenes.length === 0) return { escritas: 0, omitidas: 0 };
    const servicio = path.join(RAIZ, 'recognition-service');
    const python = ['.venv.nosync', '.venv'].map((d) => path.join(servicio, d, 'bin', 'python')).find((p) => fs.existsSync(p));
    if (!python) fallar('No hay venv del servicio de reconocimiento (recognition-service/.venv.nosync): ejecuta scripts/dev-all.sh una vez.');
    const r = spawnSync(python, [path.join(RAIZ, 'scripts', 'demo', 'render_rostros.py')], {
        input: JSON.stringify({ imagenes }),
        encoding: 'utf8',
        cwd: servicio,
        maxBuffer: 64 * 1024 * 1024,
    });
    if (r.status !== 0) fallar(`Fallo el dibujo de rostros: ${(r.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
    return JSON.parse(r.stdout);
}
