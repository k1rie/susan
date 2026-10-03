// Delegado fino: la logica (y sus pruebas) vive en api/_local/handlers (carpeta privada).
import { objeto } from '@/app/api/_local/handlers/storage.js';

export async function GET(request) {
    return objeto(request);
}
