import { compararFechas, diasEntre, esFechaISO, formatearFechaCorta, hoyLocal as hoyDelNavegador, sumarAnios, sumarMeses } from '@/lib/formularios/fechas.js';

/** Fecha corta legible («1 ago 2027»); si no es una fecha real devuelve el texto tal cual. */
export const fechaLegible = (valor) => formatearFechaCorta(valor) || String(valor ?? '');

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
            texto: `Vigente hasta ${fechaLegible(vig.vigencia_hasta)}${sufijo}`,
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
export const hoyLocal = hoyDelNavegador;

export const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;

/** Vigencia que se sugiere al elegir la fecha de firma: un año, que es lo que usa el plantel. */
export const vigenciaSugerida = (fechaFirma) => (esFechaISO(fechaFirma) ? sumarAnios(fechaFirma, 1) : '');

/**
 * Dice cuánto dura la vigencia entre dos fechas: «1 año», «2 años», «6 meses» o «200 días». Es de calendario (no de 365 días):
 * del 1 de agosto de 2026 al 1 de agosto de 2027 es «1 año», aunque sea bisiesto. Devuelve '' si falta una fecha o están al revés.
 */
export function describirVigencia(fechaFirma, vigenciaHasta) {
    if (!esFechaISO(fechaFirma) || !esFechaISO(vigenciaHasta) || compararFechas(vigenciaHasta, fechaFirma) <= 0) return '';
    for (let anios = 1; anios <= 10; anios += 1) {
        if (sumarAnios(fechaFirma, anios) === vigenciaHasta) return `${anios} ${anios === 1 ? 'año' : 'años'}`;
    }
    for (let meses = 1; meses < 120; meses += 1) {
        if (sumarMeses(fechaFirma, meses) === vigenciaHasta) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }
    const dias = diasEntre(fechaFirma, vigenciaHasta);
    return `${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** Validación de conveniencia del formulario de registro (las mismas reglas que api_consentimiento_registrar). */
export function validarConsentimiento({ fechaFirma, vigenciaHasta, documento }, hoy = hoyLocal()) {
    const e = {};
    if (!fechaFirma) e.fechaFirma = 'Indica la fecha de firma.';
    else if (!esFechaISO(fechaFirma)) e.fechaFirma = 'Escribe una fecha de firma válida.';
    else if (fechaFirma > hoy) e.fechaFirma = 'La fecha de firma no puede ser futura.';
    if (!vigenciaHasta) e.vigenciaHasta = 'Indica hasta cuándo es vigente.';
    else if (!esFechaISO(vigenciaHasta)) e.vigenciaHasta = 'Escribe una fecha de vigencia válida.';
    else if (esFechaISO(fechaFirma) && vigenciaHasta <= fechaFirma) e.vigenciaHasta = 'La vigencia debe ser posterior a la firma.';
    else if (vigenciaHasta < hoy) e.vigenciaHasta = 'La vigencia ya terminó: elige una fecha desde hoy.';
    if (!documento) e.documento = 'Adjunta el PDF firmado.';
    return e;
}

/** Pega al campo los rechazos de fecha que redacta la RPC; lo demás (alumno inactivo, red…) es un error general. */
export function mapearErrorConsentimiento(error) {
    if (error?.code !== 'VALIDACION') return null;
    const mensaje = String(error.message ?? '');
    if (/fecha de firma/i.test(mensaje) && !/vigencia/i.test(mensaje)) return { fechaFirma: mensaje };
    if (/vigencia/i.test(mensaje)) return { vigenciaHasta: mensaje };
    return null;
}
