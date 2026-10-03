// GET /api/salud: sonda de vida del proceso web. Pública; no toca la BD ni el servicio de reconocimiento.
import { handle } from '@/lib/server/route';

export const GET = handle({ auth: 'publica' }, () => ({ estado: 'ok', hora: new Date().toISOString() }));
