// Errores de la capa de datos. Un solo modelo (ApiError) para RPC, Route Handlers y Auth, de modo que
// las pantallas muestren `error.message` (ya en español) y decidan por `error.code`.

/** Evento global que escucha el AppShell para mandar a /login cuando la sesión caduca. */
export const EVENTO_SESION_EXPIRADA = 'susan:sesion-expirada';

/**
 * Status HTTP por código de negocio. Se agrupa por status para que la tabla sea fácil de auditar contra el
 * registro de códigos de docs/API-RPC.md (la prueba de sincronía falla si falta alguno).
 */
const CODIGOS_POR_STATUS = {
    400: [
        'RUTA_INVALIDA', 'DOCUMENTO_INVALIDO', 'PARAMETRO_INVALIDO', 'PARAMETRO_VALOR_INVALIDO',
        'HORARIO_INVALIDO', 'INDICE_MAPEO_INVALIDO', 'BITACORA_VALORES_REQUERIDOS', 'MARCA_FUTURA', 'ERROR_FILA',
    ],
    401: ['NO_AUTENTICADO', 'CREDENCIALES_INVALIDAS'],
    403: ['CUENTA_INACTIVA', 'NO_AUTORIZADO', 'CUENTA_NO_VINCULADA'],
    404: ['NO_ENCONTRADO', 'PARAMETRO_NO_ENCONTRADO', 'CAMARA_NO_ENCONTRADA', 'ASISTENCIA_NO_ENCONTRADA'],
    409: [
        'DUPLICADO', 'CONFLICTO',
        'ALUMNO_CON_LECTURAS', 'ALUMNO_INACTIVO', 'ALUMNO_NO_ACTIVO', 'ALUMNO_NO_INSCRITO',
        'AULA_CAPACIDAD_INSUFICIENTE', 'CAMARA_FUERA_DE_AULA', 'CAMARA_INACTIVA', 'CAMARA_IP_REQUERIDA',
        'CAMARA_POSICION_DUPLICADA', 'CAPTURA_EN_OTRA_SESION', 'CORREO_RESERVADO', 'DOCENTE_CON_GRUPOS',
        'DOCENTE_NO_ACTIVO', 'ESTADO_NO_JUSTIFICABLE', 'ESTATUS_INVALIDO', 'FUERA_DE_HORARIO',
        'FUERA_DE_VENTANA', 'GRUPO_CON_HISTORIAL', 'GRUPO_SIN_HORARIO', 'HORARIO_CHOQUE',
        'INDICE_DIMENSION_INVALIDA', 'INDICE_MAPEO_INCOMPLETO', 'INDICE_NO_REVERTIBLE', 'INDICE_PLAN_OBSOLETO',
        'INDICE_VERSION_DUPLICADA', 'INSCRIPCION_DUPLICADA', 'JUSTIFICANTE_DUPLICADO', 'JUSTIFICANTE_PENDIENTE',
        'JUSTIFICANTE_YA_RESUELTO', 'REGISTRO_CORREGIDO', 'REGISTRO_DUPLICADO', 'RN_08_PLAZO_VENCIDO',
        'RN_12_INDICE_EN_USO_DUPLICADO', 'RN_13_CONSENTIMIENTO_AJENO', 'RN_13_CONSENTIMIENTO_NO_VIGENTE',
        'ROL_VINCULO_INCOHERENTE', 'SESION_CERRADA', 'SESION_NO_ABIERTA', 'SESION_NO_AUTOMATICA',
        'SESION_NO_CERRADA', 'SESION_SUSPENDIDA', 'SIN_CAMBIO', 'TRANSICION_NO_PERMITIDA', 'USUARIO_PROPIO',
        'VENTANA_TOLERANCIA_ABIERTA',
    ],
    422: [
        'VALIDACION', 'PERIODO_INVALIDO', 'ESTADO_INVALIDO', 'HORA_INVALIDA', 'CONTRASENA_DEBIL', 'CONTRASENA_IGUAL',
    ],
    429: ['DEMASIADOS_INTENTOS'],
    500: ['ERROR_INTERNO', 'CUENTA_SERVICIO_AUSENTE'],
    503: ['ERROR_RED'],
};

/** { [CODIGO]: status } derivado de CODIGOS_POR_STATUS. */
export const STATUS_POR_CODIGO = Object.freeze(Object.fromEntries(
    Object.entries(CODIGOS_POR_STATUS).flatMap(([status, codigos]) => codigos.map((c) => [c, Number(status)])),
));

/**
 * Status HTTP de un código de negocio. Un código no registrado que empiece con RN_ es una regla de negocio
 * (409); cualquier otro desconocido es una solicitud inválida (400).
 * @param {string} code
 * @returns {number}
 */
