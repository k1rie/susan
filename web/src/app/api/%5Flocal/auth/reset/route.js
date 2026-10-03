// Delegado fino: la logica (y sus pruebas) vive en api/_local/handlers (carpeta privada).
import { reset } from '@/app/api/_local/handlers/auth.js';

export async function POST(request) {
    return reset(request);
}
