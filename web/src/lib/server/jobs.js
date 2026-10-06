// Programador de tareas: ejecutores de /api/jobs/* (cron externo con Bearer CRON_SECRET). Solo servidor.
// Cada job es idempotente (la SQL lo garantiza) y los que mutan objetos o son costosos toman un bloqueo con
// vencimiento para que dos disparos solapados no se pisen.
import { randomUUID } from 'node:crypto';
import { ApiError } from '@/lib/api/errors';
import { callRpc } from '@/lib/api/client';
import { getAdminBackend } from '@/lib/backend';
import { handle } from './route.js';
import { eliminarObjetos, validarRutaObjeto } from './storage.js';
import { CLAVE_BLOQUEO_INDICE, reconstruirIndice } from './indice.js';
import { purgarFotosRegistro } from './fotosRegistro.js';
import { recalcularCuerpo } from './schemas.js';

export const NOMBRES_JOB = Object.freeze([
    'cerrar-sesiones', 'resolver-pendientes', 'purgar-recortes', 'purgar-fotos-registro', 'reconstruir-indice', 'recalcular',
]);

const LOTE_PURGA = 500; // filas por vuelta (svc_job_purgar_recortes_listar admite hasta 2000)
const MAX_LOTES_PURGA = 10; // tope por ejecución; lo restante lo toma la siguiente corrida
const LOTE_BORRADO = 100; // rutas por llamada a Storage

/** Ejecuta `fn` con un bloqueo de job; si otro dispara el mismo job, responde 'omitido' sin error. */
async function conBloqueoJob(svc, clave, fn) {
    const dueno = `job:${randomUUID()}`;
    const adquirido = await svc('svc_bloqueo_adquirir', { clave, dueno, ttlSeg: 900 });
    if (!adquirido) return { estado: 'omitido', motivo: 'en_ejecucion' };
    try {
        return await fn();
    } finally {
        try {
            await svc('svc_bloqueo_liberar', { clave, dueno });
        } catch {
            console.error('[jobs] no se pudo liberar un bloqueo; caducará solo');
        }
    }
}

/**
 * Purga de recortes en 3 pasos y en este orden (RNF-05): listar -> borrar objetos -> marcar NULL.
 * Con el orden inverso quedarían objetos huérfanos para siempre; si el proceso muere entre 2 y 3, la siguiente
 * corrida vuelve a listar las mismas rutas y borrar un objeto ausente no es error.
 */
async function purgarRecortes(svc, admin) {
    return conBloqueoJob(svc, 'job:purgar-recortes', async () => {
        const total = { lotes: 0, listados: 0, borrados: 0, marcados: 0, rutas_invalidas: 0, pendientes_total: 0 };
        for (let i = 0; i < MAX_LOTES_PURGA; i += 1) {
            const lote = await svc('svc_job_purgar_recortes_listar', { limit: LOTE_PURGA });
            const items = Array.isArray(lote?.items) ? lote.items : [];
            total.pendientes_total = Number(lote?.pendientes_total ?? 0);
            if (items.length === 0) break;
            total.lotes += 1;
            total.listados += items.length;

            // Solo se borran rutas con la forma esperada de un recorte: jamás se borra algo fuera de recortes/.
            const rutas = [];
            for (const item of items) {
                try {
                    rutas.push(validarRutaObjeto(item.objeto_recorte, ['recortes']));
                } catch {
                    total.rutas_invalidas += 1; // no hay objeto que borrar; se marca igual para no re-listarla siempre
                }
            }
            try {
                for (let k = 0; k < rutas.length; k += LOTE_BORRADO) {
                    await eliminarObjetos(rutas.slice(k, k + LOTE_BORRADO), { admin });
                    total.borrados += Math.min(LOTE_BORRADO, rutas.length - k);
                }
            } catch (e) {
                // No se marca nada de este lote: las rutas siguen en la BD y la siguiente corrida reintenta.
                throw new ApiError({
                    code: e instanceof ApiError ? e.code : 'ERROR_INTERNO',
                    message: 'La purga de recortes se detuvo: falló el borrado en el almacenamiento.',
                    status: e instanceof ApiError ? e.status : 500,
                    details: { fase: 'borrado', ...total },
                });
            }
            const marca = await svc('svc_job_purgar_recortes_marcar', { ids: items.map((x) => x.id_deteccion) });
            const marcadas = Number(marca?.marcadas ?? 0);
            total.marcados += marcadas;
            if (items.length < LOTE_PURGA || marcadas === 0) break; // sin progreso: evita un ciclo infinito
        }
        return { estado: 'ok', ...total };
    });
}

