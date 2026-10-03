import { callRpc } from './client.js';

// Administración: catálogos (materias, docentes, alumnos), grupos, horarios, sesiones, inscripciones, aulas, cámaras, cuentas de usuario y bitácora.
// Cada función = una RPC api_* del catálogo (docs/API-RPC.md): argumentos camelCase sin `p_`.
// `opts.backend` solo hace falta en servidor (RSC/Route Handlers); en el navegador se usa el singleton.

/**
 * api_materias_listar: Lista materias con filtro de texto (paginada).
 * Roles: administrador (todas); docente (solo materias de sus grupos, por RLS).
 *
 * @param {object} [args]
 * @param {string} [args.q] p_q text (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total": 2, "items": [{"id_materia": 1, "clave": "ADM101", "nombre": "Administracion I", "creditos": 8, "horas_semana": 4}]}
 * @throws {ApiError} NO_AUTORIZADO (alumno, tecnico).
 */
export async function materiasListar(args = {}, opts = {}) {
    return callRpc('api_materias_listar', args, opts);
}

/**
 * api_materia_obtener: Ficha de una materia.
 * Roles: administrador; docente (solo materias de sus grupos).
 *
 * @param {object} [args]
 * @param {number} args.idMateria p_id_materia integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_materia": 1, "clave": "ADM101", "nombre": "Administracion I", "creditos": 8, "horas_semana": 4}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO.
 */
export async function materiaObtener(args = {}, opts = {}) {
    return callRpc('api_materia_obtener', args, opts);
}

/**
 * api_materia_guardar: Da de alta (sin id_materia) o modifica (con id_materia) una materia.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {object|object[]} args.datos p jsonb. Campos (snake_case) en el catálogo; alias aceptado: p.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_materia": 3, "clave": "MAT110", "nombre": "Matematicas", "creditos": 6, "horas_semana": 4, "creado": true}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, DUPLICADO (clave).
 */
export async function materiaGuardar(args = {}, opts = {}) {
    return callRpc('api_materia_guardar', args, opts);
}

/**
 * api_docentes_listar: Lista docentes con filtro de texto y estatus (paginada).
 * Roles: administrador (todos); docente (solo su propia fila, por RLS).
 *
 * @param {object} [args]
 * @param {string} [args.q] p_q text (def. NULL).
 * @param {string} [args.estatus] p_estatus text (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total": 2, "items": [{"id_docente": 1, "num_empleado": "D001", "apellido_paterno": "Lopez", "apellido_materno": "Ruiz", "nombres": "Ana", "nombre_completo": "Lopez Ruiz Ana", "correo_institucional": "ana.lopez@unach.test", "estatus": "activo", "grupos": 1}]}
 * @throws {ApiError} NO_AUTORIZADO (alumno, tecnico), VALIDACION (estatus invalido).
 */
export async function docentesListar(args = {}, opts = {}) {
    return callRpc('api_docentes_listar', args, opts);
}

/**
 * api_docente_obtener: Ficha de un docente con sus grupos.
 * Roles: administrador; docente (solo a si mismo).
 *
 * @param {object} [args]
 * @param {number} args.idDocente p_id_docente integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_docente": 1, "num_empleado": "D001", "nombre_completo": "Lopez Ruiz Ana", "correo_institucional": "ana.lopez@unach.test", "estatus": "activo", "grupos": [{"id_grupo": 1, "clave_grupo": "3A", "periodo": "2026-2", "materia_clave": "ADM101", "materia_nombre": "Administracion I"}]}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente consulta a otro).
 */
export async function docenteObtener(args = {}, opts = {}) {
    return callRpc('api_docente_obtener', args, opts);
}

/**
 * api_docente_guardar: Da de alta (sin id_docente) o modifica (con id_docente) un docente; el alta nace activo. El estatus se cambia con api_docente_cambiar_estatus.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {object|object[]} args.datos p jsonb. Campos (snake_case) en el catálogo; alias aceptado: p.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_docente": 3, "num_empleado": "D003", "nombre_completo": "Mena Soto Rosa", "correo_institucional": "rosa.mena@unach.test", "estatus": "activo", "creado": true}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, DUPLICADO (num_empleado o correo).
 */
