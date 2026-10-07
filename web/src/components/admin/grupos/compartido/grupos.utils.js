// Utilidades de presentación compartidas por las pantallas de grupos (horas, plurales, formato de sesiones).

/** «1 alumno», «3 alumnos». */
export const plural = (n, singular, pluralTexto = `${singular}s`) => `${n} ${n === 1 ? singular : pluralTexto}`;

/** Minutos -> «45 min», «3 h», «1 h 30 min». */
export function formatoDuracion(minutos) {
    const total = Math.max(0, Math.round(Number(minutos) || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Hora local de un Date como «10:32:05» (para marcar cuándo se hizo una prueba). */
export function horaDe(fecha = new Date()) {
    return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/** «Edificio A»: la base guarda el nombre tal cual lo escribió quien registró el aula (a veces «A», a veces «Edificio A»); no se repite la palabra. */
export function etiquetaEdificio(edificio) {
    const e = String(edificio ?? '').trim();
    if (!e) return '';
    return /^edificio\b/i.test(e) ? e : `Edificio ${e}`;
}
