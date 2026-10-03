export const MOTIVOS_RECHAZO = {
    SIN_ROSTRO: 'No se detectó ningún rostro.',
    MULTIPLES_ROSTROS: 'Hay más de un rostro en la imagen.',
    ROSTRO_PEQUENO: 'El rostro es muy pequeño; acérquese a la cámara.',
    NO_FRONTAL: 'Mire de frente a la cámara.',
    POCA_LUZ: 'Falta iluminación.',
    EXCESO_LUZ: 'Exceso de luz o contraluz.',
    BORROSA: 'La imagen está borrosa; mantenga quieta la cámara.',
};

export const textoMotivo = (motivo) => MOTIVOS_RECHAZO[motivo] ?? `Calidad insuficiente (${motivo}).`;

/** La foto sirve para registrar plantilla: un solo rostro y sin motivo de rechazo. */
export function esFotoAceptable(resultado) {
    return Boolean(resultado) && resultado.un_solo_rostro === true && (resultado.motivo_rechazo ?? null) === null;
}

/** Mensaje en español de un error del servicio al verificar o registrar. */
export function mensajeErrorPlantilla(err) {
    if (!err) return '';
    if (err.code === 'FOTO_RECHAZADA') {
        const motivo = err.details?.motivo_rechazo ?? err.details?.motivo;
        return motivo ? textoMotivo(motivo) : err.message;
    }
    if (err.code === 'RECONOCIMIENTO_NO_DISPONIBLE' || err.status === 503) {
        return 'El servicio de reconocimiento no responde; reintente.';
    }
    return err.message;
}

export const esServicioNoDisponible = (err) => err?.code === 'RECONOCIMIENTO_NO_DISPONIBLE' || err?.status === 503;

/** Estado del índice tras registrar: 'lista' | 'indexando'. */
export function estadoIndiceTrasRegistro(indice) {
    return indice?.estado === 'activada' || indice?.estado === 'sin_cambios' ? 'lista' : 'indexando';
}

export const SONDEO_INTERVALO_MS = 5000;
export const SONDEO_MAX_INTENTOS = 24;
