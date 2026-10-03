import { callRpc } from './client.js';

// Revisión del docente: cola de pendientes, correcciones, justificantes y lecturas de un caso. El alumno registra y consulta sus justificantes aquí.
// Cada función = una RPC api_* del catálogo (docs/API-RPC.md): argumentos camelCase sin `p_`.
// `opts.backend` solo hace falta en servidor (RSC/Route Handlers); en el navegador se usa el singleton.

/**
 * api_cola_revision: Cola de revision del docente (RF-18): pendientes de sesiones cerradas, justificantes por resolver y correcciones de los ultimos 30 dias, con lecturas (sin rutas), plazo restante y estado sugerido (RN-03).
 * Roles: docente (solo sus grupos)
 *
 * @param {object} [args]
 * @param {string} [args.pestana] p_pestana text (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {generado_en, horas_limite_correccion, min_detecciones_validas, contadores:{pendientes, justificantes, correcciones_recientes}, pendientes:[{id_asistencia, estado, origen, hora_registro, conteo_detecciones, alumno, materia, grupo, sesion, vence_en, segundos_restantes, vencido, estado_sugerido, lecturas_validas, total_lecturas, mejor_score, lecturas:[{id_deteccion, id_captura, marca_tiempo, minuto_sesion, camara_posicion, score_similitud, es_valida, tiene_recorte}]}], justificantes:[...], correcciones_recientes:[...]}
 * @throws {ApiError} NO_AUTORIZADO (no es docente), VALIDACION (pestana)
 */
export async function colaRevision(args = {}, opts = {}) {
    return callRpc('api_cola_revision', args, opts);
}

/**
 * api_corregir_asistencia: Corrige el estado de un registro de asistencia (RF-11, RN-08): origen correccion, plazo de horas_limite_correccion, bitacora con valor anterior y nuevo, recalculo del derecho a examen.
 * Roles: docente titular del grupo
 *
 * @param {object} [args]
 * @param {number} args.idAsistencia p_id_asistencia integer.
 * @param {string} args.estado p_estado text.
 * @param {string} [args.comentario] p_comentario text (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_asistencia, id_sesion, id_alumno, estado_anterior, estado, origen:"correccion", hora_registro, vence_en, id_bitacora, inscripcion:{id_inscripcion, derecho_examen_anterior, derecho_examen}}
 * @throws {ApiError} NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO, VALIDACION (estado o comentario), TRANSICION_NO_PERMITIDA (pendiente, justificado o registro justificado), SIN_CAMBIO, SESION_NO_CERRADA, RN_08_PLAZO_VENCIDO, JUSTIFICANTE_PENDIENTE (presente con justificante pendiente)
 */
export async function corregirAsistencia(args = {}, opts = {}) {
    return callRpc('api_corregir_asistencia', args, opts);
}

/**
 * api_resolver_justificante: Aprueba o rechaza un justificante pendiente (RF-12, RN-09). Aprobar deja el registro justificado (origen correccion) sin borrar lecturas; asienta bitacora y recalcula el derecho a examen. Sin plazo.
 * Roles: docente titular del grupo
 *
 * @param {object} [args]
 * @param {number} args.idJustificante p_id_justificante integer.
 * @param {boolean} args.aprobar p_aprobar boolean.
 * @param {string} [args.comentario] p_comentario text (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_justificante, id_asistencia, estatus, estado_asistencia_anterior, estado_asistencia, resuelto_por, fecha_resolucion, id_bitacora, inscripcion:{id_inscripcion, derecho_examen_anterior, derecho_examen}}
 * @throws {ApiError} NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO, VALIDACION (p_aprobar nulo o comentario largo), JUSTIFICANTE_YA_RESUELTO, ESTADO_NO_JUSTIFICABLE
 */
export async function resolverJustificante(args = {}, opts = {}) {
    return callRpc('api_resolver_justificante', args, opts);
}

/**
 * api_registrar_justificante: Registra un justificante pendiente de una falta o retardo de una sesion cerrada (RF-12). El documento debe ser justificantes/<id_alumno>/<uuid>.(pdf|jpg|png).
 * Roles: alumno (propios), docente titular
 *
 * @param {object} [args]
 * @param {number} args.idSesion p_id_sesion integer.
 * @param {string} args.motivo p_motivo text.
 * @param {string} args.objetoDocumento p_objeto_documento text.
 * @param {number} [args.idAlumno] p_id_alumno integer (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_justificante, id_sesion, id_alumno, id_asistencia, estado_asistencia, estatus:"pendiente", motivo, objeto_documento, registrado_por_rol, fecha_registro}
 * @throws {ApiError} NO_AUTORIZADO (alumno ajeno o grupo no titular), VALIDACION (motivo o alumno), DOCUMENTO_INVALIDO, ASISTENCIA_NO_ENCONTRADA, SESION_NO_CERRADA, ESTADO_NO_JUSTIFICABLE, JUSTIFICANTE_DUPLICADO
 */
export async function registrarJustificante(args = {}, opts = {}) {
    return callRpc('api_registrar_justificante', args, opts);
}

