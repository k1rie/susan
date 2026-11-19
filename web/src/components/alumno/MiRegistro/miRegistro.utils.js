// Funciones puras de «Mi registro facial».

export const PASOS = [
    { id: 'consentimiento', label: 'Aviso y consentimiento' },
    { id: 'rostro', label: 'Tu rostro' },
    { id: 'listo', label: 'Listo' },
];

/** Pasos del Stepper según `registro.paso`: los anteriores quedan hechos y, con el registro completo, los tres. */
export function pasosDe(paso) {
    const actual = PASOS.findIndex((p) => p.id === paso);
    return PASOS.map((p, i) => ({
        ...p,
        estado: paso === 'listo' || i < actual ? 'hecho' : i === actual ? 'actual' : 'pendiente',
    }));
}

/** «7 de octubre de 2027» a partir de una fecha AAAA-MM-DD (sin desfase de zona horaria). */
export function fechaLarga(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(a, m - 1, d)));
}

/** Registros que le quedan hoy (el servidor impone el tope; aquí solo se informa). */
export const registrosRestantes = (registro) => Math.max(0, (registro?.limite_registros_24h ?? 0) - (registro?.registros_24h ?? 0));

/** Quién dio de alta el consentimiento, en palabras del alumno. */
export const origenConsentimiento = (consentimiento) => (consentimiento?.origen === 'alumno'
    ? 'Lo aceptaste en la app'
    : 'Lo registró tu coordinación');

/** Cuántos días le quedan: «Vence hoy», «Vence mañana» o «Vence en 40 días». */
export function textoDiasRestantes(dias) {
    if (!Number.isFinite(dias)) return '';
    if (dias <= 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    return `Vence en ${dias} días`;
}
