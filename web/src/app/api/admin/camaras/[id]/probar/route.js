// POST /api/admin/camaras/{id}/probar (admin/técnico): 'ip' pide un fotograma al servicio; 'navegador' no se prueba aquí.
import { handle } from '@/lib/server/route';
import { probarCamara } from '@/lib/server/admin';
import { paramsId } from '@/lib/server/schemas';

export const maxDuration = 30;

export const POST = handle({ roles: ['administrador', 'tecnico'], params: paramsId }, probarCamara);
