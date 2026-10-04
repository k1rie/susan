// Delegado fino: la logica (y sus pruebas) vive en api/_local/handlers (carpeta privada).
import { cambiarReloj, obtenerReloj } from '@/app/api/_local/handlers/reloj.js';

export async function GET(request) {
    return obtenerReloj(request);
}

export async function POST(request) {
    return cambiarReloj(request);
}