export async function docenteGuardar(args = {}, opts = {}) {
    return callRpc('api_docente_guardar', args, opts);
}

/**
 * api_docente_cambiar_estatus: Baja logica, licencia o reactivacion de un docente; conserva el historial. Idempotente. La baja se rechaza si tiene sesiones programadas o abiertas de hoy en adelante.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {number} args.idDocente p_id_docente integer.
 * @param {string} args.estatus p_estatus text.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_docente": 3, "estatus_anterior": "activo", "estatus": "licencia", "cambio": true}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION (estatus), NO_ENCONTRADO, DOCENTE_CON_GRUPOS (baja con sesiones por impartir).
 */
export async function docenteCambiarEstatus(args = {}, opts = {}) {
    return callRpc('api_docente_cambiar_estatus', args, opts);
}

/**
 * api_alumnos_listar: Lista alumnos con filtro de texto y estatus (paginada).
 * Roles: administrador (todos); docente (solo alumnos inscritos en sus grupos, por RLS).
 *
 * @param {object} [args]
 * @param {string} [args.q] p_q text (def. NULL).
 * @param {string} [args.estatus] p_estatus text (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total": 25, "items": [{"id_alumno": 1, "matricula": "A001", "apellido_paterno": "Ramos", "apellido_materno": "Diaz", "nombres": "Beatriz", "nombre_completo": "Ramos Diaz Beatriz", "correo_institucional": "a001@unach.test", "estatus": "activo", "consentimiento_vigente": true, "plantilla_activa": true}]}
 * @throws {ApiError} NO_AUTENTICADO, CUENTA_INACTIVA, NO_AUTORIZADO (alumno, tecnico), VALIDACION (estatus invalido).
 */
export async function alumnosListar(args = {}, opts = {}) {
    return callRpc('api_alumnos_listar', args, opts);
}

/**
 * api_alumno_obtener: Ficha de un alumno con resumen de consentimiento, plantilla facial e inscripciones (sin rutas privadas).
 * Roles: administrador; docente (solo alumnos de sus grupos; consentimiento llega null porque la tabla es solo del administrador).
 *
 * @param {object} [args]
 * @param {number} args.idAlumno p_id_alumno integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_alumno": 1, "matricula": "A001", "nombre_completo": "Ramos Diaz Beatriz", "correo_institucional": "a001@unach.test", "estatus": "activo", "consentimiento_vigente": true, "consentimiento": {"id_consent": 1, "fecha_firma": "2026-08-01", "vigencia_hasta": "2027-08-01", "estatus": "vigente", "vigente": true}, "plantilla": {"id_plantilla": 1, "id_consent": 1, "fecha_registro": "2026-08-02T10:00:00-06:00", "indexada": true, "version_indice": "v001"}, "inscripciones": [{"id_inscripcion": 1, "id_grupo": 1, "clave_grupo": "3A", "periodo": "2026-2", "materia_clave": "ADM101", "estatus": "activa", "fecha_alta": "2026-08-03", "derecho_examen": true}]}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente no lo tiene en sus grupos).
 */
export async function alumnoObtener(args = {}, opts = {}) {
    return callRpc('api_alumno_obtener', args, opts);
}

/**
 * api_alumno_guardar: Da de alta (sin id_alumno) o modifica (con id_alumno) un alumno; el alta nace activo. El estatus se cambia con api_alumno_cambiar_estatus.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {object|object[]} args.datos p jsonb. Campos (snake_case) en el catálogo; alias aceptado: p.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_alumno": 7, "matricula": "A007", "nombre_completo": "Soto Mena Carla", "correo_institucional": "a007@unach.test", "estatus": "activo", "creado": true}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION (campos), NO_ENCONTRADO (id_alumno), DUPLICADO (matricula o correo).
 */
export async function alumnoGuardar(args = {}, opts = {}) {
    return callRpc('api_alumno_guardar', args, opts);
}

/**
 * api_alumno_cambiar_estatus: Baja logica o reactivacion de un alumno: cambia el estatus y conserva todo el historial. Un estatus distinto de activo da de baja sus inscripciones activas; reactivar NO las restituye (hay que reinscribir). Idempotente.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {number} args.idAlumno p_id_alumno integer.
 * @param {string} args.estatus p_estatus text.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_alumno": 7, "estatus_anterior": "activo", "estatus": "baja_temporal", "cambio": true, "inscripciones_dadas_de_baja": 2}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION (estatus), NO_ENCONTRADO.
 */
