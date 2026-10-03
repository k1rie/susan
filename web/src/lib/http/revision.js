// Clientes de las rutas de revisión: lecturas de un caso y documentos de justificantes.
import { getJSON, postForm } from './client.js';

/**
 * GET /api/casos/{id}/detecciones.
 * @param {number} idAsistencia
 * @param {{ soloValidas?: boolean, limit?: number, offset?: number, signal?: AbortSignal }} [opts]
 */
export function obtenerDeteccionesCaso(idAsistencia, { soloValidas, limit, offset, signal } = {}) {
    return getJSON(`/api/casos/${encodeURIComponent(idAsistencia)}/detecciones`, {
        query: { solo_validas: soloValidas, limit, offset },
        signal,
    });
}
export const detallesCaso = obtenerDeteccionesCaso;

/**
 * POST /api/justificantes/documento.
 * @param {{ archivo: File | Blob, idSesion: number, idAlumno?: number, signal?: AbortSignal }} p
 * @returns {Promise<{ objeto_documento: string, tipo: string, bytes: number, id_alumno: number }>}
 */
export function subirDocumentoJustificante({ archivo, idSesion, idAlumno, signal }) {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name || 'documento');
    form.append('id_sesion', String(idSesion));
    if (idAlumno !== undefined && idAlumno !== null) form.append('id_alumno', String(idAlumno));
    return postForm('/api/justificantes/documento', form, { signal });
}

/** GET /api/justificantes/{id}/documento -> { id_justificante, tipo, url, expira_en, vigencia_seg }. */
export function obtenerDocumentoJustificante(idJustificante, { signal } = {}) {
    return getJSON(`/api/justificantes/${encodeURIComponent(idJustificante)}/documento`, { signal });
}
export const documentoJustificante = obtenerDocumentoJustificante;
