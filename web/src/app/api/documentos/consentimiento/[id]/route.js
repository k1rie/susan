// GET /api/documentos/consentimiento/{id_consent} (admin): URL firmada (<= 300 s) del PDF firmado.
import { handle } from '@/lib/server/route';
import { urlDeDocumento } from '@/lib/server/biometria';
import { paramsId } from '@/lib/server/schemas';

export const GET = handle({ roles: ['administrador'], params: paramsId }, urlDeDocumento('consentimiento'));
