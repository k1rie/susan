// POST /api/yo/consentimiento/revocar (alumno): retira su propio consentimiento, archiva su plantilla y reconstruye el índice.
import { handle } from '@/lib/server/route';
import { revocarConsentimientoPropio } from '@/lib/server/autoservicio';

export const maxDuration = 300;

export const POST = handle({ roles: ['alumno'] }, revocarConsentimientoPropio);
