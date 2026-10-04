// GET /api/documentos/plantilla_foto/{id_foto} (admin): URL firmada (<= 300 s) de UNA foto de la plantilla (la
// principal sigue en /documentos/plantilla/{id_plantilla}). La RPC asienta la consulta en bitácora (RF-19) antes de firmar.
import { handle } from '@/lib/server/route';
import { urlDeDocumento } from '@/lib/server/biometria';
import { paramsId } from '@/lib/server/schemas';

export const GET = handle({ roles: ['administrador'], params: paramsId }, urlDeDocumento('plantilla_foto'));
