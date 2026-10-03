// POST /api/indice/reconstruir (técnico/administrador): { completa? } -> nueva versión activada o sin cambios.
import { handle } from '@/lib/server/route';
import { indiceReconstruir } from '@/lib/server/biometria';
import { reconstruirCuerpo } from '@/lib/server/schemas';

export const maxDuration = 300;

export const POST = handle({ roles: ['tecnico', 'administrador'], input: reconstruirCuerpo }, indiceReconstruir);
