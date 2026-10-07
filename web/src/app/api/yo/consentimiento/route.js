// POST /api/yo/consentimiento (alumno): JSON { version_aviso, acepto: true }. El alumno acepta el aviso con su sesión; el servidor
// genera la constancia PDF y registra el consentimiento. No lleva id_alumno: es el de la sesión.
import { handle, creado } from '@/lib/server/route';
import { aceptarConsentimientoPropio } from '@/lib/server/autoservicio';
import { aceptarAvisoCuerpo } from '@/lib/server/schemas';

export const POST = handle({ roles: ['alumno'], input: aceptarAvisoCuerpo }, async (ctx) => creado(await aceptarConsentimientoPropio(ctx)));
