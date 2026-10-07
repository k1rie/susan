// Filtros de la bitácora (RF-20): del borrador del formulario a los argumentos de api_bitacora_listar.

export const ACCIONES_BITACORA = [
    { value: 'consulta', label: 'Consulta' },
    { value: 'correccion', label: 'Corrección' },
    { value: 'aprobacion_justificante', label: 'Aprobación de justificante' },
    { value: 'rechazo_justificante', label: 'Rechazo de justificante' },
    { value: 'alta_plantilla', label: 'Alta de plantilla' },
    { value: 'alta_consentimiento', label: 'Alta de consentimiento' },
    { value: 'revocacion_consentimiento', label: 'Revocación de consentimiento' },
    { value: 'cambio_parametro', label: 'Cambio de parámetro' },
    { value: 'cierre_sesion', label: 'Cierre de sesión' },
    { value: 'notificacion', label: 'Notificación' },
];
export const etiquetaAccion = (a) => ACCIONES_BITACORA.find((x) => x.value === a)?.label ?? a ?? '';

// Las 18 entidades auditables (ck_bitacora_entidad de 0004_tablas_seguridad.sql): el filtro es una lista cerrada, no texto libre.
export const ENTIDADES_BITACORA = [
    { value: 'alumno', label: 'Alumno' },
    { value: 'asistencia', label: 'Asistencia' },
    { value: 'aula', label: 'Aula' },
    { value: 'camara', label: 'Cámara' },
    { value: 'captura', label: 'Captura' },
    { value: 'consentimiento', label: 'Consentimiento' },
    { value: 'deteccion', label: 'Detección' },
    { value: 'docente', label: 'Docente' },
    { value: 'grupo', label: 'Grupo' },
    { value: 'horario_grupo', label: 'Horario de grupo' },
    { value: 'indice_faiss', label: 'Índice facial' },
    { value: 'inscripcion', label: 'Inscripción' },
    { value: 'justificante', label: 'Justificante' },
    { value: 'materia', label: 'Materia' },
    { value: 'parametro_sistema', label: 'Parámetro del sistema' },
    { value: 'plantilla_facial', label: 'Plantilla facial' },
    { value: 'sesion_clase', label: 'Sesión de clase' },
    { value: 'usuario', label: 'Usuario' },
];
export const etiquetaEntidad = (e) => ENTIDADES_BITACORA.find((x) => x.value === e)?.label ?? e ?? '';

export const FILTROS_VACIOS = { accion: '', entidad: '', idUsuario: '', desde: '', hasta: '' };

/** true si algún filtro tiene valor (para mostrar «Limpiar filtros»). */
export const hayFiltros = (f) => Object.values(f ?? {}).some((v) => String(v ?? '').trim() !== '');

/**
 * @param {typeof FILTROS_VACIOS} f
 * @returns {{ args: object, error: string | null }} args sin vacíos; error si el rango o el usuario no son válidos.
 */
export function armarFiltros(f) {
    const idUsuario = String(f.idUsuario ?? '').trim();
    if (idUsuario && !/^\d+$/.test(idUsuario)) return { args: {}, error: 'El identificador de usuario debe ser un número.' };
    if (f.desde && f.hasta && f.desde > f.hasta) return { args: {}, error: 'La fecha inicial no puede ser posterior a la final.' };
    const args = {};
    if (f.accion) args.accion = f.accion;
    if (f.entidad.trim()) args.entidad = f.entidad.trim();
    if (idUsuario) args.idUsuario = Number(idUsuario);
    if (f.desde) args.desde = f.desde;
    if (f.hasta) args.hasta = f.hasta;
    return { args, error: null };
}

/** JSON legible (sangrado) o null si no hay valor. */
export function jsonLegible(valor) {
    if (valor === null || valor === undefined) return null;
    try {
        return JSON.stringify(valor, null, 2);
    } catch {
        return String(valor);
    }
}

export function formatearFechaHora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
}
