// GET /api/justificantes/{id}/documento (docente titular): URL firmada del documento, con bitácora previa.
import { handle } from '@/lib/server/route';
import { documentoDeJustificante } from '@/lib/server/revision';
import { paramsId } from '@/lib/server/schemas';

export const GET = handle({ roles: ['docente'], params: paramsId }, documentoDeJustificante);
