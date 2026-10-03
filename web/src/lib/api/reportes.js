import { callRpc } from './client.js';

// Reportes y analítica: reportes de asistencia, resumen e historial del alumno, impacto en tiempo, series y matriz para el análisis numérico, alertas.
// Cada función = una RPC api_* del catálogo (docs/API-RPC.md): argumentos camelCase sin `p_`.
// `opts.backend` solo hace falta en servidor (RSC/Route Handlers); en el navegador se usa el singleton.

/**
 * api_reporte_grupo: Reporte de asistencia de un grupo (RF-17): KPIs del grupo y una fila por alumno activo con presentes, retardos, ausencias, justificadas, pendientes, faltas equivalentes (RN-10), porcentaje sobre sesiones programadas (RN-11), faltas restantes y derecho a examen. Con p_id_alumno trae solo su fila y su detalle por sesion.
 * Roles: administrador (todos los grupos), docente (solo los suyos)
 *
 * @param {object} [args]
 * @param {number} args.idGrupo p_id_grupo integer.
 * @param {number} [args.idAlumno] p_id_alumno integer (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {generado_en, grupo:{id_grupo, clave_grupo, periodo, id_materia, materia_clave, materia_nombre, id_docente, docente_nombre, id_aula, aula_clave}, limite_pct:20, retardos_por_ausencia:3, kpis:{sesiones_programadas:48, sesiones_cerradas, inscritos, asistencia_promedio:91.5, alumnos_en_limite, alumnos_sin_derecho}, total, items:[{id_alumno, matricula, apellido_paterno, apellido_materno, nombres, nombre_completo, id_inscripcion, sesiones_programadas, presentes, retardos, ausencias, justificadas, pendientes, faltas_equivalentes, porcentaje_faltas:18.75, limite_pct, faltas_maximas_permitidas, faltas_restantes_antes_limite, supera_limite, en_limite, derecho_examen}], detalle:null|[{id_sesion, fecha, hora_inicio, estatus_sesion, estado, origen, hora_registro, justificante_estatus}]}
 * @throws {ApiError} NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador; alumno no inscrito), VALIDACION (grupo nulo)
 */
export async function reporteGrupo(args = {}, opts = {}) {
    return callRpc('api_reporte_grupo', args, opts);
}

/**
 * api_reporte_periodo: Reporte por periodo (RF-17): una fila por grupo con inscritos, sesiones programadas y cerradas, asistencia promedio y alumnos en el limite o sin derecho.
 * Roles: administrador (todos los grupos); docente (solo los suyos, impuesto por la RLS)
 *
 * @param {object} [args]
 * @param {string} args.periodo p_periodo text.
 * @param {number} [args.idGrupo] p_id_grupo integer (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {generado_en, periodo, total, items:[{id_grupo, clave_grupo, periodo, id_materia, materia_clave, materia_nombre, id_docente, docente_nombre, id_aula, inscritos, sesiones_programadas, sesiones_cerradas, asistencia_promedio, alumnos_en_limite, alumnos_sin_derecho}]}
 * @throws {ApiError} NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (periodo)
 */
export async function reportePeriodo(args = {}, opts = {}) {
    return callRpc('api_reporte_periodo', args, opts);
}

/**
 * api_reporte_filtros: Periodos y grupos accesibles para los filtros de reportes y analitica (docente: solo sus grupos).
 * Roles: administrador, docente
 *
 * @param {object} [args]
 * @param {string} [args.periodo] p_periodo text (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {periodo_actual, periodo, periodos:["2026-2"], grupos:[{id_grupo, clave_grupo, periodo, id_materia, materia_clave, materia_nombre, id_docente, docente_nombre, inscritos}]}
 * @throws {ApiError} NO_AUTORIZADO (rol distinto de administrador o docente)
 */
export async function reporteFiltros(args = {}, opts = {}) {
    return callRpc('api_reporte_filtros', args, opts);
}

/**
 * api_alumno_resumen: Resumen por materia del alumno autenticado en un periodo (RF-21): acumulados, porcentaje de faltas frente al limite, faltas restantes y derecho a examen. Coincide con el reporte del docente; los pendientes no cuentan hasta resolverse.
 * Roles: alumno (solo propios)
 *
 * @param {object} [args]
 * @param {string} [args.periodo] p_periodo text (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_alumno, periodo, periodos_disponibles:["2026-2"], items:[{id_grupo, clave_grupo, periodo, materia:{id_materia, clave, nombre}, docente_nombre, sesiones_cerradas, id_inscripcion, sesiones_programadas, presentes, retardos, ausencias, justificadas, pendientes, faltas_equivalentes, porcentaje_faltas, limite_pct, faltas_maximas_permitidas, faltas_restantes_antes_limite, supera_limite, en_limite, derecho_examen}]}
 * @throws {ApiError} NO_AUTORIZADO (rol distinto de alumno)
 */
export async function alumnoResumen(args = {}, opts = {}) {
    return callRpc('api_alumno_resumen', args, opts);
}

/**
 * api_alumno_historial: Historial por sesion del alumno autenticado en un grupo propio (RF-21), sin imagenes ni rutas: estado de cada sesion cerrada, abierta o suspendida (estado null = sin registro), origen, estatus de su justificante y si aun puede justificarla.
 * Roles: alumno (solo propios)
 *
 * @param {object} [args]
 * @param {number} args.idGrupo p_id_grupo integer.
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {grupo:{id_grupo, clave_grupo, periodo, materia}, resumen:{...contadores del grupo...}, total, items:[{id_sesion, fecha, hora_inicio, hora_fin, estatus_sesion, modo_registro, estado, origen, hora_registro, justificante:{id_justificante, estatus}|null, puede_justificar}]}
 * @throws {ApiError} NO_AUTORIZADO (rol distinto de alumno o grupo donde no esta inscrito)
 */
