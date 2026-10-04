// POST /api/alumnos/{id}/plantilla (admin): multipart { id_consent, foto | fotos (repetido, 1 a 8) }. Verifica
// consentimiento y calidad (de cada foto y la consistencia entre ellas), guarda las fotos, registra la plantilla
// y reconstruye el índice facial. `foto` es el camino heredado de una sola foto.
import { handle, creado } from '@/lib/server/route';
import { registrarPlantilla } from '@/lib/server/biometria';
import { paramsId, plantillaCampos } from '@/lib/server/schemas';
import { MAX_ARCHIVO_BYTES, MAX_FOTOS_PLANTILLA, MAX_PLANTILLA_BYTES_TOTAL } from '@/lib/server/storage';

export const maxDuration = 300;

// 64 KiB de margen para los campos de texto y las cabeceras del multipart. Todo cuerpo mayor da 413 limpio antes
// de que el proxy de Next (tope 10 MB, trunca en silencio) lo corte y el formData llegue roto.
const MAX_MULTIPART = MAX_PLANTILLA_BYTES_TOTAL + 64 * 1024;

export const POST = handle({
    roles: ['administrador'],
    params: paramsId,
    fields: plantillaCampos,
    archivos: [
        { campo: 'foto', maxBytes: MAX_ARCHIVO_BYTES, tipos: ['jpg'], requerido: false },
        {
            campo: 'fotos', maxBytes: MAX_ARCHIVO_BYTES, tipos: ['jpg'], requerido: false,
            multiple: true, maxArchivos: MAX_FOTOS_PLANTILLA, maxBytesTotal: MAX_PLANTILLA_BYTES_TOTAL,
        },
    ],
    maxMultipartBytes: MAX_MULTIPART,
}, async (ctx) => creado(await registrarPlantilla(ctx)));
