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

/**
 * Porcentaje para una tarjeta de cifra (`<StatCard>`): la cifra con 2 decimales (mismo redondeo que `porcentaje`) y el «%» aparte,
 * para que la tarjeta lo pinte como unidad pequeña. Sin dato: guion largo y sin unidad (el «%» no acompaña a un guion).
 * @returns {{ value: string, unit?: string }}
 */
export function cifraPorcentaje(valor) {
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return { value: '—' };
    return { value: Number(valor).toFixed(2), unit: '%' };
}

/** Apoyo de «Alumnos en el límite»: según RN-11 conservan el derecho a examen, pero una falta equivalente más lo pierde. */
export function apoyoEnLimite(cantidad) {
    if (!(cantidad > 0)) return 'Ninguno por ahora';
    return cantidad === 1 ? 'Una falta más y pierde el derecho' : 'Una falta más y pierden el derecho';
}

/** Apoyo de «Sin derecho a examen»: los alumnos que ya superaron el límite de faltas del periodo. */
export function apoyoSinDerecho(cantidad) {
    if (!(cantidad > 0)) return 'Ninguno por ahora';
    return cantidad === 1 ? 'Superó el límite de faltas' : 'Superaron el límite de faltas';
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
