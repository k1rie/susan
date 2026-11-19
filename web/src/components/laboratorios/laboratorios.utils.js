// Utilidades puras compartidas por las pantallas de laboratorios (docente y administrador).
// Las fechas llegan como 'AAAA-MM-DD' y las horas como 'HH:MM' (api_laboratorio_*): se formatean sin pasar por la zona
// horaria del navegador para que «16 sep» sea siempre el 16 de septiembre.

export const ESTATUS_SOLICITUD = ['pendiente', 'aprobada', 'rechazada', 'cancelada'];

export const ETIQUETA_ESTATUS = {
    pendiente: 'Pendiente',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada',
    vencida: 'Vencida',
};

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Estatus que se le muestra a la persona: una pendiente cuya hora de inicio ya pasó se ve «vencida». */
export function estatusVisible(solicitud) {
    if (!solicitud) return 'pendiente';
    return solicitud.estatus === 'pendiente' && solicitud.vencida ? 'vencida' : solicitud.estatus;
}

/** 'AAAA-MM-DD' -> Date local a mediodía (el mediodía evita saltos de día por horario de verano); null si no es válida. */
export function fechaDeIso(iso) {
    const m = FECHA.exec(String(iso ?? ''));
    if (!m) return null;
    const [, a, mes, d] = m;
    const f = new Date(Number(a), Number(mes) - 1, Number(d), 12);
    return f.getFullYear() === Number(a) && f.getMonth() === Number(mes) - 1 && f.getDate() === Number(d) ? f : null;
}

/** 'AAAA-MM-DD' -> 'mié 16 sep' (con el año si no es el actual de `hoy`, p. ej. 'mié 16 sep 2027'). '—' si no es válida. */
export function formatoFechaCorta(iso, hoy = null) {
    const f = fechaDeIso(iso);
    if (!f) return '—';
    const base = `${DIAS[f.getDay()]} ${f.getDate()} ${MESES[f.getMonth()]}`;
    const anioHoy = hoy ? fechaDeIso(hoy)?.getFullYear() : null;
    return anioHoy && anioHoy !== f.getFullYear() ? `${base} ${f.getFullYear()}` : base;
}

/** ('10:00', '12:00') -> '10:00 – 12:00'. */
export function rangoHoras(inicio, fin) {
    return `${inicio ?? '—'} – ${fin ?? '—'}`;
}

/** Suma `dias` a una fecha 'AAAA-MM-DD' y devuelve 'AAAA-MM-DD'. */
export function sumarDias(iso, dias) {
    const f = fechaDeIso(iso);
    if (!f) return null;
    f.setDate(f.getDate() + dias);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

/** Lunes de la semana de una fecha 'AAAA-MM-DD' (semana lunes a domingo, como el resto del sistema). */
export function lunesDeSemana(iso) {
    const f = fechaDeIso(iso);
    if (!f) return null;
    const desfase = (f.getDay() + 6) % 7;
    return sumarDias(iso, -desfase);
}

/** Minutos desde medianoche de 'HH:MM'; null si no es válida. */
export function minutosDeHora(hora) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hora ?? ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Duración legible entre dos horas: '2 h', '1 h 30 min', '45 min'; null si el rango no es válido. */
export function duracionTexto(inicio, fin) {
    const a = minutosDeHora(inicio);
    const b = minutosDeHora(fin);
    if (a == null || b == null || b <= a) return null;
    const total = b - a;
    const h = Math.floor(total / 60);
    const min = total % 60;
    if (h === 0) return `${min} min`;
    return min === 0 ? `${h} h` : `${h} h ${min} min`;
}
