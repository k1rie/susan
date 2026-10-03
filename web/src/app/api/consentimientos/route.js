// POST /api/consentimientos (admin): multipart { id_alumno, fecha_firma, vigencia_hasta, documento (PDF) }.
import { handle, creado } from '@/lib/server/route';
import { registrarConsentimiento } from '@/lib/server/biometria';
import { consentimientoCampos } from '@/lib/server/schemas';
import { MAX_CONSENTIMIENTO_BYTES } from '@/lib/server/storage';

export const POST = handle({
    roles: ['administrador'],
    fields: consentimientoCampos,
    archivos: [{ campo: 'documento', maxBytes: MAX_CONSENTIMIENTO_BYTES, tipos: ['pdf'] }],
}, async (ctx) => creado(await registrarConsentimiento(ctx)));