export async function alumnoCambiarEstatus(args = {}, opts = {}) {
    return callRpc('api_alumno_cambiar_estatus', args, opts);
}

/**
 * api_grupos_listar: Lista grupos con filtro de periodo y texto (paginada), del periodo mas reciente al mas antiguo.
 * Roles: administrador (todos); docente (solo los suyos, por RLS).
 *
 * @param {object} [args]
 * @param {string} [args.periodo] p_periodo text (def. NULL).
 * @param {string} [args.q] p_q text (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total": 2, "items": [{"id_grupo": 1, "periodo": "2026-2", "clave_grupo": "3A", "id_materia": 1, "materia_clave": "ADM101", "materia_nombre": "Administracion I", "id_docente": 1, "docente_nombre": "Lopez Ruiz Ana", "id_aula": 1, "aula_clave": "A-12", "inscritos_activos": 4, "sesiones_total": 3}]}
 * @throws {ApiError} NO_AUTORIZADO (alumno, tecnico), PERIODO_INVALIDO.
 */
export async function gruposListar(args = {}, opts = {}) {
    return callRpc('api_grupos_listar', args, opts);
}

/**
 * api_grupo_obtener: Ficha de un grupo con horario, aula y camaras, inscritos y sesiones (P-09).
 * Roles: administrador; docente (solo sus grupos; sin direccion_ip de camaras).
 *
 * @param {object} [args]
 * @param {number} args.idGrupo p_id_grupo integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_grupo": 1, "periodo": "2026-2", "clave_grupo": "3A", "materia_clave": "ADM101", "docente_nombre": "Lopez Ruiz Ana", "aula_clave": "A-12", "horario": [{"id_horario": 1, "dia_semana": 1, "hora_inicio": "07:00:00", "hora_fin": "08:00:00"}], "aula": {"id_aula": 1, "clave": "A-12", "edificio": "A", "capacidad": 40, "camaras": [{"id_camara": 1, "posicion": "frente", "tipo": "ip", "direccion_ip": "10.20.0.12", "estatus": "activa"}]}, "inscritos": {"activos": 4, "baja": 1, "capacidad_aula": 40}, "sesiones": {"total": 3, "programadas": 1, "abiertas": 1, "cerradas": 1, "suspendidas": 0}}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente no es el titular).
 */
export async function grupoObtener(args = {}, opts = {}) {
    return callRpc('api_grupo_obtener', args, opts);
}

/**
 * api_grupo_guardar: Da de alta (sin id_grupo) o modifica (con id_grupo) un grupo: materia + clave_grupo + periodo unicos, periodo AAAA-S, docente activo, aula existente. Con inscripciones o sesiones no se cambia materia ni periodo; al cambiar de aula se revalida el horario.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {object|object[]} args.datos p jsonb. Campos (snake_case) en el catálogo; alias aceptado: p.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_grupo": 3, "periodo": "2026-2", "clave_grupo": "3C", "id_materia": 1, "materia_clave": "ADM101", "materia_nombre": "Administracion I", "id_docente": 1, "docente_nombre": "Lopez Ruiz Ana", "id_aula": 1, "aula_clave": "A-12", "creado": true}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION, PERIODO_INVALIDO, NO_ENCONTRADO (grupo, materia, docente o aula), DOCENTE_NO_ACTIVO, DUPLICADO, GRUPO_CON_HISTORIAL, HORARIO_CHOQUE (cambio de aula).
 */
export async function grupoGuardar(args = {}, opts = {}) {
    return callRpc('api_grupo_guardar', args, opts);
}

/**
 * api_horario_guardar: Reemplaza el horario semanal completo de un grupo. Valida dia 1..6, hora_fin > hora_inicio, que los bloques no se traslapen entre si y que no choquen con otros grupos del mismo aula y periodo (bloques contiguos no chocan). No modifica sesiones ya generadas.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {number} args.idGrupo p_id_grupo integer.
 * @param {object|object[]} args.bloques p_bloques jsonb.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_grupo": 1, "id_aula": 1, "bloques": [{"id_horario": 9, "dia_semana": 1, "hora_inicio": "07:00:00", "hora_fin": "08:00:00"}]}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (grupo), VALIDACION (arreglo vacio o demasiado grande), HORARIO_INVALIDO (dia, hora, fin <= inicio, traslape propio), HORARIO_CHOQUE (otro grupo del aula).
 */
