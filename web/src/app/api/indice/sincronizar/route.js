// POST /api/indice/sincronizar (técnico/administrador): carga en el servicio la versión que la BD tiene en uso.
import { handle } from '@/lib/server/route';
import { indiceSincronizar } from '@/lib/server/biometria';

export const maxDuration = 120;

export const POST = handle({ roles: ['tecnico', 'administrador'] }, indiceSincronizar);