/**
 * Barrido de fotos de registro (extensión 18). Cada reconstrucción ya purga las que acaba de indexar; este job reintenta
 * borrados que fallaron y limpia las de plantillas archivadas o anteriores a la extensión.
 * Toma el bloqueo del ÍNDICE (no uno propio): mientras se reconstruye o revierte no corre, porque una reversión puede
 * devolver una plantilla a «pendiente» y entonces su foto vuelve a ser la única copia de su vector.
 */
async function purgarFotos(svc, admin) {
    return conBloqueoJob(svc, CLAVE_BLOQUEO_INDICE, async () => ({ estado: 'ok', ...(await purgarFotosRegistro({ svc, admin })) }));
}

/** Diagnóstico + reconstrucción del índice si hace falta. */
async function jobReconstruirIndice(svc, admin) {
    const diagnostico = await svc('svc_job_reconstruir_indice');
    if (!diagnostico?.requiere) return { estado: 'sin_cambios', diagnostico };
    try {
        const resultado = await reconstruirIndice({ admin });
        return { estado: resultado.estado, diagnostico, resultado };
    } catch (e) {
        if (e instanceof ApiError && e.code === 'RECONSTRUCCION_EN_CURSO') {
            return { estado: 'omitido', motivo: 'en_curso', diagnostico };
        }
        throw e;
    }
}

/**
 * Ejecuta un job por nombre con service_role.
 * @param {string} nombre uno de NOMBRES_JOB
 * @param {{ admin?: object, body?: object }} [opts]
 * @returns {Promise<object>} resultado de la SQL (o del orquestador) más `job` y `duracion_ms`
 */
export async function ejecutarJob(nombre, { admin, body = {} } = {}) {
    if (!NOMBRES_JOB.includes(nombre)) {
        throw new ApiError({ code: 'NO_ENCONTRADO', message: 'El job no existe.', status: 404 });
    }
    const inicio = Date.now();
    const cliente = admin ?? await getAdminBackend();
    const svc = (n, a) => callRpc(n, a, { backend: cliente });
    let resultado;
    switch (nombre) {
        case 'cerrar-sesiones':
            resultado = await svc('svc_job_cerrar_sesiones');
            break;
        case 'resolver-pendientes':
            resultado = await svc('svc_job_resolver_pendientes');
            break;
        case 'purgar-recortes':
            resultado = await purgarRecortes(svc, cliente);
            break;
        case 'purgar-fotos-registro':
            resultado = await purgarFotos(svc, cliente);
            break;
        case 'reconstruir-indice':
            resultado = await jobReconstruirIndice(svc, cliente);
            break;
        default: // recalcular
            resultado = await conBloqueoJob(svc, 'job:recalcular', () => svc('svc_job_recalcular', { periodo: body.periodo }));
    }
    return { job: nombre, ...resultado, duracion_ms: Date.now() - inicio };
}

/**
 * Handler de un job: Bearer CRON_SECRET (tiempo constante), sin cookies ni roles. Se exporta como POST y como
 * GET porque algunos programadores (p. ej. Vercel Cron) solo disparan GET; la autenticación es la misma.
 */
export function handleJob(nombre) {
    return handle({ auth: 'cron', input: nombre === 'recalcular' ? recalcularCuerpo : undefined },
        ({ body }) => ejecutarJob(nombre, { body }));
}
