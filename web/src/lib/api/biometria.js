import { callRpc } from './client.js';

// Biometría y consola técnica: consentimientos, plantilla facial, estado del índice, parámetros del sistema, cámaras del técnico y autorización de documentos.
// Cada función = una RPC api_* del catálogo (docs/API-RPC.md): argumentos camelCase sin `p_`.
// `opts.backend` solo hace falta en servidor (RSC/Route Handlers); en el navegador se usa el singleton.

/**
 * api_consentimiento_registrar: Registra un consentimiento firmado (RN-13); conserva el historial.
 * Roles: administrador
 *
 * @param {object} [args]
 * @param {number} args.idAlumno p_id_alumno integer.
 * @param {string} args.fechaFirma p_fecha_firma date.
 * @param {string} args.vigenciaHasta p_vigencia_hasta date.
 * @param {string} args.objetoDocumento p_objeto_documento text.
 * @param {string} [args.ip] p_ip inet (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_consent":9,"id_alumno":17,"fecha_firma":"2026-08-24","vigencia_hasta":"2027-08-23","estatus":"vigente","vigente":true}
 * @throws {ApiError} NO_AUTORIZADO (no es administrador), NO_ENCONTRADO (alumno), ALUMNO_INACTIVO, VALIDACION (fechas), RUTA_INVALIDA
 */
export async function consentimientoRegistrar(args = {}, opts = {}) {
    return callRpc('api_consentimiento_registrar', args, opts);
}

/**
 * api_consentimiento_revocar: Revoca un consentimiento vigente y archiva sus plantillas activas (el alumno pasa a pase manual).
 * Roles: administrador
 *
 * @param {object} [args]
 * @param {number} args.idConsent p_id_consent integer.
 * @param {string} [args.ip] p_ip inet (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_consent":9,"id_alumno":17,"estatus":"revocado","plantillas_archivadas":1,"requiere_reconstruccion":true}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (consentimiento), RN_13_CONSENTIMIENTO_NO_VIGENTE (ya revocado o vencido)
 */
export async function consentimientoRevocar(args = {}, opts = {}) {
    return callRpc('api_consentimiento_revocar', args, opts);
}

/**
 * api_consentimientos_alumno: Historial de consentimientos de un alumno y el vigente (mayor vigencia_hasta).
 * Roles: administrador
 *
 * @param {object} [args]
 * @param {number} args.idAlumno p_id_alumno integer.
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_alumno":17,"vigente":true,"consentimiento_vigente":{"id_consent":9,"fecha_firma":"2026-08-24","vigencia_hasta":"2027-08-23","dias_restantes":344},"total":2,"items":[{"id_consent":9,"fecha_firma":"2026-08-24","vigencia_hasta":"2027-08-23","estatus":"vigente","estatus_efectivo":"vigente","vigente":true,"dias_restantes":344,"plantillas_activas":1,"tiene_documento":true}]}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (alumno)
 */
export async function consentimientosAlumno(args = {}, opts = {}) {
    return callRpc('api_consentimientos_alumno', args, opts);
}

/**
 * api_plantilla_alumno: Plantilla facial activa de un alumno (con su version de indice) y las archivadas paginadas.
 * Roles: administrador
 *
 * @param {object} [args]
 * @param {number} args.idAlumno p_id_alumno integer.
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_alumno":17,"activa":{"id_plantilla":41,"id_consent":9,"fecha_registro":"...","indexada":true,"id_indice":3,"version_indice":"v003","faiss_id":1042,"en_uso":true,"consentimiento_vigente":true}|null,"archivadas":{"total":1,"items":[{"id_plantilla":33,"id_consent":4,"fecha_registro":"..."}]},"indice_en_uso":{"id_indice":3,"version":"v003"}|null}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (alumno)
 */
export async function plantillaAlumno(args = {}, opts = {}) {
    return callRpc('api_plantilla_alumno', args, opts);
}

/**
 * api_plantilla_registrar: Da de alta la plantilla facial (RN-12/RN-13): archiva la activa anterior, inserta la nueva sin indexar y asienta alta_plantilla.
 * Roles: administrador
 *
 * @param {object} [args]
 * @param {number} args.idAlumno p_id_alumno integer.
 * @param {number} args.idConsent p_id_consent integer.
 * @param {string} args.objetoFoto p_objeto_foto text.
 * @param {string} [args.ip] p_ip inet (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_plantilla":41,"id_alumno":17,"id_consent":9,"activa":true,"indexada":false,"plantilla_archivada":33,"fecha_registro":"2026-09-14T09:12:41-06:00","requiere_reconstruccion":true}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (alumno o consentimiento), ALUMNO_INACTIVO, RUTA_INVALIDA, RN_13_CONSENTIMIENTO_AJENO, RN_13_CONSENTIMIENTO_NO_VIGENTE
 */
export async function plantillaRegistrar(args = {}, opts = {}) {
    return callRpc('api_plantilla_registrar', args, opts);
}

