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
 * URL firmada (<= 300 s) de un documento o foto. tipo: 'consentimiento' (idRegistro = id_consent),
 * 'plantilla' (idRegistro = id_plantilla; la foto principal) o 'plantilla_foto' (idRegistro = id_foto; una foto
 * concreta de la plantilla). Cada consulta queda en bitácora (RF-19).
 * @returns {Promise<{ tipo: string, id_registro: number, url: string, expira_en: string, vigencia_seg: number }>}
 */
export function solicitarUrlDocumento({ tipo, idRegistro }, { signal } = {}) {
    return getJSON(`/api/documentos/${encodeURIComponent(tipo)}/${encodeURIComponent(idRegistro)}`, { signal });
}

/** POST /api/plantilla/verificar -> { rostros, un_solo_rostro, calidad, motivo_rechazo, motivo_codigo }. Una sola foto (heredado). */
export function verificarFoto(blob, { signal } = {}) {
    const form = new FormData();
    form.append('foto', blob, 'foto.jpg');
    return postForm('/api/plantilla/verificar', form, { signal });
}

/**
 * POST /api/plantilla/verificar con varias tomas. Se mandan TODAS las que se sostienen (1 a 8) en cada llamada:
 * el servidor no guarda sesiones de captura y la consistencia entre fotos solo se puede medir con el conjunto.
 * Exige id_alumno e id_consent (el consentimiento debe estar vigente). No guarda nada.
 * @param {Blob[]} blobs en el orden de envío (la primera es la foto principal)
 * @returns {Promise<{ total: number, aceptadas: number, minimo: number, maximo: number, suficiente: boolean,
 *   consistente: boolean | null, ambiguo: boolean, umbral_coseno: number, coseno_min: number | null,
 *   coseno_medio: number | null, coseno_max_par: number | null, advertencias: string[],
 *   fotos: { indice: number, estado: 'aceptada' | 'calidad' | 'inconsistente' | 'ilegible' | 'duplicada',
 *     rostros: number | null, un_solo_rostro: boolean | null, calidad: object | null, motivo_rechazo: string | null,
 *     motivo_codigo: string | null, coseno_resto: number | null, duplicada_de: number | null }[] }>}
 */
export function verificarFotos(blobs, { idAlumno, idConsent, signal } = {}) {
    const form = new FormData();
    blobs.forEach((blob, i) => form.append('fotos', blob, `foto-${i + 1}.jpg`));
    form.append('id_alumno', String(idAlumno));
    form.append('id_consent', String(idConsent));
    return postForm('/api/plantilla/verificar', form, { signal });
}

/**
 * POST /api/alumnos/{id}/plantilla -> plantilla registrada + `indice` ({ estado, version }) + `muestra`.
 * Con `fotos` (arreglo de 2 a 8 Blob) se registra la plantilla promediada (3 o más: el mínimo lo decide el
 * servicio de reconocimiento); con `foto` se usa el camino heredado de una sola foto.
 * @returns {Promise<{ id_plantilla: number, n_fotos: number, indice: object, version: string | null, muestra: object | null }>}
 */
export function registrarPlantilla({ idAlumno, idConsent, foto, fotos }, { signal } = {}) {
    const form = new FormData();
    if (Array.isArray(fotos)) fotos.forEach((blob, i) => form.append('fotos', blob, `foto-${i + 1}.jpg`));
    else form.append('foto', foto, 'foto.jpg');
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
