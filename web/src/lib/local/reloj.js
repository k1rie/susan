// Reloj de demostracion del modo local (SOLO desarrollo). Decide que instante simulado se le entrega a
// PostgreSQL en cada RPC (app.fake_now; la base solo lo honra si tiene app.allow_fake_clock = 'on').
//
// Por que existe: con el reloj fijo en una variable de entorno que se lee al arrancar Next, la tolerancia de la
// sesion nunca terminaba y no se podian probar retardos ni el cierre. Aqui el instante vive en un archivo que se
// cambia sin reiniciar nada (handler /api/_local/reloj y componente RelojDemo).
//
// Dos modos, ambos persistentes en ${SUSAN_LOCAL_DIR}/run/fake_now:
//   - CONGELADO (por omision): el tiempo no avanza solo; cada RPC ve el mismo instante hasta que alguien lo mueve.
//   - CORRIENDO: el instante avanza en tiempo real desde el ancla. Hace falta para el muestreo de la camara:
//     la captura exige una marca_tiempo distinta por muestra, y con el reloj congelado todas colisionarian.
//
// Sin archivo, el instante es LOCAL_FAKE_NOW congelado (el comportamiento de siempre). Sin LOCAL_FAKE_NOW (o con
// 'off') el reloj de demostracion esta apagado y se usa el real: ningun archivo lo enciende por su cuenta, para que
// un estado viejo no resucite una demostracion que se arranco con reloj real. Tampoco existe fuera del modo local
// (sin SUSAN_LOCAL=1 o con NODE_ENV=production): lo consulta lib/server/captura.js, que si corre en produccion.
//
// Modulo de SERVIDOR (usa fs). Es sincrono a proposito: un stat por RPC cuesta microsegundos y asi tambien lo
// pueden llamar las rutas que solo necesitan "la hora de negocio" (ahoraDeNegocio) sin volverse asincronas.
import fs from 'node:fs';
import path from 'node:path';
import { serverEnv } from '@/config';

/** La sede (Chiapas) no tiene horario de verano desde 2022: el desfase es fijo. */
export const OFFSET_SEDE_MIN = -360;
export const ZONA_SEDE = 'America/Mexico_City';
/** Tope de un solo salto relativo; para ir mas lejos se usa `fijar`. */
export const MAX_AVANCE_MIN = 7 * 24 * 60;
const MS_POR_MIN = 60_000;
// Los anios 2000-2099 se miden en hora de la sede (1-ene-2000 00:00 -06 = 06:00 UTC), no en UTC.
export const LIMITE_INFERIOR_MS = Date.UTC(2000, 0, 1) - OFFSET_SEDE_MIN * MS_POR_MIN;
export const LIMITE_SUPERIOR_MS = Date.UTC(2100, 0, 1) - OFFSET_SEDE_MIN * MS_POR_MIN;

/** Error de negocio del reloj; `code` lo traduce el handler a un estatus HTTP. */
export class ErrorReloj extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'ErrorReloj';
        this.code = code;
    }
}

// ---- Formato ----------------------------------------------------------------------------------
const dos = (n) => String(n).padStart(2, '0');

function sufijoOffset(min, conDosPuntos) {
    const signo = min < 0 ? '-' : '+';
    const abs = Math.abs(min);
    const mm = abs % 60;
    // PostgreSQL acepta '-06'; ISO 8601 pide '-06:00'.
    if (mm === 0 && !conDosPuntos) return `${signo}${dos(Math.floor(abs / 60))}`;
    return `${signo}${dos(Math.floor(abs / 60))}:${dos(mm)}`;
}

/** { fecha: 'AAAA-MM-DD', hora: 'HH:MM:SS', milis } del instante en hora de la sede. */
export function partesSede(ms) {
    const d = new Date(ms + OFFSET_SEDE_MIN * MS_POR_MIN);
    return {
        fecha: `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`,
        hora: `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}:${dos(d.getUTCSeconds())}`,
        milis: d.getUTCMilliseconds(),
    };
}

const fraccion = (milis) => (milis ? `.${String(milis).padStart(3, '0')}` : '');