export async function horarioGuardar(args = {}, opts = {}) {
    return callRpc('api_horario_guardar', args, opts);
}

/**
 * api_generar_sesiones: Crea sesiones 'programada' a partir del horario del grupo entre dos fechas (inclusivas), copiando tolerancia_min, limite_presente_min e intervalo_muestreo_seg de los parametros vigentes; el modo nace automatico si el aula tiene alguna camara activa y manual si no. Idempotente por (grupo, fecha, hora_inicio): lo ya existente se omite, no se modifica.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {number} args.idGrupo p_id_grupo integer.
 * @param {string} args.desde p_desde date.
 * @param {string} args.hasta p_hasta date.
 * @param {string[]} [args.omitirFechas] p_omitir_fechas date[] (def. '{}').
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_grupo": 1, "desde": "2026-09-01", "hasta": "2026-09-30", "creadas": 12, "omitidas": 3, "omitidas_por_fecha": 1, "ya_existentes": 2, "modo_registro": "automatico", "parametros": {"tolerancia_min": 20, "limite_presente_min": 10, "intervalo_muestreo_seg": 15}}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (grupo), VALIDACION (rango), GRUPO_SIN_HORARIO.
 */
export async function generarSesiones(args = {}, opts = {}) {
    return callRpc('api_generar_sesiones', args, opts);
}

/**
 * api_inscribir: Inscribe a un alumno activo en un grupo. Sin duplicados: si ya esta activo se rechaza; si estaba en baja se reactiva la misma fila con fecha_alta de hoy.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {number} args.idGrupo p_id_grupo integer.
 * @param {number} args.idAlumno p_id_alumno integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_inscripcion": 7, "id_grupo": 1, "id_alumno": 3, "estatus": "activa", "fecha_alta": "2026-09-14", "derecho_examen": true, "reinscrita": false}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (grupo o alumno), ALUMNO_NO_ACTIVO, INSCRIPCION_DUPLICADA.
 */
export async function inscribir(args = {}, opts = {}) {
    return callRpc('api_inscribir', args, opts);
}

/**
 * api_inscritos: Lista de inscritos de un grupo (sin paginar: un grupo es acotado) con estatus, alta, derecho a examen y consentimiento vigente.
 * Roles: administrador; docente (solo sus grupos, por RLS).
 *
 * @param {object} [args]
 * @param {number} args.idGrupo p_id_grupo integer.
 * @param {string} [args.estatus] p_estatus text (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_grupo": 1, "total": 5, "items": [{"id_inscripcion": 1, "id_alumno": 1, "matricula": "A001", "nombre_completo": "Ramos Diaz Beatriz", "correo_institucional": "a001@unach.test", "estatus_alumno": "activo", "estatus": "activa", "fecha_alta": "2026-08-03", "derecho_examen": true, "consentimiento_vigente": true}]}
 * @throws {ApiError} NO_AUTORIZADO (alumno, tecnico), NO_ENCONTRADO (grupo inexistente o ajeno al docente), VALIDACION (estatus).
 */
export async function inscritos(args = {}, opts = {}) {
    return callRpc('api_inscritos', args, opts);
}

/**
 * api_baja_inscripcion: Da de baja (logica) una inscripcion: conserva la fila y su historial. Idempotente.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {number} args.idInscripcion p_id_inscripcion integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_inscripcion": 7, "id_grupo": 1, "id_alumno": 3, "estatus": "baja", "cambio": true}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO.
 */
export async function bajaInscripcion(args = {}, opts = {}) {
    return callRpc('api_baja_inscripcion', args, opts);
}

