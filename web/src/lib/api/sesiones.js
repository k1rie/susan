import { callRpc } from './client.js';

// Sesiones de clase: panel del docente, ciclo de vida de la sesión (abrir, cerrar, suspender, reanudar), monitor en vivo y registro manual.
// Cada función = una RPC api_* del catálogo (docs/API-RPC.md): argumentos camelCase sin `p_`.
// `opts.backend` solo hace falta en servidor (RSC/Route Handlers); en el navegador se usa el singleton.

/**
 * api_docente_panel: Panel del docente (P-02): sesiones de hoy, pendientes, justificantes por resolver, alertas y grupos del periodo.
 * Roles: docente
 *
 * @param {object} [args]
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {fecha, sesiones_hoy:[{id_sesion,id_grupo,materia,clave_grupo,aula,fecha,hora_inicio,hora_fin,estatus,modo_previsto,camaras_activas,abrible}], pendientes:2, justificantes_por_resolver:1, alertas:[{tipo:"sin_derecho_examen"|"en_limite",id_grupo,id_alumno,matricula,nombre,...}], grupos:[{id_grupo,materia,clave_grupo,periodo,aula,inscritos}]}. modo_previsto = modo real si la sesion ya abrio; si esta programada, automatico con al menos una camara activa en el aula y manual si no. pendientes = registros pendientes de sesiones cerradas. alertas usa api_alertas_docente() si existe; si no, v_resumen_asistencia. grupos = periodo mas reciente del docente.
 * @throws {ApiError} NO_AUTENTICADO (sin sesion), CUENTA_INACTIVA, NO_AUTORIZADO (rol distinto de docente)
 */
export async function docentePanel(args = {}, opts = {}) {
    return callRpc('api_docente_panel', args, opts);
}

/**
 * api_abrir_sesion: Abre la sesion de clase (programada -> abierta) y fija el modo de registro por las camaras del aula (RN-06).
 * Roles: docente (titular del grupo)
 *
 * @param {object} [args]
 * @param {number} args.idSesion p_id_sesion integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_sesion,id_grupo,fecha,hora_inicio,hora_fin,estatus:"abierta",modo_registro:"automatico"|"manual",ya_abierta,tolerancia_min,limite_presente_min,intervalo_muestreo_seg,camaras:[{id_camara,posicion,tipo,estatus}]}
 * @throws {ApiError} NO_ENCONTRADO (sesion inexistente), NO_AUTORIZADO (rol o sesion de otro docente), FUERA_DE_HORARIO (fuera de hora_inicio..hora_fin), SESION_CERRADA, SESION_SUSPENDIDA
 */
export async function abrirSesion(args = {}, opts = {}) {
    return callRpc('api_abrir_sesion', args, opts);
}

/**
 * api_cerrar_sesion: Cierra la sesion de clase (RF-10, RN-07): ausente a los inscritos activos sin registro, pendientes a la cola, estatus cerrada, bitacora y recalculo de faltas.
 * Roles: docente (titular del grupo)
 *
 * @param {object} [args]
 * @param {number} args.idSesion p_id_sesion integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_sesion,estatus:"cerrada",ya_cerrada,modo_registro,ausentes_creados,confirmados,pendientes,presentes,retardos,ausentes,justificados,registros,cerrada_por:"docente",cerrada_en}
 * @throws {ApiError} NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO, VENTANA_TOLERANCIA_ABIERTA (cierre antes de terminar la tolerancia), SESION_NO_ABIERTA (programada), SESION_SUSPENDIDA
 */
export async function cerrarSesion(args = {}, opts = {}) {
    return callRpc('api_cerrar_sesion', args, opts);
}

/**
 * api_suspender_sesion: Suspende una sesion programada (extension a la spec): sale del denominador de faltas (RN-11) y se recalcula el grupo.
 * Roles: docente (titular del grupo), administrador
 *
 * @param {object} [args]
 * @param {number} args.idSesion p_id_sesion integer.
 * @param {string} args.motivo p_motivo text.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_sesion,estatus:"suspendida",ya_suspendida,motivo}
 * @throws {ApiError} NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO, VALIDACION (motivo vacio o > 200), ESTATUS_INVALIDO (abierta o cerrada)
 */
