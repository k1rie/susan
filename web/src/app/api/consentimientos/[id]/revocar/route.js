// POST /api/consentimientos/{id}/revocar (admin): revoca, archiva sus plantillas y reconstruye el índice.
import { handle } from '@/lib/server/route';
import { revocarConsentimiento } from '@/lib/server/biometria';
import { paramsId } from '@/lib/server/schemas';

export const maxDuration = 300;

export const POST = handle({ roles: ['administrador'], params: paramsId }, revocarConsentimiento);
