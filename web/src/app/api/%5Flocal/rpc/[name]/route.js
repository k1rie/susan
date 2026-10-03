// Delegado fino: la logica (y sus pruebas) vive en api/_local/handlers (carpeta privada).
import { rpc } from '@/app/api/_local/handlers/rpc.js';

export async function POST(request, contexto) {
    return rpc(request, contexto);
}
