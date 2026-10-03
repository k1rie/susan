// Limitador en memoria para la captura de fotogramas (P-03). Solo servidor.
// Es por proceso: con varias instancias cada una lleva su propia cuenta, lo cual basta para el objetivo
// (evitar que un cliente defectuoso o abusivo sature el servicio de reconocimiento), no para facturación.
import { ApiError } from '@/lib/api/errors';

/** clave -> { ultimo: ms de la última solicitud aceptada, marca: marca_tiempo que la acompañó } */
const registro = new Map();
const MAX_ENTRADAS = 5000;

/** Elimina entradas viejas para que el mapa no crezca sin límite (sesiones que ya terminaron). */
function limpiar(ahora, ventanaMs) {
    if (registro.size < MAX_ENTRADAS) return;
    for (const [clave, entrada] of registro) {
        if (ahora - entrada.ultimo > Math.max(ventanaMs, 60_000)) registro.delete(clave);
    }
    // Último recurso: si todas son recientes, descarta las más antiguas por orden de inserción.
    while (registro.size >= MAX_ENTRADAS) registro.delete(registro.keys().next().value);
}

/**
 * Regla: 1 solicitud por cámara cada >= intervalo/2 segundos (el cliente muestrea cada `intervalo`).
 * Un reintento con la misma `marcaTiempo` que la última aceptada pasa sin consumir cupo: es el mismo
 * fotograma reenviado tras un fallo de red (la captura es idempotente por cámara+marca).
 * @param {{ idUsuario: number, idSesion: number, idCamara: number, intervaloSeg: number,
 *           marcaTiempo?: string | null, ahora?: number }} p
 * @returns {{ permitido: boolean, reintentarEnSeg: number }}
 */
export function consumirCupoCaptura({ idUsuario, idSesion, idCamara, intervaloSeg, marcaTiempo = null, ahora = Date.now() }) {
    const minimoMs = Math.max(1, Number(intervaloSeg) || 15) * 500; // intervalo/2 en ms
    const clave = `${idUsuario}:${idSesion}:${idCamara}`;
    const previa = registro.get(clave);
    if (previa) {
        const transcurrido = ahora - previa.ultimo;
        const mismoFotograma = marcaTiempo !== null && marcaTiempo === previa.marca;
        if (transcurrido < minimoMs && !mismoFotograma) {
            return { permitido: false, reintentarEnSeg: Math.max(1, Math.ceil((minimoMs - transcurrido) / 1000)) };
        }
        if (mismoFotograma) return { permitido: true, reintentarEnSeg: 0 };
    }
    limpiar(ahora, minimoMs);
    registro.set(clave, { ultimo: ahora, marca: marcaTiempo });
    return { permitido: true, reintentarEnSeg: 0 };
}

/** Variante que lanza 429 DEMASIADOS_INTENTOS (el handler agrega Retry-After desde details). */
export function exigirCupoCaptura(parametros) {
    const r = consumirCupoCaptura(parametros);
    if (!r.permitido) {
        throw new ApiError({
            code: 'DEMASIADOS_INTENTOS',
            message: 'Demasiadas capturas seguidas de esta cámara. Espera unos segundos.',
            status: 429,
            details: { reintentar_en_seg: r.reintentarEnSeg },
        });
    }
}

/** Solo para pruebas. */
export function reiniciarLimitador() {
    registro.clear();
}
