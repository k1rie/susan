// /api/jobs/purgar-fotos-registro: tarea programada. Autoriza con Authorization: Bearer <CRON_SECRET> (tiempo constante).
// Red de seguridad de la purga que ya hace cada reconstrucción del índice: reintenta borrados que fallaron y limpia las
// fotos de plantillas archivadas o anteriores a la extensión 18.
import { handleJob } from '@/lib/server/jobs';

export const maxDuration = 300;

export const POST = handleJob('purgar-fotos-registro');
// Algunos programadores (p. ej. Vercel Cron) solo disparan GET; la autenticación por secreto es idéntica.
export const GET = POST;
