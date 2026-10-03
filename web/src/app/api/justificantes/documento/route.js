// POST /api/justificantes/documento (alumno propio o docente titular): sube el documento y devuelve su ruta.
import { handle, creado } from '@/lib/server/route';
import { subirDocumentoDeJustificante } from '@/lib/server/revision';
import { justificanteCampos } from '@/lib/server/schemas';
import { MAX_ARCHIVO_BYTES } from '@/lib/server/storage';

export const POST = handle({
    roles: ['alumno', 'docente'],
    fields: justificanteCampos,
    archivos: [{ campo: 'archivo', maxBytes: MAX_ARCHIVO_BYTES, tipos: ['pdf', 'jpg', 'png'] }],
}, async (ctx) => creado(await subirDocumentoDeJustificante(ctx)));