/** '2026-09-14 07:12:00-06': el formato de LOCAL_FAKE_NOW y de app.fake_now. */
export function formatearSql(ms) {
    const { fecha, hora, milis } = partesSede(ms);
    return `${fecha} ${hora}${fraccion(milis)}${sufijoOffset(OFFSET_SEDE_MIN, false)}`;
}

/** '2026-09-14T07:12:00-06:00': ISO 8601 con la zona de la sede. */
export function formatearIso(ms) {
    const { fecha, hora, milis } = partesSede(ms);
    return `${fecha}T${hora}${fraccion(milis)}${sufijoOffset(OFFSET_SEDE_MIN, true)}`;
}

// ---- Lectura de texto ---------------------------------------------------------------------------
// AAAA-MM-DD[ T]HH:MM[:SS[.mmm]][Z|+-HH[[:]MM]]; sin zona se entiende hora de la sede.
const RE_INSTANTE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/**
 * Texto -> milisegundos UTC, o null si no es una fecha/hora real (rechaza 2026-02-31, 25:00, etc.).
 * @param {string} texto
 * @returns {number | null}
 */
export function parsearInstante(texto) {
    if (typeof texto !== 'string') return null;
    const m = RE_INSTANTE.exec(texto.trim());
    if (!m) return null;
    const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const hora = Number(m[4] ?? 0);
    const min = Number(m[5] ?? 0);
    const seg = Number(m[6] ?? 0);
    const milis = Number((m[7] ?? '0').slice(0, 3).padEnd(3, '0'));
    if (mes < 1 || mes > 12 || hora > 23 || min > 59 || seg > 59) return null;
    const local = Date.UTC(anio, mes - 1, dia, hora, min, seg, milis);
    const d = new Date(local);
    // Date.UTC "desborda" (31 de febrero -> marzo): se exige que el dia sobreviva al viaje de ida y vuelta.
    if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;

    let offsetMin = OFFSET_SEDE_MIN;
    const zona = m[8];
    if (zona) {
        if (zona.toUpperCase() === 'Z') {
            offsetMin = 0;
        } else {
            const signo = zona[0] === '-' ? -1 : 1;
            const digitos = zona.slice(1).replace(':', '');
            const hh = Number(digitos.slice(0, 2));
            const mm = Number(digitos.slice(2) || 0);
            if (hh > 14 || mm > 59) return null;
            offsetMin = signo * (hh * 60 + mm);
        }
    }
    return local - offsetMin * MS_POR_MIN;
}

const enRango = (ms) => Number.isFinite(ms) && ms >= LIMITE_INFERIOR_MS && ms < LIMITE_SUPERIOR_MS;

// ---- Configuracion y archivo --------------------------------------------------------------------
let avisoConfig = false;

/** Valor inicial (LOCAL_FAKE_NOW) o null si el reloj de demostracion esta apagado. */
function configInicial() {
    // Solo desarrollo local: en produccion, o sin SUSAN_LOCAL=1, el reloj de demostracion esta apagado aunque LOCAL_FAKE_NOW haya
    // quedado puesto (una variable copiada de dev-all.sh o de .env.local). Misma regla que soloLocal() de /api/_local/*. Se lee
    // process.env en cada llamada (no la constante IS_LOCAL) para que las pruebas puedan cambiarla.
    const esLocal = process.env.SUSAN_LOCAL === '1' || process.env.NEXT_PUBLIC_SUSAN_LOCAL === '1';
    if (!esLocal || process.env.NODE_ENV === 'production') return null;
    const crudo = String(process.env.LOCAL_FAKE_NOW ?? '').trim();
    if (!crudo || crudo.toLowerCase() === 'off') return null;
    const ms = parsearInstante(crudo);
    if (ms === null || !enRango(ms)) {
        if (!avisoConfig) {
            avisoConfig = true;
            console.warn('[local] LOCAL_FAKE_NOW no es una fecha valida (AAAA-MM-DD HH:MM[:SS][zona]); el reloj de demostracion queda apagado.');
        }
        return null;
    }
    return { crudo, ms };
}

