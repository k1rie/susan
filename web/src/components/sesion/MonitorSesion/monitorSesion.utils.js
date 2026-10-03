// Utilidades puras de presentacion de la sesion en curso. Las reglas de negocio viven en la BD: aqui solo se
// decide que mostrar y que control habilitar a partir de lo que devuelve api_sesion_monitor.

const ZONA = 'America/Mexico_City';

/** '07:00:00' -> '07:00' */
export const formatearHora = (hhmmss) => (hhmmss ? String(hhmmss).slice(0, 5) : '-');

/** ISO -> 'HH:MM:SS' en la zona del plantel. */
export function formatearHoraIso(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('es-MX', { timeZone: ZONA, hour12: false });
}

/** 'YYYY-MM-DD' -> '14 sep 2026' (sin pasar por Date local para no correr el dia). */
export function formatearFecha(fecha) {
    if (!fecha) return '-';
    const [a, m, d] = String(fecha).slice(0, 10).split('-').map(Number);
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${d} ${meses[m - 1] ?? ''} ${a}`;
}

/** Estado mostrado: el estado real o, sin registro, la etiqueta de pantalla 'sin_lecturas' (no es un estado de BD). */
export const estadoMostrado = (alumno) => alumno.estado ?? 'sin_lecturas';

/** Inscritos activos que el docente puede registrar a mano: sin consentimiento vigente o sin lecturas validas. */
export function requiereRegistroManual(alumno) {
    if (alumno.inscripcion && alumno.inscripcion !== 'activa') return false;
    if (alumno.estado && alumno.origen === 'manual') return false;
    return !alumno.consentimiento_vigente || !(alumno.lecturas_validas > 0);
}

/** Sugerencia de estado segun el minuto transcurrido de la sesion (limite de presente y tolerancia de la propia sesion). */
export function sugerirEstado(sesion) {
    const m = Number(sesion?.minuto_actual);
    if (!Number.isFinite(m)) return 'presente';
    if (m <= Number(sesion.limite_presente_min ?? 10)) return 'presente';
    if (m <= Number(sesion.tolerancia_min ?? 20)) return 'retardo';
    return 'ausente';
}

/** El cierre se habilita cuando la sesion esta abierta y la ventana de tolerancia ya termino. */
export const cierreHabilitado = (sesion) => sesion?.estatus === 'abierta' && sesion.en_ventana === false;

export const ETIQUETA_FASE = {
    presente: 'Presente (dentro del limite de puntualidad)',
    retardo: 'Retardo',
    fuera_de_ventana: 'Fuera de ventana',
};

export const etiquetaScore = (s) => (s == null ? '-' : Number(s).toFixed(2));