/**
 * api_importar_inscripciones: Carga masiva de inscripciones por lote (maximo 500 filas): por cada fila crea el alumno si su matricula no existe (exige apellido_paterno, nombres y correo) o reutiliza el existente (sin modificar sus datos) y lo inscribe. Cada fila se valida y se ejecuta en su propia subtransaccion: las malas no deshacen las buenas. Una fila ya inscrita se reporta como omitida; un alumno que no esta activo, como error.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {number} args.idGrupo p_id_grupo integer.
 * @param {object|object[]} args.filas p_filas jsonb.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_grupo": 1, "total": 3, "inscritos": 1, "reinscritos": 0, "omitidos": 1, "errores": 1, "alumnos_creados": 1, "filas": [{"fila": 1, "matricula": "A101", "resultado": "inscrito", "codigo": null, "mensaje": "Alumno creado e inscrito.", "alumno_creado": true}]}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (grupo), VALIDACION (lote vacio o de mas de 500). Por fila: resultado inscrito|reinscrito|omitido|error con codigo VALIDACION, DUPLICADO, ALUMNO_NO_ACTIVO, INSCRIPCION_DUPLICADA o ERROR_FILA.
 */
export async function importarInscripciones(args = {}, opts = {}) {
    return callRpc('api_importar_inscripciones', args, opts);
}

/**
 * api_aulas_listar: Lista aulas con conteo de camaras (paginada).
 * Roles: administrador (todas); docente (solo aulas de sus grupos, por RLS).
 *
 * @param {object} [args]
 * @param {string} [args.q] p_q text (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total": 2, "items": [{"id_aula": 1, "clave": "A-12", "edificio": "A", "capacidad": 40, "camaras_total": 2, "camaras_activas": 2}]}
 * @throws {ApiError} NO_AUTORIZADO (alumno, tecnico).
 */
export async function aulasListar(args = {}, opts = {}) {
    return callRpc('api_aulas_listar', args, opts);
}

/**
 * api_aula_obtener: Ficha de un aula con sus camaras (la direccion IP solo se entrega al administrador).
 * Roles: administrador; docente (solo aulas de sus grupos).
 *
 * @param {object} [args]
 * @param {number} args.idAula p_id_aula integer.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_aula": 1, "clave": "A-12", "edificio": "A", "capacidad": 40, "camaras": [{"id_camara": 1, "id_aula": 1, "posicion": "frente", "tipo": "ip", "direccion_ip": "10.20.0.12", "estatus": "activa"}]}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente no la usa).
 */
export async function aulaObtener(args = {}, opts = {}) {
    return callRpc('api_aula_obtener', args, opts);
}

/**
 * api_aula_guardar: Da de alta (sin id_aula) o modifica (con id_aula) un aula.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {object|object[]} args.datos p jsonb. Campos (snake_case) en el catálogo; alias aceptado: p.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_aula": 3, "clave": "C-01", "edificio": "C", "capacidad": 30, "creado": true}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, DUPLICADO (clave), AULA_CAPACIDAD_INSUFICIENTE (menor que los inscritos activos de un grupo).
 */
export async function aulaGuardar(args = {}, opts = {}) {
    return callRpc('api_aula_guardar', args, opts);
}

/**
 * api_camaras_listar: Lista las camaras de un aula (o de todas si p_id_aula es null), frente antes que fondo.
 * Roles: administrador (con direccion_ip); docente (camaras de las aulas de sus grupos, direccion_ip null). El tecnico usa api_camaras_estado.
 *
 * @param {object} [args]
 * @param {number} [args.idAula] p_id_aula integer (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total": 2, "items": [{"id_camara": 1, "id_aula": 1, "aula_clave": "A-12", "posicion": "frente", "tipo": "ip", "direccion_ip": "10.20.0.12", "estatus": "activa"}]}
 * @throws {ApiError} NO_AUTORIZADO (alumno, tecnico), NO_ENCONTRADO (aula inexistente o ajena al docente).
 */
export async function camarasListar(args = {}, opts = {}) {
    return callRpc('api_camaras_listar', args, opts);
}

/**
 * api_camara_guardar: Da de alta (sin id_camara) o modifica (con id_camara) una camara de un aula: una por posicion (frente|fondo); la direccion IP es obligatoria solo para tipo ip (en navegador se descarta). No cambia una camara de aula. No altera sesiones ya abiertas.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {object|object[]} args.datos p jsonb. Campos (snake_case) en el catálogo; alias aceptado: p.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_camara": 4, "id_aula": 1, "posicion": "fondo", "tipo": "ip", "direccion_ip": "10.20.0.13", "estatus": "activa", "creado": true}
 * @throws {ApiError} NO_AUTORIZADO (incluye tecnico), VALIDACION, NO_ENCONTRADO (camara o aula), CAMARA_IP_REQUERIDA, CAMARA_POSICION_DUPLICADA, DUPLICADO (IP en uso).
 */
