// Orquestación del índice facial FAISS (RF-16, RN-12, RNF-09). Solo servidor.
//
// Reconstrucción segura, en este orden (cada paso solo corre si el anterior salió bien):
//   bloqueo -> plan (SQL) -> build (servicio, revisa errores[]) -> registrar versión (SQL, en_uso=false)
//   -> precarga en el servicio (preload_only) -> activar en BD (UNA transacción) -> activar en el servicio
//   -> liberar el bloqueo (finally).
// La BD solo cambia la versión en uso cuando el servicio ya la tiene validada en memoria, y el puntero del servicio
// cambia al final: nunca hay una ventana con un índice que la BD cree activo y el servicio no pueda cargar.
// Si algo falla antes de activar en la BD no hay efectos sobre lo que usa el reconocimiento; reintentar es
// seguro (el plan sugiere la siguiente versión libre y una versión registrada sin activar es inofensiva).
import { randomUUID } from 'node:crypto';
import { ApiError } from '@/lib/api/errors';
import { callRpc } from '@/lib/api/client';
import { getAdminBackend } from '@/lib/backend';
import { activarIndice, construirIndice, infoIndice, manifiestoIndice } from './recognition.js';

export const CLAVE_BLOQUEO_INDICE = 'indice';
const TTL_BLOQUEO_SEG = 1200; // 20 min; el bloqueo caduca solo si el proceso muere

/** Relanza `e` conservando código, mensaje y status y agregando en qué fase falló (sin datos internos). */
function enFase(e, fase, extra = {}) {
    const base = e instanceof ApiError ? e : new ApiError({
        code: 'ERROR_INTERNO', message: 'Ocurrió un error inesperado.', status: 500,
    });
    const detalles = base.details && typeof base.details === 'object' && !Array.isArray(base.details) ? base.details : {};
    return new ApiError({
        code: base.code,
        message: base.message,
        status: base.status,
        details: { ...detalles, fase, ...extra },
    });
}

/** Ejecuta `fn` con el bloqueo del índice; 409 RECONSTRUCCION_EN_CURSO si otro proceso lo tiene. */
async function conBloqueo(admin, fn) {
    const dueno = `web:${randomUUID()}`;
    const svc = (nombre, args) => callRpc(nombre, args, { backend: admin });
    const adquirido = await svc('svc_bloqueo_adquirir', { clave: CLAVE_BLOQUEO_INDICE, dueno, ttlSeg: TTL_BLOQUEO_SEG });
    if (!adquirido) {
        throw new ApiError({
            code: 'RECONSTRUCCION_EN_CURSO',
            message: 'Ya hay una reconstrucción del índice en curso. Espera a que termine.',
            status: 409,
        });
    }
    try {
        return await fn(svc);
    } finally {
        try {
            await svc('svc_bloqueo_liberar', { clave: CLAVE_BLOQUEO_INDICE, dueno });
        } catch {
            // El arrendamiento caduca solo; no se oculta el resultado real por esto.
            console.error('[indice] no se pudo liberar el bloqueo del índice');
        }
    }
}

/**
 * Entradas del build: las que ya están en la base se conservan (keep); las nuevas llevan su foto. Una plantilla de
 * varias fotos (el plan trae `objetos_foto` con más de una ruta) viaja como {objetos_foto} y el servicio promedia
 * sus embeddings en UN vector; con una sola foto se emite {objeto_foto} exactamente como antes, así un servicio
 * anterior a la mejora sigue entendiendo todo lo que no sea multifoto.
 */
export function entradasDeBuild(plan) {
    return plan.entries.map((e) => {
        const base = { id_plantilla: e.id_plantilla, faiss_id: e.faiss_id };
        if (e.en_base) return { ...base, keep: true };
        if (Array.isArray(e.objetos_foto) && e.objetos_foto.length > 1) return { ...base, objetos_foto: e.objetos_foto };
        return { ...base, objeto_foto: e.objeto_foto };
    });
}

/**
 * Reconstruye y activa una versión completa del índice.
 * @param {{ completa?: boolean, admin?: object }} [opts] completa = reprocesar todas las fotos
 * @returns {Promise<{ estado: 'activada' | 'sin_cambios', version: string | null, id_indice: number | null,
 *   total_vectores: number, muestras?: object[], plantillas_asignadas?: number, plantillas_pendientes?: number, anterior?: object | null,
 *   ya_activo?: boolean }>}
 * @throws {ApiError} RECONSTRUCCION_EN_CURSO | INDICE_CONSTRUCCION_FALLIDA (details.errores) | el de la fase que falló
 */