export async function suspenderSesion(args = {}, opts = {}) {
    return callRpc('api_suspender_sesion', args, opts);
}

/**
 * api_reanudar_sesion: Reanuda una sesion suspendida (suspendida -> programada): vuelve al denominador de faltas y se recalcula el grupo.
 * Roles: docente (titular del grupo), administrador
 *
 * @param {object} [args]
 * @param {number} args.idSesion p_id_sesion integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_sesion,estatus:"programada",ya_programada}
 * @throws {ApiError} NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO, ESTATUS_INVALIDO (abierta o cerrada)
 */
export async function reanudarSesion(args = {}, opts = {}) {
    return callRpc('api_reanudar_sesion', args, opts);
}

/**
 * api_sesion_monitor: Monitor en vivo de la sesion (P-03/P-04): sesion con minuto actual, camaras, estado de cada alumno y totales.
 * Roles: docente (titular del grupo)
 *
 * @param {object} [args]
 * @param {number} args.idSesion p_id_sesion integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {sesion:{id_sesion,...,estatus,modo_registro,minuto_actual:9.5,en_ventana:true,fase:"presente"|"retardo"|"fuera_de_ventana"|<estatus>}, camaras:[{id_camara,posicion,tipo,estatus,ultima_captura,capturas}], alumnos:[{id_alumno,matricula,nombre,inscripcion,estado:null|"pendiente"|...,origen,hora_registro,conteo_detecciones,lecturas_validas,mejor_score,consentimiento_vigente}], totales:{inscritos,presentes,retardos,ausentes,pendientes,justificados,registrados,sin_registro,manuales,capturas,detecciones,detecciones_validas}}
 * @throws {ApiError} NO_AUTENTICADO, NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO
 */
export async function sesionMonitor(args = {}, opts = {}) {
    return callRpc('api_sesion_monitor', args, opts);
}

/**
 * api_registrar_manual: Registra o actualiza con origen manual la asistencia de un alumno en una sesion abierta (RF-09).
 * Roles: docente (titular del grupo)
 *
 * @param {object} [args]
 * @param {number} args.idSesion p_id_sesion integer.
 * @param {number} args.idAlumno p_id_alumno integer.
 * @param {string} args.estado p_estado text.
 * @param {string} [args.hora] p_hora timestamp with time zone (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_asistencia,id_sesion,id_alumno,estado,origen:"manual",hora_registro,sugerido,creado}. hora_registro es null si el estado es ausente.
 * @throws {ApiError} NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO (sesion), SESION_NO_ABIERTA, ALUMNO_NO_INSCRITO, ALUMNO_CON_LECTURAS (sesion automatica, con consentimiento y lecturas), ESTADO_INVALIDO, HORA_INVALIDA, REGISTRO_CORREGIDO, VALIDACION
 */
export async function registrarManual(args = {}, opts = {}) {
    return callRpc('api_registrar_manual', args, opts);
}

/**
 * api_pase_lista_manual: Pase de lista manual por lote, atomico (todo o nada), con origen manual (P-04, RF-09).
 * Roles: docente (titular del grupo)
 *
 * @param {object} [args]
 * @param {number} args.idSesion p_id_sesion integer.
 * @param {object|object[]} args.registros p_registros jsonb.
 * @param {boolean} [args.marcarRestantes] p_marcar_restantes boolean (def. false).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_sesion,modo_registro,procesados,creados,actualizados,restantes_marcados,items:[{id_asistencia,id_alumno,estado,origen,hora_registro,sugerido,creado}]}
 * @throws {ApiError} NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO (sesion), SESION_NO_ABIERTA, VALIDACION (registro mal formado), REGISTRO_DUPLICADO (alumno repetido en el lote), ALUMNO_NO_INSCRITO, ALUMNO_CON_LECTURAS, ESTADO_INVALIDO, HORA_INVALIDA, REGISTRO_CORREGIDO
 */
export async function paseListaManual(args = {}, opts = {}) {
    return callRpc('api_pase_lista_manual', args, opts);
}