/** Archivo del estado: ${SUSAN_LOCAL_DIR}/run/fake_now (junto a los PID y bitacoras de scripts/dev-all.sh). */
export function rutaArchivoReloj() {
    const explicita = process.env.LOCAL_CLOCK_FILE;
    if (explicita) return path.resolve(explicita);
    // Sin SUSAN_LOCAL_DIR, el directorio de datos es el padre del storage (dev-all.sh: $SUSAN_LOCAL_DIR/storage).
    const base = process.env.SUSAN_LOCAL_DIR || path.dirname(serverEnv().localStorageDir);
    return path.resolve(base, 'run', 'fake_now');
}

/** Contenido del archivo -> { baseMs, anclaMs } o null. Acepta el JSON propio o una fecha en texto plano (a mano). */
function interpretar(texto) {
    const t = texto.trim();
    if (!t) return null;
    if (t.startsWith('{')) {
        const o = JSON.parse(t);
        const baseMs = Number(o.baseMs);
        const anclaMs = o.anclaMs === null || o.anclaMs === undefined ? null : Number(o.anclaMs);
        if (!enRango(baseMs) || (anclaMs !== null && !Number.isFinite(anclaMs))) return null;
        return { baseMs, anclaMs };
    }
    const ms = parsearInstante(t);
    return ms !== null && enRango(ms) ? { baseMs: ms, anclaMs: null } : null;
}

// Cache por (inodo, mtime, tamano): una RPC normal solo paga el stat. Las escrituras de este modulo son atomicas
// (archivo temporal + rename), asi que cambian el inodo; una edicion a mano cambia el mtime.
let cache = { ruta: null, clave: null, estado: null };

function leerArchivo(ruta) {
    let st;
    try {
        st = fs.statSync(ruta);
    } catch {
        cache = { ruta, clave: 'ausente', estado: null };
        return null;
    }
    const clave = `${st.ino}:${st.mtimeMs}:${st.size}`;
    if (cache.ruta === ruta && cache.clave === clave) return cache.estado;
    let estado = null;
    try {
        estado = interpretar(fs.readFileSync(ruta, 'utf8'));
    } catch {
        estado = null; // JSON roto o ilegible: se ignora y rige el valor inicial
    }
    cache = { ruta, clave, estado };
    return estado;
}

function escribirArchivo(ruta, { baseMs, anclaMs }) {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    const temporal = `${ruta}.${process.pid}.tmp`;
    // `legible` es solo para quien abra el archivo; la lectura usa baseMs/anclaMs.
    const cuerpo = { baseMs, anclaMs, legible: formatearSql(baseMs) };
    try {
        fs.writeFileSync(temporal, `${JSON.stringify(cuerpo)}\n`, 'utf8');
        fs.renameSync(temporal, ruta);
    } catch (e) {
        fs.rmSync(temporal, { force: true }); // no dejar basura si el disco o el destino fallan
        throw e;
    }
    cache = { ruta: null, clave: null, estado: null };
}

/** Instante simulado: congelado en baseMs, o baseMs + lo transcurrido desde el ancla si corre. */
function instanteDe({ baseMs, anclaMs }, ahoraRealMs) {
    return anclaMs === null ? baseMs : baseMs + Math.max(0, ahoraRealMs - anclaMs);
}

// ---- API de lectura -----------------------------------------------------------------------------
/**
 * Estado actual del reloj.
 * @param {{ ahoraRealMs?: number }} [opciones] `ahoraRealMs` solo para pruebas (reloj real inyectable)
 * @returns {{ activo: boolean, corre: boolean, ms: number, inicialMs: number | null, valorSql: string | null }}
 *   `valorSql` es lo que se entrega a app.fake_now (null = reloj real); sin archivo es el LOCAL_FAKE_NOW tal cual.
 */
export function leerReloj({ ahoraRealMs = Date.now() } = {}) {
    const cfg = configInicial();
    if (!cfg) return { activo: false, corre: false, ms: ahoraRealMs, inicialMs: null, valorSql: null };
    const archivo = leerArchivo(rutaArchivoReloj());
    if (!archivo) return { activo: true, corre: false, ms: cfg.ms, inicialMs: cfg.ms, valorSql: cfg.crudo };
    const ms = instanteDe(archivo, ahoraRealMs);
    return { activo: true, corre: archivo.anclaMs !== null, ms, inicialMs: cfg.ms, valorSql: formatearSql(ms) };
}

