// /api/jobs/resolver-pendientes: tarea programada. Autoriza con Authorization: Bearer <CRON_SECRET> (tiempo constante).
import { handleJob } from '@/lib/server/jobs';

export const maxDuration = 300;

export const POST = handleJob('resolver-pendientes');
// Algunos programadores (p. ej. Vercel Cron) solo disparan GET; la autenticación por secreto es idéntica.
export const GET = POST;
