// Estado del consentimiento a partir de api_consentimientos_alumno.
// Devuelve { estado: 'vigente'|'vencido'|'revocado'|'sin', tone, texto, idConsent, diasRestantes }.
export function resumenConsentimiento(data) {
    const vig = data?.vigente ? data.consentimiento_vigente : null;
    if (vig) {
        const dias = vig.dias_restantes;
        const sufijo = typeof dias === 'number' ? ` (${dias} ${dias === 1 ? 'día' : 'días'})` : '';
        return {
            estado: 'vigente',
            tone: typeof dias === 'number' && dias <= 30 ? 'warning' : 'success',
            texto: `Vigente hasta ${vig.vigencia_hasta}${sufijo}`,
            idConsent: vig.id_consent,
            diasRestantes: dias ?? null,
        };
    }
    const ultimo = data?.items?.[0];
    if (!ultimo) return { estado: 'sin', tone: 'neutral', texto: 'Sin consentimiento', idConsent: null, diasRestantes: null };
    const revocado = (ultimo.estatus_efectivo ?? ultimo.estatus) === 'revocado';
    return {
        estado: revocado ? 'revocado' : 'vencido',
        tone: 'danger',
        texto: revocado ? 'Revocado' : 'Vencido',
        idConsent: null,
        diasRestantes: null,
    };
}

/** Texto del estatus efectivo de una tarjeta del historial. */
export function textoEstatusItem(item) {
    const e = item.estatus_efectivo ?? item.estatus;
    return { vigente: 'Vigente', vencido: 'Vencido', revocado: 'Revocado' }[e] ?? e;
}

/** Fecha local AAAA-MM-DD (para el máximo del campo de firma). */
export function hoyLocal(fecha = new Date()) {
    const dos = (n) => String(n).padStart(2, '0');
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

export const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;

/** Validación de conveniencia del formulario de registro. */
export function validarConsentimiento({ fechaFirma, vigenciaHasta, documento }, hoy = hoyLocal()) {
    const e = {};
    if (!fechaFirma) e.fechaFirma = 'Indique la fecha de firma.';
    else if (fechaFirma > hoy) e.fechaFirma = 'La fecha de firma no puede ser futura.';
    if (!vigenciaHasta) e.vigenciaHasta = 'Indique hasta cuándo es vigente.';
    else if (fechaFirma && vigenciaHasta <= fechaFirma) e.vigenciaHasta = 'La vigencia debe ser posterior a la firma.';
    if (!documento) e.documento = 'Adjunte el PDF firmado.';
    return e;
}
