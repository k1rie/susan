// Utilidades de presentación del reporte (sin reglas de negocio: solo formato).

/** 'AAAA-MM-DD' (o ISO) -> 'dd/mm/aaaa' sin pasar por zonas horarias. */
export function fechaCorta(valor) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Fecha y hora de generación en la zona de la institución. */
export function fechaHora(valor, timeZone = 'America/Mexico_City') {
    if (!valor) return '';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone }).format(d);
}

/** Porcentaje con 2 decimales o '—' si no hay dato. */
export function porcentaje(valor) {
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '—';
    return `${Number(valor).toFixed(2)} %`;
}

/** Clase de fila según el derecho a examen. */
export function claseFila(a) {
    if (a.derecho_examen === false || a.supera_limite) return 'bg-ausente-bg';
    if (a.en_limite) return 'bg-retardo-bg';
    return '';
}

/** Etiqueta de texto del derecho a examen (nunca solo color). */
export function etiquetaDerecho(a) {
    if (a.derecho_examen === false || a.supera_limite) return 'Sin derecho';
    if (a.en_limite) return 'En el límite';
    return 'Con derecho';
}