export async function alumnoHistorial(args = {}, opts = {}) {
    return callRpc('api_alumno_historial', args, opts);
}

/**
 * api_impacto_tiempo: ESTIMACION del tiempo de clase recuperado: sesiones cerradas en modo automatico vs manual y minutos recuperados = automaticas x minutos_pase_lista_base. No es una medicion.
 * Roles: administrador, docente (solo sus grupos)
 *
 * @param {object} [args]
 * @param {number} [args.idGrupo] p_id_grupo integer (def. NULL).
 * @param {string} [args.periodo] p_periodo text (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_grupo, periodo, sesiones_cerradas, sesiones_automaticas, sesiones_manuales, minutos_pase_lista_base:5, minutos_recuperados, horas_recuperadas, es_estimacion:true, nota}
 * @throws {ApiError} NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (periodo)
 */
export async function impactoTiempo(args = {}, opts = {}) {
    return callRpc('api_impacto_tiempo', args, opts);
}

/**
 * api_serie_grupo: Serie temporal del grupo para el analisis numerico: una entrada por sesion CERRADA, ordenada por fecha, con conteos por estado y tasa de ausentismo = ausentes / inscritos (fraccion 0-1, 4 decimales). inscritos = registros de asistencia de la sesion.
 * Roles: administrador, docente (solo sus grupos)
 *
 * @param {object} [args]
 * @param {number} args.idGrupo p_id_grupo integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_grupo, periodo, sesiones_programadas:48, limite_pct:20, retardos_por_ausencia:3, sesiones:[{id_sesion, fecha, semana_iso, anio_iso, dia_semana (1=lunes), inscritos, presentes, retardos, ausentes, justificados, pendientes, tasa_ausentismo:0.0667}]}
 * @throws {ApiError} NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (grupo nulo)
 */
export async function serieGrupo(args = {}, opts = {}) {
    return callRpc('api_serie_grupo', args, opts);
}

/**
 * api_serie_alumno: Serie de un alumno en un grupo: una entrada por sesion CERRADA (estado null = sin registro) con las ausencias, retardos y faltas equivalentes acumuladas hasta esa sesion, mas su resumen actual. Sin imagenes.
 * Roles: alumno (solo propios), docente (sus grupos), administrador
 *
 * @param {object} [args]
 * @param {number} args.idGrupo p_id_grupo integer.
 * @param {number} [args.idAlumno] p_id_alumno integer (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {id_grupo, id_alumno, periodo, sesiones_programadas, limite_pct, retardos_por_ausencia, resumen:{...}, sesiones:[{id_sesion, fecha, semana_iso, dia_semana, estado, ausencias_acumuladas, retardos_acumulados, faltas_equivalentes_acumuladas}]}
 * @throws {ApiError} NO_AUTORIZADO (alumno ajeno, grupo ajeno o sin inscripcion propia), NO_ENCONTRADO (alumno no inscrito en el grupo), VALIDACION (falta p_id_alumno)
 */
export async function serieAlumno(args = {}, opts = {}) {
    return callRpc('api_serie_alumno', args, opts);
}

/**
 * api_matriz_grupo: Matriz alumno x sesion cerrada para el analisis numerico: fechas (una por sesion cerrada, por orden cronologico) y, por alumno, estados alineados con fechas (null = sin registro). Los alumnos dados de baja solo aparecen si tienen registros. Paginada por alumno (def. 200); clave extra total.
 * Roles: administrador, docente (solo sus grupos)
 *
 * @param {object} [args]
 * @param {number} args.idGrupo p_id_grupo integer.
 * @param {number} [args.limit] p_limit integer (def. 200).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {fechas:["2026-08-17"], total, alumnos:[{id_alumno, id_inscripcion, matricula, nombre, estados:["presente","ausente",null]}]}
 * @throws {ApiError} NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (grupo nulo)
 */
export async function matrizGrupo(args = {}, opts = {}) {
    return callRpc('api_matriz_grupo', args, opts);
}

/**
 * api_alertas_docente: Alertas de asistencia para el panel del docente (RF-14): alumnos activos sin derecho a examen (tipo sin_derecho) o a una falta equivalente de perderlo (tipo en_limite), primero los que ya no tienen derecho y luego por porcentaje descendente.
 * Roles: docente (solo sus grupos), administrador (todos)
 *
 * @param {object} [args]
 * @param {number} [args.idGrupo] p_id_grupo integer (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {generado_en, total, sin_derecho, en_limite, items:[{tipo:"sin_derecho"|"en_limite", id_grupo, clave_grupo, periodo, materia_clave, materia_nombre, id_alumno, matricula, apellido_paterno, apellido_materno, nombres, nombre_completo, id_inscripcion, sesiones_programadas, presentes, retardos, ausencias, justificadas, pendientes, faltas_equivalentes, porcentaje_faltas, limite_pct, faltas_maximas_permitidas, faltas_restantes_antes_limite, supera_limite, en_limite, derecho_examen}]}
 * @throws {ApiError} NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador)
 */
export async function alertasDocente(args = {}, opts = {}) {
    return callRpc('api_alertas_docente', args, opts);
}
