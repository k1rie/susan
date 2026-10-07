// Carga perezosa del detector de rostros de MediaPipe (BlazeFace, corre en el navegador: el video no sale del dispositivo para esto).
// Los archivos viven en este mismo origen: el modelo en public/mediapipe y los WASM los copia scripts/copiar-mediapipe.mjs al instalar.
// Un solo detector por pestaña (promesa compartida): volver a abrir la cámara no recarga ni el modelo ni los 13 MB de WASM.
const BASE = '/mediapipe';

let promesa = null;

const opciones = (delegate) => ({
    baseOptions: { modelAssetPath: `${BASE}/blaze_face_short_range.tflite`, delegate },
    runningMode: 'VIDEO',
    // Menos exigente que el valor por omisión (0.5) para que el recuadro aparezca también con el rostro algo de lado o lejos.
    minDetectionConfidence: 0.4,
});

async function crear() {
    if (typeof WebAssembly === 'undefined') throw new Error('Este navegador no admite WebAssembly.');
    const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const wasm = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
    try {
        return await FaceDetector.createFromOptions(wasm, opciones('GPU'));
    } catch {
        // Sin WebGL (equipos viejos, máquinas virtuales): el mismo modelo en CPU.
        return FaceDetector.createFromOptions(wasm, opciones('CPU'));
    }
}

/** @returns {Promise<{ detectForVideo: (video: HTMLVideoElement, marcaMs: number) => { detections: object[] } }>} */
export function cargarDetector() {
    if (!promesa) {
        promesa = crear().catch((e) => {
            promesa = null; // un fallo de red no debe quedar fijo: la próxima vez se vuelve a intentar
            throw e;
        });
    }
    return promesa;
}
