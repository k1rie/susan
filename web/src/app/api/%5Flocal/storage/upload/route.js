// Delegado fino: la logica (y sus pruebas) vive en api/_local/handlers (carpeta privada).
import { upload } from '@/app/api/_local/handlers/storage.js';

export async function POST(request) {
    return upload(request);
}
