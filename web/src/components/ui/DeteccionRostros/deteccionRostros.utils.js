// Geometría pura de los recuadros de detección (sin DOM, sin MediaPipe): pasa una caja en píxeles del fotograma del video a una caja en
// fracciones (0..1) del marco que se ve en pantalla.

/** Holgura que se le da al recuadro (fracción del lado): BlazeFace ajusta la caja a los rasgos y se ve más cómodo si abraza la cabeza. */
export const HOLGURA = 0.12;

/** Cada cuánto se detecta (ms). ~10 por segundo alcanza para seguir a una persona y casi no pesa en el equipo del aula. */
export const INTERVALO_DETECCION_MS = 100;

/** Cuánto se conserva un recuadro cuando el detector deja de verlo (ms): un rostro que parpadea 1-2 cuadros no debe hacerlo desaparecer. */
export const RETENCION_MS = 500;

/** Detecciones fallidas seguidas tras las cuales se da la detección por no disponible (p. ej. sin WebGL ni WASM utilizable). */
export const FALLOS_MAXIMOS = 5;

/**
 * Convierte la caja de un rostro (píxeles del fotograma) en fracciones del marco visible. El <video> se muestra con `object-cover`:
 * se escala hasta cubrir el marco y se recorta lo que sobra, así que el recuadro debe seguir ese mismo recorte. Con `espejo` el video
 * se ve volteado y el recuadro también.
 * @param {{ x: number, y: number, ancho: number, alto: number }} caja píxeles del fotograma
 * @param {{ videoAncho: number, videoAlto: number, cajaAncho: number, cajaAlto: number, espejo?: boolean, holgura?: number }} medidas
 * @returns {{ x: number, y: number, ancho: number, alto: number } | null} fracciones del marco; null si alguna medida no sirve
 */
export function marcoNormalizado(caja, { videoAncho, videoAlto, cajaAncho, cajaAlto, espejo = false, holgura = HOLGURA }) {
    const medidas = [caja?.x, caja?.y, caja?.ancho, caja?.alto, videoAncho, videoAlto, cajaAncho, cajaAlto];
    if (!medidas.every(Number.isFinite) || videoAncho <= 0 || videoAlto <= 0 || cajaAncho <= 0 || cajaAlto <= 0) return null;

    const escala = Math.max(cajaAncho / videoAncho, cajaAlto / videoAlto);
    const desplazamientoX = (cajaAncho - videoAncho * escala) / 2;
    const desplazamientoY = (cajaAlto - videoAlto * escala) / 2;

    const ancho = caja.ancho * escala * (1 + 2 * holgura);
    const alto = caja.alto * escala * (1 + 2 * holgura);
    let x = caja.x * escala + desplazamientoX - caja.ancho * escala * holgura;
    const y = caja.y * escala + desplazamientoY - caja.alto * escala * holgura;
    if (espejo) x = cajaAncho - x - ancho;

    return { x: x / cajaAncho, y: y / cajaAlto, ancho: ancho / cajaAncho, alto: alto / cajaAlto };
}

/**
 * Resultado de `detectForVideo` -> recuadros en fracciones del marco. Descarta las cajas sin medidas válidas.
 * @param {{ boundingBox?: { originX: number, originY: number, width: number, height: number } }[]} detecciones
 */
export function marcosDeDetecciones(detecciones, medidas) {
    return (detecciones ?? [])
        .map((d) => d?.boundingBox && marcoNormalizado({ x: d.boundingBox.originX, y: d.boundingBox.originY, ancho: d.boundingBox.width, alto: d.boundingBox.height }, medidas))
        .filter(Boolean);
}

/** Texto del chip de detección (para lectores de pantalla y para la vista): el recuento se dice con palabras, nunca solo con el recuadro. */
export function textoDeteccion({ estado, cantidad = 0 }) {
    if (estado === 'cargando') return 'Preparando detección…';
    if (estado === 'no-disponible') return 'Detección en vivo no disponible';
    if (cantidad <= 0) return 'Sin rostros a la vista';
    return `${cantidad} ${cantidad === 1 ? 'rostro detectado' : 'rostros detectados'}`;
}
