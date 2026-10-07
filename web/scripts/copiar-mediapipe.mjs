// Copia los archivos WASM de MediaPipe (detección de rostros en vivo de la cámara) de node_modules a public/mediapipe/wasm.
// Pesan ~13 MB cada uno: se copian al instalar en vez de versionarlos, y así siempre coinciden con la versión del paquete.
// Solo la variante con SIMD (todos los navegadores actuales); sin ella el detector no arranca y la cámara sigue funcionando sin recuadros.
// No falla la instalación: si el paquete no está, simplemente no hay recuadros de detección.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(raiz, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destino = join(raiz, 'public', 'mediapipe', 'wasm');
const ARCHIVOS = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];

if (!existsSync(origen)) {
    console.warn('[mediapipe] @mediapipe/tasks-vision no está instalado: se omite la copia de los WASM.');
    process.exit(0);
}
mkdirSync(destino, { recursive: true });
for (const archivo of ARCHIVOS) copyFileSync(join(origen, archivo), join(destino, archivo));
console.log(`[mediapipe] ${ARCHIVOS.length} archivos copiados a public/mediapipe/wasm`);