/**
 * api_documento_url_autorizar: Autoriza la URL firmada de un documento/foto: devuelve la ruta y la vigencia (<= 300 s) y asienta consulta en bitacora (RF-19).
 * Roles: administrador
 *
 * @param {object} [args]
 * @param {string} args.tipo p_tipo text.
 * @param {number} args.idRegistro p_id_registro integer.
 * @param {string} [args.ip] p_ip inet (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"tipo":"plantilla","id_registro":41,"id_alumno":17,"objeto":"registro/17/<uuid>.jpg","vigencia_seg":300}
 * @throws {ApiError} NO_AUTORIZADO, VALIDACION (tipo), NO_ENCONTRADO
 */
export async function documentoUrlAutorizar(args = {}, opts = {}) {
    return callRpc('api_documento_url_autorizar', args, opts);
}

/**
 * api_indice_estado: Estado del indice facial: version en uso, contadores de plantillas (activas, indexadas, pendientes, obsoletas), si requiere reconstruccion y versiones.
 * Roles: tecnico, administrador
 *
 * @param {object} [args]
 * @param {number} [args.limit] p_limit integer (def. 10).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"en_uso":{"id_indice":3,"version":"v003","dimension":512,"total_vectores":498,"fecha_construccion":"..."}|null,"dimension_configurada":512,"dimension_coincide":true,"plantillas":{"activas":500,"indexadas":498,"pendientes":2,"obsoletas_en_indice":0},"requiere_reconstruccion":true,"pendientes_detalle":[{"id_plantilla":41,"id_alumno":17,"fecha_registro":"..."}],"versiones":{"total":3,"items":[{"id_indice":3,"version":"v003","dimension":512,"total_vectores":498,"fecha_construccion":"...","en_uso":true}]}}
 * @throws {ApiError} NO_AUTORIZADO
 */
export async function indiceEstado(args = {}, opts = {}) {
    return callRpc('api_indice_estado', args, opts);
}

/**
 * api_parametros_listar: Parametros del sistema con tipo, rango, unidad y ultimo editor, en el orden de la Tabla 4.
 * Roles: tecnico, administrador (solo lectura)
 *
 * @param {object} [args]
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total":12,"items":[{"clave":"umbral_similitud","valor":"0.850","tipo":"decimal","minimo":"0.500","maximo":"0.999","unidad":"score","descripcion":"...","actualizado_por":{"id_usuario":3,"correo":"tecnico@example.test"}|null,"fecha_actualizacion":"..."}]}
 * @throws {ApiError} NO_AUTORIZADO
 */
export async function parametrosListar(args = {}, opts = {}) {
    return callRpc('api_parametros_listar', args, opts);
}

/**
 * api_parametro_actualizar: Cambia un parametro del sistema (RNF-02): valida tipo, rango y coherencia, guarda el valor canonico y asienta cambio_parametro. Sin cambio real no escribe ni asienta.
 * Roles: tecnico
 *
 * @param {object} [args]
 * @param {string} args.clave p_clave text.
 * @param {string} args.valor p_valor text.
 * @param {string} [args.ip] p_ip inet (def. NULL).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"clave":"umbral_similitud","valor_anterior":"0.850","valor":"0.900","cambio":true,"tipo":"decimal","advertencias":["..."],"fecha_actualizacion":"...","actualizado_por":{"id_usuario":3,"correo":"tecnico@example.test"}}
 * @throws {ApiError} NO_AUTORIZADO (solo tecnico), PARAMETRO_NO_ENCONTRADO, PARAMETRO_VALOR_INVALIDO (tipo, rango o coherencia)
 */
export async function parametroActualizar(args = {}, opts = {}) {
    return callRpc('api_parametro_actualizar', args, opts);
}

/**
 * api_camaras_estado: Camaras con su estatus, ultima captura, capturas de las ultimas 24 h y si hay sesion abierta en el aula.
 * Roles: tecnico, administrador
 *
 * @param {object} [args]
 * @param {string} [args.estatus] p_estatus estatus_camara (def. NULL).
 * @param {number} [args.limit] p_limit integer (def. 50).
 * @param {number} [args.offset] p_offset integer (def. 0).
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"total":2,"items":[{"id_camara":4,"id_aula":2,"aula_clave":"A-12","edificio":"A","posicion":"frente","tipo":"ip","direccion_ip":"10.20.4.21"|null,"estatus":"activa","ultima_captura":"..."|null,"capturas_24h":160,"sesion_abierta":true}]}
 * @throws {ApiError} NO_AUTORIZADO
 */
export async function camarasEstado(args = {}, opts = {}) {
    return callRpc('api_camaras_estado', args, opts);
}

/**
 * api_camara_cambiar_estatus: Cambia solo el estatus de una camara (RF-22). El modo de las sesiones ya abiertas no cambia; las nuevas lo deciden con las camaras activas (RN-06).
 * Roles: tecnico, administrador
 *
 * @param {object} [args]
 * @param {number} args.idCamara p_id_camara integer.
 * @param {string} args.estatus p_estatus estatus_camara.
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<object>} {"id_camara":5,"id_aula":2,"posicion":"fondo","estatus_anterior":"activa","estatus":"mantenimiento","cambio":true,"advertencias":["..."]}
 * @throws {ApiError} NO_AUTORIZADO, NO_ENCONTRADO (camara), VALIDACION (estatus nulo)
 */
export async function camaraCambiarEstatus(args = {}, opts = {}) {
    return callRpc('api_camara_cambiar_estatus', args, opts);
}
