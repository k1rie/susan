// POST /api/asistente (docente): JSON { mensajes: [{ rol: 'usuario'|'asistente', texto }] } (el último, del usuario).
// Responde 200 application/x-ndjson en streaming: una línea JSON por evento ({ tipo: 'texto'|'herramienta'|'fin'|'error', ... }).
// Antes de abrir el stream: 401/403 de sesión y rol, 422 de validación, 429 por cupo y 503 ASISTENTE_NO_CONFIGURADO sin clave.
// Contrato: docs/api/asistente.md. Los datos salen de las RPC con la sesión del docente (la RLS limita a sus grupos).
import { ApiError } from '@/lib/api/errors';
import { asistenteCuerpo, asistenteDisponible, conversar, errorDeClaude, exigirCupoAsistente } from '@/lib/server/asistente';
import { handle } from '@/lib/server/route';

export const maxDuration = 120;

export const POST = handle({ roles: ['docente'], input: asistenteCuerpo, maxBodyBytes: 64 * 1024 }, async (ctx) => {
    if (!asistenteDisponible()) {
        throw new ApiError({
            code: 'ASISTENTE_NO_CONFIGURADO',
            message: 'El asistente de IA no está configurado. Pide al administrador que agregue la clave de la Claude API.',
            status: 503,
        });
    }
    exigirCupoAsistente(ctx.me.id_usuario);

    const codificador = new TextEncoder();
    const cancelacion = new AbortController();
    const cuerpo = new ReadableStream({
        async start(controlador) {
            const emitir = (evento) => {
                if (cancelacion.signal.aborted) return;
                controlador.enqueue(codificador.encode(`${JSON.stringify(evento)}\n`));
            };
            try {
                await conversar({ mensajes: ctx.body.mensajes, rpc: ctx.rpc, emitir, signal: cancelacion.signal });
            } catch (e) {
                if (!cancelacion.signal.aborted) {
                    const { code, message } = errorDeClaude(e);
                    // Sin cuerpo, sin texto del proveedor ni PII: solo qué falló.
                    console.error(`[api] POST /api/asistente ${code}`);
                    emitir({ tipo: 'error', code, message });
                }
            } finally {
                if (!cancelacion.signal.aborted) controlador.close();
            }
        },
        cancel() {
            // El docente cerró el panel o la pestaña: se corta la llamada a Claude para no pagar tokens que nadie leerá.
            cancelacion.abort();
        },
    });
    return new Response(cuerpo, {
        status: 200,
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Accel-Buffering': 'no',
        },
    });
});
