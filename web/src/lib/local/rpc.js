// Ejecutor de RPC del modo local: misma semantica que PostgREST sobre PostgreSQL directo.
//   BEGIN; SET LOCAL ROLE <authenticated|service_role>; set_config('request.jwt.claims', ..., true);
//   SELECT * FROM public."fn"("p_x" => $1, ...); COMMIT
// El nombre de la funcion y las llaves de los argumentos jamas se interpolan sin validar: se exige
// el patron, y ademas que existan en pg_proc (lista blanca consultada a la propia base).
import pg from 'pg';
import { obtenerPool } from './pool.js';
import { esUuid } from './session.js';

const RE_NOMBRE = /^(api|svc)_[a-z0-9_]+$/;
// `p` solo (sin guion bajo) existe: las RPC de guardado reciben un unico jsonb llamado `p`.
const RE_ARG = /^p(_[a-z0-9_]+)?$/;
const ROLES = new Set(['authenticated', 'service_role']);
const TTL_FUNCIONES_MS = 60_000;
const TIMEOUT_SENTENCIA = '30s';

// Parsers de resultado: PostgREST entrega bigint/numeric como numero JSON y fechas como texto ISO.
// Con el parser por omision de pg las fechas serian Date (zona local) y los bigint cadenas.
const TIPOS_TEXTO = new Set([1082, 1083, 1114, 1184, 1186, 1266]);
const TIPOS_NUMERO = new Set([20, 1700]);
const tiposResultado = {
    getTypeParser(oid, formato) {
        if (TIPOS_NUMERO.has(oid)) return (v) => Number(v);
        if (TIPOS_TEXTO.has(oid)) return (v) => v;
        return pg.types.getTypeParser(oid, formato);
    },
};

export function errorRpc(message, code, hint = null, details = null) {
    return { message, code, details, hint };
}

