// GET /api/casos/{id_asistencia}/detecciones (docente titular): lecturas del caso con URL firmadas de los recortes.
import { handle } from '@/lib/server/route';
import { detallesDeCaso } from '@/lib/server/revision';
import { deteccionesQuery, paramsId } from '@/lib/server/schemas';

export const GET = handle({ roles: ['docente'], params: paramsId, query: deteccionesQuery }, detallesDeCaso);
