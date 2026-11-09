// Cliente de POST /api/asistente: envía el historial y lee la respuesta NDJSON en streaming, un evento por línea.
// Contrato: docs/api/asistente.md.
import { ApiError, EVENTO_SESION_EXPIRADA } from '@/lib/api/errors';
import { errorDeRespuesta } from './client.js';

/** Parte un búfer de texto en líneas completas; devuelve los eventos parseados y el resto sin terminar. */
export function partirLineas(bufer) {
    const lineas = bufer.split('\n');
    const resto = lineas.pop() ?? '';
    const eventos = [];
    for (const linea of lineas) {
        const limpia = linea.trim();
        if (!limpia) continue;
        try {
            eventos.push(JSON.parse(limpia));
        } catch {
            // Línea corrupta: se ignora en vez de perder toda la respuesta.
        }
    }
    return { eventos, resto };
}

/**
 * Pregunta al asistente. `onEvento` recibe cada evento ({ tipo: 'texto' | 'herramienta' | 'fin' | 'error', ... }) al llegar.
 * Lanza ApiError si la ruta responde con error antes de abrir el stream (sesión, validación, cupo, sin clave).
 * @param {{ rol: 'usuario' | 'asistente', texto: string }[]} mensajes
 * @param {{ onEvento: (evento: object) => void, signal?: AbortSignal }} opciones
 */
export async function preguntarAsistente(mensajes, { onEvento, signal } = {}) {
    let respuesta;
    try {
        respuesta = await fetch('/api/asistente', {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { Accept: 'application/x-ndjson', 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensajes }),
            signal,
        });
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        throw new ApiError({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor. Revisa tu conexión.', status: 503 });
    }
    if (!respuesta.ok) {
        const apiError = await errorDeRespuesta(respuesta);
        if (respuesta.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA));
        throw apiError;
    }
    if (!respuesta.body) return;
    const lector = respuesta.body.getReader();
    const decodificador = new TextDecoder();
    let bufer = '';
    for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        bufer += decodificador.decode(value, { stream: true });
        const { eventos, resto } = partirLineas(bufer);
        bufer = resto;
        eventos.forEach((ev) => onEvento?.(ev));
    }
    const { eventos } = partirLineas(`${bufer}${decodificador.decode()}\n`);
    eventos.forEach((ev) => onEvento?.(ev));
}
