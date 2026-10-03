// POST /api/admin/usuarios/{id}/restablecer (admin): nueva contraseña temporal, mostrada una sola vez.
import { handle } from '@/lib/server/route';
import { restablecerUsuario } from '@/lib/server/admin';
import { paramsId } from '@/lib/server/schemas';

export const POST = handle({ roles: ['administrador'], params: paramsId }, restablecerUsuario);
