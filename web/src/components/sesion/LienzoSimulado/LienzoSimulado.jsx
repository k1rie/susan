import { ALTO_FOTOGRAMA, ANCHO_FOTOGRAMA } from '../SimuladorCamara/simuladorCamara.utils.js';

// El lienzo de la cámara simulada: es la vista previa del panel Y el fotograma que se envía (useSimuladorCamara lo pinta y lo codifica a
// JPEG), así que lo que se ve es exactamente lo que recibe el servicio de reconocimiento. Va en su propio componente para que el
// `ref` llegue como prop (`alMontar`, un ref de callback del hook) y no como una propiedad leída del retorno del hook en el render.
//   alMontar = ref de callback del <canvas> · descripcion = texto alternativo (cuántos alumnos y visitantes se ven)
export default function LienzoSimulado({ alMontar, descripcion }) {
    return <canvas ref={alMontar} width={ANCHO_FOTOGRAMA} height={ALTO_FOTOGRAMA} role="img" aria-label={descripcion} className="block size-full object-cover" />;
}
