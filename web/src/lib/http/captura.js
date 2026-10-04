// Clientes de la captura en sesión (POST /api/sesiones/{id}/captura).
import { postForm, postJSON } from './client.js';

/**
 * Envía un fotograma. Cámara del navegador: `imagen` (Blob JPEG). Cámara IP: sin imagen (el servidor la jala).
 * `marcaTiempo` es OPCIONAL y la pantalla de la sesión ya no la manda: la hora de la captura la estampa el servidor con la hora de
 * negocio (la real en producción; con el reloj de demostración, la simulada). La hora del equipo no es una fuente fiable: si difiere de
 * la del plantel, el servidor rechaza la captura como MARCA_FUTURA. Solo hace falta pasarla para reintentar el MISMO fotograma tras un
 * fallo de red (la captura es idempotente por cámara + marca); el muestreo no reintenta fotogramas, toma uno nuevo en el siguiente ciclo.
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
