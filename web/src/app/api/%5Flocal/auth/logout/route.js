// Delegado fino: la logica (y sus pruebas) vive en api/_local/handlers (carpeta privada).
import { logout } from '@/app/api/_local/handlers/auth.js';

export async function POST(request) {
    return logout(request);
}
