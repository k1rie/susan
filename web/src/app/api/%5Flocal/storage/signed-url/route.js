// Delegado fino: la logica (y sus pruebas) vive en api/_local/handlers (carpeta privada).
import { signedUrl } from '@/app/api/_local/handlers/storage.js';

export async function POST(request) {
    return signedUrl(request);
}
