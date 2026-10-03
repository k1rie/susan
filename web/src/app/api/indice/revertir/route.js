// POST /api/indice/revertir (técnico): { id_indice } pone en uso una versión anterior.
import { handle } from '@/lib/server/route';
import { indiceRevertir } from '@/lib/server/biometria';
import { revertirCuerpo } from '@/lib/server/schemas';

export const maxDuration = 120;

export const POST = handle({ roles: ['tecnico'], input: revertirCuerpo }, indiceRevertir);