/**
 * api_validar_justificante: Precomprueba (sin escribir) que se puede registrar un justificante para la sesion y el alumno.
 * Roles: alumno (propios), docente titular
 *
 * @param {object} [args]
 * @param {number} args.idSesion p_id_sesion integer.
 * @param {number} [args.idAlumno] p_id_alumno integer (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_sesion, id_alumno, id_asistencia, estado:"ausente", ya_tuvo_rechazo:false}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION, ASISTENCIA_NO_ENCONTRADA, SESION_NO_CERRADA, ESTADO_NO_JUSTIFICABLE, JUSTIFICANTE_DUPLICADO
 */
export async function validarJustificante(args = {}, opts = {}) {
    return callRpc('api_validar_justificante', args, opts);
}

/**
 * api_justificante_documento: Ruta del documento de un justificante de un grupo propio: SOLO para el Route Handler, que asienta la consulta y firma una URL de 300 s como maximo.
 * Roles: docente titular (via Route Handler)
 *
 * @param {object} [args]
 * @param {number} args.idJustificante p_id_justificante integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_usuario, vigencia_url_firmada_seg, id_justificante, id_alumno, id_asistencia, estatus, objeto_documento}
 * @throws {ApiError} NO_AUTORIZADO (no es docente), NO_ENCONTRADO (inexistente o de grupo ajeno)
 */
export async function justificanteDocumento(args = {}, opts = {}) {
    return callRpc('api_justificante_documento', args, opts);
}

/**
 * api_detecciones_caso: Lecturas de un caso (detecciones atribuidas al alumno en la sesion) con rutas de recortes y foto de registro: SOLO para el Route Handler, que debe asentar la consulta (svc_registrar_consulta_revision) antes de firmar URLs de 300 s como maximo.
 * Roles: docente titular (via Route Handler)
 *
 * @param {object} [args]
 * @param {number} args.idAsistencia p_id_asistencia integer.
 * @param {boolean} [args.soloValidas] p_solo_validas boolean (def. false).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_usuario, vigencia_url_firmada_seg, asistencia, alumno, sesion, objeto_foto_registro, total, lecturas:[{id_deteccion, id_captura, marca_tiempo, minuto_sesion, camara_posicion, score_similitud, es_valida, tiene_recorte, objeto_recorte}]}
 * @throws {ApiError} NO_AUTORIZADO (no es docente), NO_ENCONTRADO (inexistente o de grupo ajeno)
 */
export async function deteccionesCaso(args = {}, opts = {}) {
    return callRpc('api_detecciones_caso', args, opts);
}

/**
 * api_registros_corregibles: Registros de asistencia de una sesion propia con su plazo de correccion y si cada uno es corregible.
 * Roles: docente titular
 *
 * @param {object} [args]
 * @param {number} args.idSesion p_id_sesion integer.
 * @param {number} [args.limit] p_limit integer (def. 100).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {sesion, vence_en, segundos_restantes, dentro_de_plazo, total, items:[{id_asistencia, alumno, estado, origen, hora_registro, conteo_detecciones, justificante_pendiente, corregible}]}
 * @throws {ApiError} NO_AUTORIZADO (no es docente), NO_ENCONTRADO (sesion inexistente o ajena)
 */
export async function registrosCorregibles(args = {}, opts = {}) {
    return callRpc('api_registros_corregibles', args, opts);
}

/**
 * api_sesiones_corregibles: Sesiones cerradas de los grupos del docente cuyo plazo de correccion (RN-08) sigue abierto.
 * Roles: docente (solo sus grupos)
 *
 * @param {object} [args]
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {total, items:[{id_sesion, fecha, hora_inicio, hora_fin, modo_registro, grupo, materia, vence_en, segundos_restantes, total_registros, total_pendientes}]}
 * @throws {ApiError} NO_AUTORIZADO (no es docente)
 */
export async function sesionesCorregibles(args = {}, opts = {}) {
    return callRpc('api_sesiones_corregibles', args, opts);
}

/**
 * api_mis_justificables: Faltas y retardos propios de sesiones cerradas que aun se pueden justificar (sin justificante pendiente).
 * Roles: alumno (solo propios)
 *
 * @param {object} [args]
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {total, items:[{id_asistencia, id_sesion, estado, origen, fecha, hora_inicio, hora_fin, materia, grupo, tiene_rechazado}]}
 * @throws {ApiError} NO_AUTORIZADO (no es alumno)
 */
export async function misJustificables(args = {}, opts = {}) {
    return callRpc('api_mis_justificables', args, opts);
}

/**
 * api_mis_justificantes: Justificantes propios del alumno con su estatus, sin documento ni comentarios del docente.
 * Roles: alumno (solo propios)
 *
 * @param {object} [args]
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {total, items:[{id_justificante, estatus, motivo, fecha_registro, fecha_resolucion, registrado_por_rol, id_sesion, id_asistencia, estado_asistencia, fecha, hora_inicio, materia, grupo}]}
 * @throws {ApiError} NO_AUTORIZADO (no es alumno)
 */
export async function misJustificantes(args = {}, opts = {}) {
    return callRpc('api_mis_justificantes', args, opts);
}