export async function camaraGuardar(args = {}, opts = {}) {
    return callRpc('api_camara_guardar', args, opts);
}

/**
 * api_usuarios_listar: Lista las cuentas de usuario (paginada); oculta la cuenta de servicio servicio@susan.local.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {string} [args.q] p_q text (def. NULL).
 * @param {string} [args.rol] p_rol text (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total": 7, "items": [{"id_usuario": 2, "correo": "docente1@susan.test", "rol": "docente", "activo": true, "id_docente": 1, "id_alumno": null, "nombre": "Lopez Ruiz Ana", "vinculo": "D001"}]}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION (rol).
 */
export async function usuariosListar(args = {}, opts = {}) {
    return callRpc('api_usuarios_listar', args, opts);
}

/**
 * api_usuario_actualizar: Activa o desactiva una cuenta y/o cambia su rol manteniendo el vinculo coherente (docente exige id_docente, alumno exige id_alumno, administrador y tecnico no llevan vinculo). El correo (identidad en Auth) no se cambia aqui. Un administrador no puede desactivarse ni quitarse el rol a si mismo.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {number} args.idUsuario p_id_usuario integer.
 * @param {object|object[]} args.datos p jsonb. Campos (snake_case) en el catálogo; alias aceptado: p.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_usuario": 5, "correo": "alumno1@susan.test", "rol": "alumno", "activo": false, "id_docente": null, "id_alumno": 4, "cambio": true}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (usuario, docente o alumno; la cuenta de servicio cuenta como inexistente), VALIDACION, ROL_VINCULO_INCOHERENTE, DUPLICADO (el docente o alumno ya tiene cuenta), USUARIO_PROPIO.
 */
export async function usuarioActualizar(args = {}, opts = {}) {
    return callRpc('api_usuario_actualizar', args, opts);
}

/**
 * api_bitacora_listar: Consulta la bitacora de auditoria (solo lectura, mas reciente primero) con filtros opcionales.
 * Roles: administrador (la RLS de bitacora_auditoria lo respalda).
 *
 * @param {object} [args]
 * @param {string} [args.accion] p_accion text (def. NULL).
 * @param {string} [args.entidad] p_entidad text (def. NULL).
 * @param {number} [args.idUsuario] p_id_usuario integer (def. NULL).
 * @param {string} [args.desde] p_desde date (def. NULL).
 * @param {string} [args.hasta] p_hasta date (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total": 1, "items": [{"id_bitacora": 1, "id_usuario": 2, "usuario_correo": "docente1@susan.test", "accion": "consulta", "entidad": "deteccion", "id_registro": 1, "valor_anterior": null, "valor_nuevo": {"fixture": true}, "fecha_hora": "2026-09-14T07:12:00-06:00", "ip_origen": "10.0.0.5"}]}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION (accion o rango de fechas).
 */
export async function bitacoraListar(args = {}, opts = {}) {
    return callRpc('api_bitacora_listar', args, opts);
}

/**
 * api_admin_resumen: Contadores de la portada del administrador. El periodo es el del calendario (ene-jun = 1, jul-dic = 2) o, si no tiene grupos, el mas reciente. camaras.inactivas incluye las en mantenimiento.
 * Roles: administrador.
 *
 * @param {object} [args]
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"fecha": "2026-09-14", "periodo": "2026-2", "alumnos_activos": 6, "docentes_activos": 2, "grupos_periodo": 2, "sesiones_hoy": {"total": 2, "programadas": 0, "abiertas": 2, "cerradas": 0, "suspendidas": 0}, "camaras": {"activas": 2, "inactivas": 1, "en_mantenimiento": 0}, "consentimientos_por_vencer_30d": 0, "plantillas_sin_indexar": 0}
 * @throws {ApiError} NO_AUTORIZADO.
 */
export async function adminResumen(args = {}, opts = {}) {
    return callRpc('api_admin_resumen', args, opts);
}
