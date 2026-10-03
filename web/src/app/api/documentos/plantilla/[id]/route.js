// GET /api/documentos/plantilla/{id_plantilla} (admin): URL firmada (<= 300 s) de la foto de la plantilla.
import { handle } from '@/lib/server/route';
import { urlDeDocumento } from '@/lib/server/biometria';
import { paramsId } from '@/lib/server/schemas';

export const GET = handle({ roles: ['administrador'], params: paramsId }, urlDeDocumento('plantilla'));
