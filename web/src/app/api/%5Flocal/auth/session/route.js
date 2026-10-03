// Delegado fino: la logica (y sus pruebas) vive en api/_local/handlers (carpeta privada).
import { session } from '@/app/api/_local/handlers/auth.js';

export async function GET(request) {
    return session(request);
}
