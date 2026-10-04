// Utilidades puras del panel de pase de lista (CapturaContinua): qué estado muestra la vista de la cámara y de qué fuentes se muestrea.

/**
 * Estado del chip de la vista de cámara.
 *   fuera         la sesión ya no está en ventana de tolerancia: no se toman capturas
 *   pausa         en ventana, pero no se está reconociendo: aún no hay fuente lista (permiso de cámara pendiente), el muestreo se detuvo,
 *                 hay un problema de hora, el servicio de reconocimiento no responde o la simulación ya envió todos sus ciclos
 *   reconociendo  en ventana y muestreando
 * @param {{ activo: boolean, fuenteLista: boolean, detenido?: string | null, problemaReloj?: object | null,
 *   servicioNoDisponible?: boolean, simulacionTerminada?: boolean }} p
 */
export function estadoVista({ activo, fuenteLista, detenido = null, problemaReloj = null, servicioNoDisponible = false, simulacionTerminada = false }) {
    if (!activo) return 'fuera';
    if (!fuenteLista || detenido || problemaReloj || servicioNoDisponible || simulacionTerminada) return 'pausa';
    return 'reconociendo';
}

/** «Cámara frente»: la etiqueta con la que se nombra una cámara del aula. */
export const nombreCamara = (camara) => (camara ? `Cámara ${camara.posicion}` : null);

/** Cámaras del aula que sirven como fuente: del navegador (un fotograma que sube el docente) o IP (el servidor jala la instantánea). */
export function fuentesDeCaptura(camaras) {
    const lista = Array.isArray(camaras) ? camaras : [];
    return {
        navegador: lista.filter((c) => c.tipo === 'navegador' && c.estatus === 'activa'),
        ip: lista.filter((c) => c.tipo === 'ip' && c.estatus === 'activa').map((c) => c.id_camara),
    };
}
