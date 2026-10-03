// Errores de cámara traducidos a código estable + texto en español.
const MENSAJES = {
    PERMISO_DENEGADO: 'Permiso de cámara denegado. Habilítalo en la configuración del navegador (icono de candado junto a la dirección) y pulsa Reintentar.',
    SIN_CAMARA: 'No se encontró ninguna cámara en este dispositivo.',
    EN_USO: 'La cámara está siendo usada por otra aplicación.',
    NO_SOPORTADO: 'Este navegador no permite usar la cámara.',
    INSEGURO: 'La cámara solo funciona en conexiones seguras (HTTPS).',
    DESCONOCIDO: 'No se pudo iniciar la cámara.',
};

export function crearError(code) {
    const clave = MENSAJES[code] ? code : 'DESCONOCIDO';
    return { code: clave, message: MENSAJES[clave] };
}

export function traducirError(e) {
    switch (e?.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return crearError('PERMISO_DENEGADO');
        case 'NotFoundError':
        case 'OverconstrainedError':
            return crearError('SIN_CAMARA');
        case 'NotReadableError':
        case 'AbortError':
            return crearError('EN_USO');
        default:
            return crearError('DESCONOCIDO');
    }
}

// Restricciones de getUserMedia: cámara exacta si se eligió, si no preferencia de orientación.
export function construirConstraints({ facingMode = 'user', deviceId } = {}) {
    const video = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } };
    return { video, audio: false };
}

// Reduce proporcionalmente si el video excede el máximo; nunca amplía.
export function dimensionesCaptura(vw, vh, maxWidth = 1280, maxHeight = 960) {
    const escala = Math.min(1, maxWidth / vw, maxHeight / vh);
    return { width: Math.round(vw * escala), height: Math.round(vh * escala) };
}

export function periodoCaptura(intervalMs) {
    return Math.max(1000, intervalMs || 0);
}
