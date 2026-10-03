// Clientes de la captura en sesión (POST /api/sesiones/{id}/captura).
import { postForm, postJSON } from './client.js';

/**
 * Envía un fotograma. Cámara del navegador: `imagen` (Blob JPEG). Cámara IP: sin imagen (el servidor la jala).
 * Conviene enviar siempre `marcaTiempo` (ISO 8601): hace idempotente el reintento tras un fallo de red.
 * Un 409 con details.fin_muestreo = true significa "deja de muestrear esta sesión".
 * @param {{ idSesion: number, idCamara: number, imagen?: Blob | null, marcaTiempo?: string | Date, signal?: AbortSignal }} p
 * @returns {Promise<{ id_captura: number, marca_tiempo: string, camara: object, rostros: number, validas: number,
 *   no_atribuidas: number, ya_procesada: boolean, cambios: object[], index_version: string | null }>}
 */
export function enviarCaptura({ idSesion, idCamara, imagen = null, marcaTiempo, signal }) {
    const url = `/api/sesiones/${encodeURIComponent(idSesion)}/captura`;
    const marca = marcaTiempo instanceof Date ? marcaTiempo.toISOString() : marcaTiempo;
    if (imagen) {
        const form = new FormData();
        form.append('image', imagen, 'frame.jpg');
        form.append('id_camara', String(idCamara));
        if (marca) form.append('marca_tiempo', marca);
        return postForm(url, form, { signal });
    }
    return postJSON(url, { id_camara: idCamara, ...(marca ? { marca_tiempo: marca } : {}) }, { signal });
}
