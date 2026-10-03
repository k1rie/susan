// POST /api/sesiones/{id}/captura (docente titular). Multipart { image, id_camara, marca_tiempo? } para cámaras del
// navegador, o JSON { id_camara, marca_tiempo? } para cámaras IP (el servicio jala el fotograma).
import { handle } from '@/lib/server/route';
import { ejecutarCaptura } from '@/lib/server/captura';
import { capturaCuerpo, paramsId } from '@/lib/server/schemas';

export const maxDuration = 30;

const MAX_IMAGEN_BYTES = 8 * 1024 * 1024;

export const POST = handle({
    roles: ['docente'],
    params: paramsId,
    input: capturaCuerpo,
    fields: capturaCuerpo,
    archivos: [{ campo: 'image', maxBytes: MAX_IMAGEN_BYTES, tipos: ['jpg', 'png'], requerido: false }],
}, ejecutarCaptura);
