// POST /api/plantilla/verificar (admin): multipart { foto } -> calidad de la foto según el servicio de reconocimiento.
import { handle } from '@/lib/server/route';
import { verificarFoto } from '@/lib/server/biometria';
import { MAX_ARCHIVO_BYTES } from '@/lib/server/storage';

export const POST = handle({
    roles: ['administrador'],
    archivos: [{ campo: 'foto', maxBytes: MAX_ARCHIVO_BYTES, tipos: ['jpg'] }],
}, verificarFoto);
