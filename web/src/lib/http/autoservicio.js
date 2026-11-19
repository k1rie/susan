// Clientes de las rutas de autoservicio del alumno (/api/yo/*). Ninguna lleva id_alumno ni id_consent: salen de la sesión.
import { postForm, postJSON } from './client.js';

/** POST /api/yo/consentimiento: acepta el aviso (la `version` es la que mostró la pantalla). -> consentimiento registrado. */
export function aceptarAviso({ version }, { signal } = {}) {
    return postJSON('/api/yo/consentimiento', { version_aviso: version, acepto: true }, { signal });
}

/** POST /api/yo/consentimiento/revocar: retira el consentimiento y archiva la plantilla. -> { consentimientos_revocados, plantillas_archivadas, indice? }. */
export function revocarMiConsentimiento({ signal } = {}) {
    return postJSON('/api/yo/consentimiento/revocar', {}, { signal });
}

/**
 * POST /api/yo/plantilla/verificar con TODAS las tomas (1 a 8): misma respuesta que verificarFotos del administrador
 * (estado por foto, consistencia, suficiente). No guarda nada.
 * @param {Blob[]} blobs en el orden de envío (la primera es la foto principal)
 */
export function verificarMisFotos(blobs, { signal } = {}) {
    const form = new FormData();
    blobs.forEach((blob, i) => form.append('fotos', blob, `foto-${i + 1}.jpg`));
    return postForm('/api/yo/plantilla/verificar', form, { signal });
}

/**
 * POST /api/yo/plantilla/verificar con UNA sola toma (campo `foto`): la forma de verificarFoto del administrador
 * ({ rostros, un_solo_rostro, calidad, motivo_rechazo, motivo_codigo }). Es la detección en vivo del asistente. No guarda nada.
 */
export function verificarMiFoto(blob, { signal } = {}) {
    const form = new FormData();
    form.append('foto', blob, 'foto.jpg');
    return postForm('/api/yo/plantilla/verificar', form, { signal });
}

/** POST /api/yo/plantilla con 3 a 8 tomas -> plantilla registrada + `indice` ({ estado, version }) + `muestra`. */
export function registrarMiPlantilla({ fotos }, { signal } = {}) {
    const form = new FormData();
    fotos.forEach((blob, i) => form.append('fotos', blob, `foto-${i + 1}.jpg`));
    return postForm('/api/yo/plantilla', form, { signal });
}
