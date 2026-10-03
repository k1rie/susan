// Plazo de corrección (RN-08): 48 h desde el fin de la sesión; la autoridad es el servidor.

/** Segundos que quedan descontando el tiempo transcurrido localmente desde que llegó el dato. */
export function segundosActuales(segundosRestantes, recibidoMs, ahoraMs) {
    const base = Number(segundosRestantes);
    if (!Number.isFinite(base)) return 0;
    const transcurridos = Math.max(0, (ahoraMs - recibidoMs) / 1000);
    return Math.floor(base - transcurridos);
}

/** «Quedan 31 h 12 min» / «Quedan 42 min» / «Plazo vencido». */
export function formatearPlazo(segundos) {
    if (!Number.isFinite(segundos) || segundos <= 0) return 'Plazo vencido';
    const minutosTotales = Math.max(1, Math.ceil(segundos / 60));
    const horas = Math.floor(minutosTotales / 60);
    const minutos = minutosTotales % 60;
    if (horas === 0) return `Quedan ${minutos} min`;
    return `Quedan ${horas} h ${minutos} min`;
}

/** Fecha límite legible en la zona del plantel. */
export function formatearFechaLimite(iso) {
    if (!iso) return '';
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(fecha);
}

/** Fecha y hora cortas para bitácora y lecturas. */
export function formatearFechaHora(iso) {
    return formatearFechaLimite(iso);
}

/** Solo la hora (lecturas). */
export function formatearHora(iso) {
    if (!iso) return '';
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', timeStyle: 'medium' }).format(fecha);
}