/** Convierte un error de pg (DatabaseError) a la forma de supabase-js. */
export function errorDePg(e) {
    if (e && typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) {
        return errorRpc(e.message, e.code, e.hint ?? null, e.detail ?? null);
    }
    if (e && (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT')) {
        return errorRpc('No se pudo conectar a la base de datos local (scripts/db-up.sh).', 'LOCAL_DB_NO_DISPONIBLE');
    }
    return errorRpc(e?.message || 'Error interno del adaptador local', 'LOCAL_ERROR');
}

// ---- Catalogo de funciones (lista blanca) --------------------------------------------------
let cacheFunciones = { mapa: null, hasta: 0 };

async function cargarFunciones() {
    const { rows } = await obtenerPool().query(`
        SELECT p.proname AS nombre,
               p.proargnames AS argnames,
               ARRAY(SELECT format_type(u.t, NULL)
                       FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS u(t, n)
                      ORDER BY u.n) AS argtypes,
               p.proretset AS es_set,
               format_type(p.prorettype, NULL) AS retorno
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND (p.proname LIKE 'api\\_%' OR p.proname LIKE 'svc\\_%')`);
    const mapa = new Map();
    for (const r of rows) {
        // Sin sobrecargas en SUSAN; si algun dia las hubiera, gana la primera.
        if (!mapa.has(r.nombre)) {
            mapa.set(r.nombre, {
                argnames: r.argnames || [],
                argtypes: r.argtypes || [],
                esSet: r.es_set,
                retorno: r.retorno,
            });
        }
    }
    cacheFunciones = { mapa, hasta: Date.now() + TTL_FUNCIONES_MS };
    return mapa;
}

async function buscarFuncion(nombre) {
    let mapa = cacheFunciones.mapa;
    if (!mapa || Date.now() > cacheFunciones.hasta) mapa = await cargarFunciones();
    if (!mapa.has(nombre)) mapa = await cargarFunciones(); // migracion nueva desde la ultima carga
    return mapa.get(nombre) || null;
}

/** Fuerza a volver a leer pg_proc (pruebas / despues de aplicar migraciones). */
export function invalidarCatalogo() {
    cacheFunciones = { mapa: null, hasta: 0 };
}

// ---- Conversion de argumentos --------------------------------------------------------------
function convertirArg(valor, tipo) {
    if (valor === null) return null;
    if (valor instanceof Date) return valor.toISOString();
    if (/json/.test(tipo)) return JSON.stringify(valor); // incluso cadenas: un jsonb de texto lleva comillas
    if (tipo.endsWith('[]')) return Array.isArray(valor) ? valor : [valor];
    if (typeof valor === 'object') return JSON.stringify(valor);
    return valor;
}

/**
 * Ejecuta una RPC.
 * @param {string} nombre api_* o svc_*
 * @param {object} args llaves `p_*` -> valor (las mismas que acepta supabase.rpc)
 * @param {{ rol?: 'authenticated'|'service_role', claims?: { sub?: string, email?: string } }} contexto
 * @returns {Promise<{ data: any, error: null | { message, code, details, hint } }>}
 */
export async function ejecutarRpc(nombre, args, contexto = {}) {
    const rol = contexto.rol || 'authenticated';
    if (!ROLES.has(rol)) return { data: null, error: errorRpc('Rol no permitido.', '42501') };
    if (typeof nombre !== 'string' || !RE_NOMBRE.test(nombre)) {
        return { data: null, error: errorRpc('Nombre de funcion no permitido.', 'PGRST202') };
    }
    if (args === undefined || args === null) args = {};
    if (typeof args !== 'object' || Array.isArray(args)) {
        return { data: null, error: errorRpc('Los argumentos deben ser un objeto.', 'PGRST100') };
    }
    const llaves = Object.keys(args).filter((k) => args[k] !== undefined);
    for (const k of llaves) {
        if (!RE_ARG.test(k)) return { data: null, error: errorRpc('Nombre de argumento no permitido.', 'PGRST202') };
    }

    // Sin usuario no hay RPC de `authenticated`: PostgREST caeria a anon y negaria el EXECUTE.
    const claims = { role: rol, aud: rol === 'authenticated' ? 'authenticated' : undefined };
    if (rol === 'authenticated') {
        if (!esUuid(contexto.claims?.sub)) {
            return {
                data: null,
                error: errorRpc('Se requiere una sesion valida.', '42501', 'NO_AUTENTICADO'),
            };
        }
        claims.sub = contexto.claims.sub;
        if (contexto.claims.email) claims.email = String(contexto.claims.email);
    }

    let cliente;
    try {
        const meta = await buscarFuncion(nombre);
        if (!meta) return { data: null, error: errorRpc(`No existe la funcion ${nombre}.`, 'PGRST202') };
        const valores = [];
        const asignaciones = [];
        for (const k of llaves) {
            const pos = meta.argnames.indexOf(k);
            if (pos < 0) {
                return { data: null, error: errorRpc(`La funcion ${nombre} no tiene el argumento ${k}.`, 'PGRST202') };
            }
            valores.push(convertirArg(args[k], meta.argtypes[pos] || ''));
            asignaciones.push(`"${k}" => $${valores.length}`);
        }

        cliente = await obtenerPool().connect();
        await cliente.query('BEGIN');
        // rol validado contra la lista cerrada ROLES: es seguro interpolarlo.
        await cliente.query(`SET LOCAL ROLE ${rol}`);
        await cliente.query(`SET LOCAL statement_timeout = '${TIMEOUT_SENTENCIA}'`);
        await cliente.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
        // Reloj de demostracion (solo surte efecto si la BD tiene app.allow_fake_clock = 'on').
        const falso = process.env.LOCAL_FAKE_NOW;
        if (falso) await cliente.query("SELECT set_config('app.fake_now', $1, true)", [falso]);

        const res = await cliente.query({
            text: `SELECT * FROM public."${nombre}"(${asignaciones.join(', ')})`,
            values: valores,
            types: tiposResultado,
        });
        await cliente.query('COMMIT');

        return { data: aDato(nombre, meta, res), error: null };
    } catch (e) {
        if (cliente) await cliente.query('ROLLBACK').catch(() => {});
        return { data: null, error: errorDePg(e) };
    } finally {
        if (cliente) cliente.release();
    }
}

// setof -> arreglo; jsonb/json/escalar -> valor; void -> null; composite -> fila(s) como objeto.
function aDato(nombre, meta, res) {
    if (meta.retorno === 'void') return null;
    const envuelto = res.fields.length === 1 && res.fields[0].name === nombre;
    if (meta.esSet) return envuelto ? res.rows.map((r) => r[nombre]) : res.rows;
    if (res.rows.length === 0) return null;
    return envuelto ? res.rows[0][nombre] : res.rows[0];
}
