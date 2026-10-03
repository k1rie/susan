// POST /api/alumnos/{id}/plantilla (admin): multipart { foto, id_consent }. Verifica consentimiento y calidad,
// guarda la foto, registra la plantilla y reconstruye el índice facial.
import { handle, creado } from '@/lib/server/route';
import { registrarPlantilla } from '@/lib/server/biometria';
import { paramsId, plantillaCampos } from '@/lib/server/schemas';
import { MAX_ARCHIVO_BYTES } from '@/lib/server/storage';

export const maxDuration = 300;

export const POST = handle({
    roles: ['administrador'],
    params: paramsId,
    fields: plantillaCampos,
    archivos: [{ campo: 'foto', maxBytes: MAX_ARCHIVO_BYTES, tipos: ['jpg'] }],
}, async (ctx) => creado(await registrarPlantilla(ctx)));
