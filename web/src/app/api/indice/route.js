// GET /api/indice (técnico/administrador): estado del índice en BD + lo que tiene cargado el servicio.
import { handle } from '@/lib/server/route';
import { indiceEstado } from '@/lib/server/biometria';
import { indiceQuery } from '@/lib/server/schemas';

export const GET = handle({ roles: ['tecnico', 'administrador'], query: indiceQuery }, indiceEstado);
