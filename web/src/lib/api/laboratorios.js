import { callRpc } from './client.js';

// Laboratorios: el docente solicita su uso para un grupo y el administrador lo autoriza (extensión 20, docs/DECISIONS.md).
// Cada función = una RPC api_laboratorio* del catálogo (docs/API-RPC.md): argumentos camelCase sin `p_`.
// `opts.backend` solo hace falta en servidor (RSC/Route Handlers); en el navegador se usa el singleton.

/**
 * api_laboratorios_listar: Laboratorios del plantel (aulas con tipo laboratorio), ordenados por clave.
 * Roles: administrador, docente.
 *
 * @param {object} [args]
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total": 1, "items": [{"id_aula": 3, "clave": "LAB-1", "edificio": "C", "capacidad": 30, "tipo": "laboratorio"}]}
 * @throws {ApiError} NO_AUTORIZADO (alumno, tecnico).
 */
export async function laboratoriosListar(args = {}, opts = {}) {
    return callRpc('api_laboratorios_listar', args, opts);
}

/**
 * api_laboratorio_solicitar: El docente solicita un laboratorio para uno de sus grupos en una fecha y horario. Nace pendiente.
 * Roles: docente. Deja constancia en bitácora.
 *
 * @param {object} [args]
 * @param {object} args.datos p jsonb: { id_aula, id_grupo, fecha 'AAAA-MM-DD', hora_inicio 'HH:MM', hora_fin 'HH:MM', actividad }.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} La solicitud: {"id_solicitud": 7, "estatus": "pendiente", "fecha": "2026-09-24", "hora_inicio": "10:00", "hora_fin": "12:00", "aula": {...}, "grupo": {...}, "docente": {...}, ...}
 * @throws {ApiError} NO_AUTORIZADO, DOCENTE_NO_ACTIVO, VALIDACION, HORA_INVALIDA, NO_ENCONTRADO, LAB_NO_ES_LABORATORIO, LAB_FUERA_DE_PLAZO, LAB_CAPACIDAD_INSUFICIENTE, SOLICITUD_DUPLICADA, LAB_OCUPADO.
 */
export async function laboratorioSolicitar(args = {}, opts = {}) {
    return callRpc('api_laboratorio_solicitar', args, opts);
}

/**
 * api_laboratorio_resolver: El administrador aprueba (aprobar = true) o rechaza una solicitud pendiente.
 * Roles: administrador. Al rechazar el comentario es obligatorio (mínimo 3 caracteres).
 *
 * @param {object} [args]
 * @param {number} args.idSolicitud p_id_solicitud integer.
 * @param {boolean} args.aprobar p_aprobar boolean.
 * @param {string} [args.comentario] p_comentario text (def. NULL; max 300).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} La solicitud con su nuevo estatus.
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, SOLICITUD_YA_RESUELTA, SOLICITUD_VENCIDA, LAB_NO_ES_LABORATORIO, LAB_CAPACIDAD_INSUFICIENTE, LAB_OCUPADO.
 */
export async function laboratorioResolver(args = {}, opts = {}) {
    return callRpc('api_laboratorio_resolver', args, opts);
}

/**
 * api_laboratorio_cancelar: Cancela una solicitud pendiente o aprobada que aún no inicia.
 * Roles: docente (solo las suyas); administrador (cualquiera, con motivo obligatorio).
 *
 * @param {object} [args]
 * @param {number} args.idSolicitud p_id_solicitud integer.
 * @param {string} [args.comentario] p_comentario text (def. NULL; max 300).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} La solicitud con estatus cancelada.
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, SOLICITUD_YA_RESUELTA, SOLICITUD_VENCIDA.
 */
export async function laboratorioCancelar(args = {}, opts = {}) {
    return callRpc('api_laboratorio_cancelar', args, opts);
}

/**
 * api_laboratorio_solicitudes_listar: Solicitudes de laboratorio (paginada). Pendientes primero por fecha ascendente.
 * Roles: administrador (todas, con `conflicto` y `compite` en las pendientes); docente (solo las suyas).
 *
 * @param {object} [args]
 * @param {string} [args.estatus] p_estatus text: pendiente | aprobada | rechazada | cancelada (def. NULL).
 * @param {number} [args.idAula] p_id_aula integer (def. NULL).
 * @param {string} [args.desde] p_desde date (def. NULL).
 * @param {string} [args.hasta] p_hasta date (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total": 3, "conteos": {"pendiente": 1, "aprobada": 2, "rechazada": 0, "cancelada": 0, "total": 3}, "items": [...]}
 * @throws {ApiError} NO_AUTORIZADO (alumno, tecnico), VALIDACION (estatus desconocido).
 */
export async function laboratorioSolicitudesListar(args = {}, opts = {}) {
    return callRpc('api_laboratorio_solicitudes_listar', args, opts);
}

/**
 * api_laboratorio_agenda: Ocupación de un laboratorio entre dos fechas (clases del aula y solicitudes vigentes).
 * Roles: administrador (ve también al docente de cada bloque); docente.
 *
 * @param {object} [args]
 * @param {number} args.idAula p_id_aula integer.
 * @param {string} args.desde p_desde date.
 * @param {string} args.hasta p_hasta date (máximo 42 días de rango).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"aula": {...}, "desde": "2026-09-14", "hasta": "2026-09-27", "bloques": [{"tipo": "clase"|"solicitud", "estatus": ..., "fecha": ..., "hora_inicio": "10:00", "hora_fin": "12:00", "clave_grupo": "3A", "propia": true, ...}]}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION (rango), NO_ENCONTRADO.
 */
export async function laboratorioAgenda(args = {}, opts = {}) {
    return callRpc('api_laboratorio_agenda', args, opts);
}
