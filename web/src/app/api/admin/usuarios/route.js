// POST /api/admin/usuarios (admin): crea la cuenta (Auth + fila usuario) con contraseña temporal de un solo uso.
import { handle, creado } from '@/lib/server/route';
import { crearUsuario } from '@/lib/server/admin';
import { usuarioCrearCuerpo } from '@/lib/server/schemas';

export const POST = handle({ roles: ['administrador'], input: usuarioCrearCuerpo }, async (ctx) => creado(await crearUsuario(ctx)));
