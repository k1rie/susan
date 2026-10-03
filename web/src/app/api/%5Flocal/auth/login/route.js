// Delegado fino: la logica (y sus pruebas) vive en api/_local/handlers (carpeta privada).
import { login } from '@/app/api/_local/handlers/auth.js';

export async function POST(request) {
    return login(request);
}