export async function reconstruirIndice({ completa = false, admin } = {}) {
    const cliente = admin ?? await getAdminBackend();
    return conBloqueo(cliente, async (svc) => {
        const plan = await svc('svc_indice_plan', { completa });
        if (plan.nada_que_hacer) {
            return {
                estado: 'sin_cambios',
                version: plan.base?.version ?? null,
                id_indice: plan.base?.id_indice ?? null,
                total_vectores: plan.base?.total_vectores ?? 0,
            };
        }
        const version = plan.version_sugerida;
        const entries = entradasDeBuild(plan);

        // 1. Construcción en el servicio. Se revisa errores[] ANTES de registrar nada.
        let build;
        try {
            build = await construirIndice({ version, baseVersion: plan.base?.version ?? null, entries });
        } catch (e) {
            throw enFase(e, 'construccion', { version });
        }
        if (build.errores.length > 0 || !build.objeto_indice || build.mapeo.length !== entries.length) {
            throw new ApiError({
                code: 'INDICE_CONSTRUCCION_FALLIDA',
                message: 'No se pudo construir el índice: alguna foto de plantilla no es utilizable.',
                status: 422,
                details: { fase: 'construccion', version, errores: build.errores },
            });
        }

        // 2. Registro de la versión (en_uso = false). Idempotente por versión/ruta/dimensión/total.
        let registro;
        try {
            registro = await svc('svc_indice_registrar', {
                version: build.version,
                dimension: build.dimension,
                objetoIndice: build.objeto_indice,
                totalVectores: build.ntotal,
            });
        } catch (e) {
            throw enFase(e, 'registro', { version });
        }

        // 3. Precarga en el servicio: valida y deja la versión lista sin cambiar el puntero.
        try {
            await activarIndice({ version, preloadOnly: true });
        } catch (e) {
            throw enFase(e, 'precarga', { version, id_indice: registro.id_indice });
        }

        // 4. Activación en BD: una transacción atómica (apaga la anterior, asigna faiss_id, enciende la nueva).
        let activacion;
        try {
            activacion = await svc('svc_indice_activar', { idIndice: registro.id_indice, mapeo: build.mapeo });
        } catch (e) {
            throw enFase(e, 'activacion_bd', { version, id_indice: registro.id_indice });
        }

        // 5. Cambio del puntero del servicio. Si falla, la BD ya está activada: se avisa para "Sincronizar".
        try {
            await activarIndice({ version });
        } catch (e) {
            throw enFase(e, 'activacion_servicio', { version, id_indice: registro.id_indice, bd_activada: true, sincronizado: false });
        }

        return {
            estado: 'activada',
            version,
            id_indice: registro.id_indice,
            total_vectores: build.ntotal,
            muestras: build.muestras ?? [],
            plantillas_asignadas: activacion.plantillas_asignadas,
            plantillas_pendientes: activacion.plantillas_pendientes,
            anterior: activacion.anterior ?? null,
            ya_activo: Boolean(activacion.ya_activo),
        };
    });
}

/**
 * Estado del índice: lo que dice la BD más lo que tiene cargado el servicio.
 * @param {{ backend: object, limit?: number, offset?: number }} p backend = el del usuario (tecnico/administrador)
 */
export async function estadoIndice({ backend, limit = 10, offset = 0 }) {
    const bd = await callRpc('api_indice_estado', { limit, offset }, { backend });
    let servicio;
    let sincronizado = null;
    try {
        const info = await infoIndice();
        servicio = {
            disponible: true,
            version: info.version,
            total_vectores: info.ntotal,
            dimension: info.dimension,
            modelo: info.model,
            cargado_en: info.loaded_at,
        };
        sincronizado = bd?.en_uso ? info.version === bd.en_uso.version : info.version === null;
    } catch (e) {
        servicio = { disponible: false, motivo: e instanceof ApiError ? e.code : 'ERROR_INTERNO' };
    }
    return { ...bd, servicio, sincronizado };
}

/** Carga en el servicio la versión que la BD tiene en uso (tras un fallo de la activación final o un reinicio). */
export async function sincronizarIndice({ admin } = {}) {
    const cliente = admin ?? await getAdminBackend();
    const enUso = await callRpc('svc_indice_en_uso', {}, { backend: cliente });
    if (!enUso) {
        throw new ApiError({
            code: 'SIN_INDICE_EN_USO',
            message: 'La base de datos aún no tiene una versión del índice en uso. Reconstruye el índice.',
            status: 409,
        });
    }
    const info = await activarIndice({ version: enUso.version });
    return { estado: 'sincronizada', version: info.version, total_vectores: info.ntotal };
}

/**
 * Pone en uso una versión anterior. El mapeo sale del manifiesto del servicio (`refs`); las plantillas activas
 * que la versión no conoce quedan pendientes para la siguiente reconstrucción.
 * @param {{ idIndice: number, version: string, admin?: object }} p
 */
export async function revertirIndice({ idIndice, version, admin }) {
    const cliente = admin ?? await getAdminBackend();
    return conBloqueo(cliente, async (svc) => {
        let manifiesto;
        try {
            manifiesto = await manifiestoIndice(version);
            await activarIndice({ version, preloadOnly: true });
        } catch (e) {
            throw enFase(e, 'precarga', { version });
        }
        let resultado;
        try {
            resultado = await svc('svc_indice_revertir', { idIndice, mapeo: manifiesto.refs });
        } catch (e) {
            throw enFase(e, 'activacion_bd', { version });
        }
        try {
            await activarIndice({ version });
        } catch (e) {
            throw enFase(e, 'activacion_servicio', { version, bd_activada: true, sincronizado: false });
        }
        return {
            estado: 'revertida',
            version,
            id_indice: resultado.id_indice,
            anterior: resultado.anterior ?? null,
            plantillas_asignadas: resultado.plantillas_asignadas,
            plantillas_pendientes: resultado.plantillas_pendientes,
            ya_activo: Boolean(resultado.ya_activo),
        };
    });
}