export function statusForCode(code) {
    if (typeof code !== 'string') return 500;
    const conocido = STATUS_POR_CODIGO[code];
    if (conocido) return conocido;
    if (/^RN_?\d*_/.test(code)) return 409;
    return 400;
}

/** Mensajes seguros para mostrar cuando el origen no trae uno en español (errores que no son P0001). */
const MENSAJES = {
    ERROR_RED: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    ERROR_INTERNO: 'Ocurrió un error inesperado. Inténtalo de nuevo; si persiste, avisa al administrador.',
    DUPLICADO: 'Ya existe un registro con esos datos.',
    CONFLICTO: 'La operación no se puede completar porque hay registros relacionados.',
    VALIDACION: 'Los datos enviados no son válidos.',
    NO_AUTENTICADO: 'Debes iniciar sesión.',
    NO_AUTORIZADO: 'No tienes permiso para realizar esta acción.',
    CUENTA_INACTIVA: 'Tu cuenta está desactivada. Contacta al administrador.',
};

export class ApiError extends Error {
    /**
     * @param {{ code: string, message: string, status?: number, details?: any }} datos
     */
    constructor({ code, message, status = 500, details = null }) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = status;
        this.details = details;
    }

    /** Forma serializable que devuelven los Route Handlers: { error: { code, message, details? } }. */
    toJSON() {
        const salida = { code: this.code, message: this.message };
        if (this.details !== null && this.details !== undefined) salida.details = this.details;
        return salida;
    }
}

function crear(code, details = null, message = MENSAJES[code]) {
    return new ApiError({ code, message, status: statusForCode(code), details });
}

/** Un error de transporte (fetch caído, DNS, conexión rechazada), no uno devuelto por la base de datos. */
function esErrorDeRed(error) {
    if (error instanceof TypeError) return true;
    if (error.name === 'AuthRetryableFetchError' || error.code === 'ERROR_RED') return true;
    if (error.status === 0) return true;
    const texto = `${error.message ?? ''} ${error.details ?? ''}`;
    return /failed to fetch|fetch failed|networkerror|network request failed|load failed|econnrefused|econnreset|enotfound|etimedout|socket hang up/i.test(texto);
}

/** Nombre de la restricción violada: propiedad `constraint` (pg) o el texto "constraint \"x\"" de PostgREST. */
function nombreDeConstraint(error) {
    if (typeof error.constraint === 'string' && error.constraint) return error.constraint;
    const texto = `${error.message ?? ''} ${error.details ?? ''}`;
    const m = texto.match(/constraint "([^"]+)"/i);
    return m ? m[1] : '';
}

/**
 * Traduce el error de `backend.rpc` (forma supabase-js: { message, code, details, hint }) a ApiError.
 * Nunca expone texto crudo de Postgres salvo en P0001, cuyo mensaje lo redactó la propia función SQL.
 * @param {any} error
 * @returns {ApiError}
 */
export function fromRpcError(error) {
    if (error instanceof ApiError) return error;
    if (!error || typeof error !== 'object') {
        return crear('ERROR_INTERNO', typeof error === 'string' ? error : null);
    }
    const sqlstate = typeof error.code === 'string' ? error.code : '';

    if (sqlstate === 'P0001') {
        const hint = typeof error.hint === 'string' ? error.hint.trim() : '';
        if (hint) {
            return new ApiError({
                code: hint,
                message: error.message || MENSAJES[hint] || MENSAJES.ERROR_INTERNO,
                status: statusForCode(hint),
                details: error.details || null,
            });
        }
        // RAISE sin HINT: no es un error de negocio previsto; el texto queda solo en details.
        return crear('ERROR_INTERNO', error.message ?? null);
    }
    if (sqlstate === '23505') return crear('DUPLICADO');
    if (sqlstate === '23503') return crear('CONFLICTO');
    if (sqlstate === '23514') {
        const constraint = nombreDeConstraint(error);
        if (/^rn\d*_/i.test(constraint)) {
            const code = constraint.toUpperCase();
            return new ApiError({
                code,
                message: 'La operación no cumple una regla de negocio del sistema.',
                status: 409,
                details: null,
            });
        }
        return crear('VALIDACION');
    }
    if (sqlstate === '23000') return crear('CONFLICTO');
    if (sqlstate.startsWith('22') || sqlstate === '23502') return crear('VALIDACION');
    if (sqlstate === '42501') return crear('NO_AUTORIZADO');
    if (sqlstate === 'PGRST301' || sqlstate === 'PGRST303' || /jwt expired/i.test(error.message ?? '')) {
        return crear('NO_AUTENTICADO', null, 'Tu sesión expiró. Inicia sesión de nuevo.');
    }
    if (esErrorDeRed(error)) return crear('ERROR_RED');
    return crear('ERROR_INTERNO', error.message ?? null);
}