/** Valor de app.fake_now para esta RPC, o null si no hay reloj de demostracion. Lo llama ejecutarRpc. */
export function valorRelojSql() {
    return leerReloj().valorSql;
}

export const relojDemoActivo = () => leerReloj().activo;

/** La hora de negocio como Date: la simulada si el reloj de demostracion esta activo y, si no, la real. */
export function ahoraDeNegocio() {
    return new Date(leerReloj().ms);
}

/** Forma que expone el handler: { activo, corre, ahora (ISO con zona), fecha, hora, inicial (ISO | null) }. */
export function describirReloj(estado = leerReloj()) {
    const { fecha, hora } = partesSede(estado.ms);
    return {
        activo: estado.activo,
        corre: estado.corre,
        ahora: formatearIso(estado.ms),
        fecha,
        hora,
        inicial: estado.inicialMs === null ? null : formatearIso(estado.inicialMs),
    };
}

// ---- Mutaciones ---------------------------------------------------------------------------------
function exigirActivo() {
    if (!configInicial()) {
        throw new ErrorReloj(
            'RELOJ_NO_ACTIVO',
            'El reloj de demostración está apagado: arranca el modo local con LOCAL_FAKE_NOW (SUSAN_FAKE_NOW en scripts/dev-all.sh).',
        );
    }
}

function exigirRango(ms) {
    if (!enRango(ms)) {
        throw new ErrorReloj('FUERA_DE_RANGO', 'La fecha simulada debe estar entre los años 2000 y 2099.');
    }
}

/** Fija el instante conservando el modo (si corre, sigue corriendo desde el nuevo instante). */
function guardar(ms, corre, ahoraRealMs) {
    exigirRango(ms);
    escribirArchivo(rutaArchivoReloj(), { baseMs: ms, anclaMs: corre ? ahoraRealMs : null });
    return leerReloj({ ahoraRealMs });
}

/** Mueve el reloj `min` minutos (negativo = hacia atras). Entero, |min| <= MAX_AVANCE_MIN. */
export function avanzarReloj(min, { ahoraRealMs = Date.now() } = {}) {
    exigirActivo();
    if (!Number.isInteger(min) || min === 0 || Math.abs(min) > MAX_AVANCE_MIN) {
        throw new ErrorReloj('FUERA_DE_RANGO', `El salto debe ser un entero distinto de cero con valor absoluto de hasta ${MAX_AVANCE_MIN} minutos.`);
    }
    const actual = leerReloj({ ahoraRealMs });
    return guardar(actual.ms + min * MS_POR_MIN, actual.corre, ahoraRealMs);
}

/** Fija el reloj en una fecha y hora de la sede ('AAAA-MM-DD HH:MM[:SS]'; admite 'T' y zona explicita). */
export function fijarReloj(texto, { ahoraRealMs = Date.now() } = {}) {
    exigirActivo();
    const ms = parsearInstante(texto);
    if (ms === null) {
        throw new ErrorReloj('FORMATO_INVALIDO', 'La fecha y hora deben ser reales y tener la forma AAAA-MM-DD HH:MM[:SS].');
    }
    return guardar(ms, leerReloj({ ahoraRealMs }).corre, ahoraRealMs);
}

/** Congela (false) o echa a andar (true) el reloj desde el instante en que va ahora. */
export function correrReloj(corre, { ahoraRealMs = Date.now() } = {}) {
    exigirActivo();
    return guardar(leerReloj({ ahoraRealMs }).ms, Boolean(corre), ahoraRealMs);
}

/** Vuelve a LOCAL_FAKE_NOW congelado (borra el archivo de estado). */
export function restablecerReloj({ ahoraRealMs = Date.now() } = {}) {
    exigirActivo();
    fs.rmSync(rutaArchivoReloj(), { force: true });
    cache = { ruta: null, clave: null, estado: null };
    return leerReloj({ ahoraRealMs });
}
