// POST /api/plantilla/verificar (admin): multipart { foto } (heredado) o { fotos (repetido, 1 a 8), id_alumno,
// id_consent } -> calidad por foto y consistencia entre ellas según el servicio de reconocimiento. No guarda nada.
import { handle } from '@/lib/server/route';
import { verificarFoto } from '@/lib/server/biometria';
import { verificarFotosCampos } from '@/lib/server/schemas';
import { MAX_ARCHIVO_BYTES, MAX_FOTOS_PLANTILLA, MAX_PLANTILLA_BYTES_TOTAL } from '@/lib/server/storage';

const MAX_MULTIPART = MAX_PLANTILLA_BYTES_TOTAL + 64 * 1024; // ver la nota de alumnos/[id]/plantilla

export const POST = handle({
    roles: ['administrador'],
    fields: verificarFotosCampos,
    archivos: [
        { campo: 'foto', maxBytes: MAX_ARCHIVO_BYTES, tipos: ['jpg'], requerido: false },
        {
            campo: 'fotos', maxBytes: MAX_ARCHIVO_BYTES, tipos: ['jpg'], requerido: false,
            multiple: true, maxArchivos: MAX_FOTOS_PLANTILLA, maxBytesTotal: MAX_PLANTILLA_BYTES_TOTAL,
        },
    ],
    maxMultipartBytes: MAX_MULTIPART,
}, verificarFoto);
