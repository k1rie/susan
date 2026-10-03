// Clientes de las rutas de biometría: consentimiento, plantilla facial, documentos e índice.
import { getJSON, postForm, postJSON } from './client.js';

/**
 * POST /api/consentimientos. Recibe el FormData armado por el formulario ({ id_alumno, fecha_firma,
 * vigencia_hasta, documento }) o un objeto con esos campos.
 */
export function registrarConsentimiento(datos, { signal } = {}) {
    if (typeof FormData !== 'undefined' && datos instanceof FormData) return postForm('/api/consentimientos', datos, { signal });
    const form = new FormData();
    form.append('id_alumno', String(datos.idAlumno));
    form.append('fecha_firma', datos.fechaFirma);
    form.append('vigencia_hasta', datos.vigenciaHasta);
    form.append('documento', datos.documento, datos.documento.name || 'consentimiento.pdf');
    return postForm('/api/consentimientos', form, { signal });
}

/** POST /api/consentimientos/{id}/revocar. */
export function revocarConsentimiento({ idConsent }, { signal } = {}) {
    return postJSON(`/api/consentimientos/${encodeURIComponent(idConsent)}/revocar`, {}, { signal });
}

/**
 * URL firmada (<= 300 s) de un documento o foto. tipo: 'consentimiento' (idRegistro = id_consent) o
 * 'plantilla' (idRegistro = id_plantilla). Cada consulta queda en bitácora (RF-19).
 * @returns {Promise<{ tipo: string, id_registro: number, url: string, expira_en: string, vigencia_seg: number }>}
 */
export function solicitarUrlDocumento({ tipo, idRegistro }, { signal } = {}) {
    return getJSON(`/api/documentos/${encodeURIComponent(tipo)}/${encodeURIComponent(idRegistro)}`, { signal });
}

/** POST /api/plantilla/verificar -> { rostros, un_solo_rostro, calidad, motivo_rechazo }. */
export function verificarFoto(blob, { signal } = {}) {
    const form = new FormData();
    form.append('foto', blob, 'foto.jpg');
    return postForm('/api/plantilla/verificar', form, { signal });
}

/** POST /api/alumnos/{id}/plantilla -> plantilla registrada + `indice` ({ estado, version }). */
export function registrarPlantilla({ idAlumno, idConsent, foto }, { signal } = {}) {
    const form = new FormData();
    form.append('foto', foto, 'foto.jpg');
    form.append('id_consent', String(idConsent));
    return postForm(`/api/alumnos/${encodeURIComponent(idAlumno)}/plantilla`, form, { signal });
}

/** GET /api/indice -> estado de BD + `servicio` + `sincronizado`. */
export function obtenerEstadoIndice({ limit, offset, signal } = {}) {
    return getJSON('/api/indice', { query: { limit, offset }, signal });
}
export const estadoIndice = obtenerEstadoIndice;

/** POST /api/indice/reconstruir. `completa` reprocesa todas las fotos. */
export function reconstruirIndice({ completa = false } = {}, { signal } = {}) {
    return postJSON('/api/indice/reconstruir', { completa }, { signal });
}

/** POST /api/indice/sincronizar: carga en el servicio la versión en uso de la BD. */
export function sincronizarIndice({ signal } = {}) {
    return postJSON('/api/indice/sincronizar', {}, { signal });
}

/** POST /api/indice/revertir (técnico). */
export function revertirIndice({ idIndice }, { signal } = {}) {
    return postJSON('/api/indice/revertir', { id_indice: idIndice }, { signal });
}
