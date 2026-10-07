// POST /api/yo/plantilla (alumno): multipart { fotos (repetido, 3 a 8) }. Verifica calidad y que el rostro no sea ya de otra matrícula,
// guarda las fotos, registra la plantilla del propio alumno y reconstruye el índice facial. No lleva id_alumno ni id_consent.
import { handle, creado } from '@/lib/server/route';
import { registrarPlantillaPropia } from '@/lib/server/autoservicio';
import { MAX_ARCHIVO_BYTES, MAX_FOTOS_PLANTILLA, MAX_PLANTILLA_BYTES_TOTAL } from '@/lib/server/storage';

export const maxDuration = 300;

// 64 KiB de margen para las cabeceras del multipart; todo cuerpo mayor da 413 limpio antes del tope de 10 MB del proxy de Next.
const MAX_MULTIPART = MAX_PLANTILLA_BYTES_TOTAL + 64 * 1024;

export const POST = handle({
    roles: ['alumno'],
    archivos: [{
        campo: 'fotos', maxBytes: MAX_ARCHIVO_BYTES, tipos: ['jpg'], requerido: false,
        multiple: true, maxArchivos: MAX_FOTOS_PLANTILLA, maxBytesTotal: MAX_PLANTILLA_BYTES_TOTAL,
    }],
    maxMultipartBytes: MAX_MULTIPART,
}, async (ctx) => creado(await registrarPlantillaPropia(ctx)));
