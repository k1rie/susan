// Pasos de la captura guiada y numeración de las tomas. La interfaz de la captura vive en ../RegistroFacialGuiado.
import { ArrowLeft, ArrowRight, ArrowUp, ScanFace, SunMedium } from 'lucide-react';

// Las indicaciones se leen a la persona fotografiada, por eso van en «tú». Se piden giros suaves (~15 grados):
// con más giro el servicio descarta la toma por no estar de frente. «izquierda/derecha» asume la vista en
// espejo de CameraCapture (facingMode user): la persona ve su propio reflejo.
export const PASOS_TOMA = [
    { clave: 'frente', titulo: 'De frente', indicacion: 'Mira de frente a la cámara, con el rostro dentro del círculo.', Icono: ScanFace, opcional: false },
    { clave: 'izquierda', titulo: 'Gira a la izquierda', indicacion: 'Gira la cabeza un poco hacia tu izquierda (unos 15 grados) sin dejar de ver la cámara.', Icono: ArrowLeft, opcional: false },
    { clave: 'derecha', titulo: 'Gira a la derecha', indicacion: 'Ahora gira un poco hacia tu derecha (unos 15 grados).', Icono: ArrowRight, opcional: false },
    { clave: 'arriba', titulo: 'Inclina hacia arriba', indicacion: 'Levanta ligeramente la barbilla, sin cerrar los ojos.', Icono: ArrowUp, opcional: true },
    { clave: 'variacion', titulo: 'Otra expresión o luz', indicacion: 'Sonríe o cambia un poco la luz o el lugar. Mantén el rostro completo visible.', Icono: SunMedium, opcional: true },
];
export const TOTAL_PASOS = PASOS_TOMA.length;

/**
 * Orden de envío al servidor y de registro: por paso (las tomas sin paso, es decir las subidas como archivo,
 * al final) y después por orden de llegada. La primera es la foto principal de la plantilla.
 */
export function ordenarTomas(tomas) {
    const clave = (t) => (t.paso ?? Number.POSITIVE_INFINITY);
    return [...tomas].sort((a, b) => {
        const d = clave(a) - clave(b);
        if (d !== 0 && !Number.isNaN(d)) return d;
        return a.id - b.id;
    });
}

/**
 * Número visible de cada toma (Map id -> número). En cámara las tomas ocupan su paso (1 a 5) y las subidas
 * siguen desde el 6; en archivo se numera por posición, así «Toma 1» es siempre la primera que se ve.
 */
export function numerarTomas(tomas, modo) {
    const ordenadas = ordenarTomas(tomas);
    const numeros = new Map();
    if (modo === 'camara') {
        let extra = TOTAL_PASOS;
        ordenadas.forEach((t) => {
            if (t.paso != null) numeros.set(t.id, t.paso + 1);
            else {
                extra += 1;
                numeros.set(t.id, extra);
            }
        });
    } else {
        ordenadas.forEach((t, i) => numeros.set(t.id, i + 1));
    }
    return numeros;
}
