// POST /api/yo/plantilla/verificar (alumno): multipart { fotos (repetido, 1 a 8) } -> calidad por foto y consistencia entre ellas;
// o { foto } (una sola) -> calidad de esa toma, para la detección en vivo del asistente.
// No guarda nada y no lleva id_alumno ni id_consent: salen de la sesión.
import { handle } from '@/lib/server/route';
import { verificarFotosPropias } from '@/lib/server/autoservicio';
import { MAX_ARCHIVO_BYTES, MAX_FOTOS_PLANTILLA, MAX_PLANTILLA_BYTES_TOTAL } from '@/lib/server/storage';

const MAX_MULTIPART = MAX_PLANTILLA_BYTES_TOTAL + 64 * 1024; // ver la nota de alumnos/[id]/plantilla

export const POST = handle({
    roles: ['alumno'],
    archivos: [
        { campo: 'foto', maxBytes: MAX_ARCHIVO_BYTES, tipos: ['jpg'], requerido: false },
        {
            campo: 'fotos', maxBytes: MAX_ARCHIVO_BYTES, tipos: ['jpg'], requerido: false,
            multiple: true, maxArchivos: MAX_FOTOS_PLANTILLA, maxBytesTotal: MAX_PLANTILLA_BYTES_TOTAL,
        },
    ],
    maxMultipartBytes: MAX_MULTIPART,
}, verificarFotosPropias);
