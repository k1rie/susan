// Filtros de la bitácora (RF-20): del borrador del formulario a los argumentos de api_bitacora_listar.

export const ACCIONES_BITACORA = [
    { value: 'consulta', label: 'Consulta' },
    { value: 'correccion', label: 'Corrección' },
    { value: 'aprobacion_justificante', label: 'Aprobación de justificante' },
    { value: 'rechazo_justificante', label: 'Rechazo de justificante' },
    { value: 'alta_plantilla', label: 'Alta de plantilla' },
    { value: 'cambio_parametro', label: 'Cambio de parámetro' },
    { value: 'cierre_sesion', label: 'Cierre de sesión' },
    { value: 'notificacion', label: 'Notificación' },
];
export const etiquetaAccion = (a) => ACCIONES_BITACORA.find((x) => x.value === a)?.label ?? a ?? '';

export const FILTROS_VACIOS = { accion: '', entidad: '', idUsuario: '', desde: '', hasta: '' };

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
