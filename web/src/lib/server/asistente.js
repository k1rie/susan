// Asistente de IA del docente: bucle de uso de herramientas con la Claude API y respuesta en streaming (NDJSON). Solo servidor.
// La clave ANTHROPIC_API_KEY vive solo aquí (serverEnv); los datos salen de las RPC con la sesión del docente (asistenteHerramientas.js).
// Contrato: docs/api/asistente.md.
import Anthropic from '@anthropic-ai/sdk';
import * as z from 'zod';
import { ApiError } from '@/lib/api/errors';
import { serverEnv } from '@/config';
import { DEFINICIONES_HERRAMIENTAS, ejecutarHerramienta, etiquetaHerramienta } from './asistenteHerramientas.js';

export const MODELO_ASISTENTE = 'claude-opus-5-5';
const MAX_TOKENS = 16000;
// Tope de vueltas modelo -> herramientas -> modelo por pregunta: evita bucles caros si algo sale mal.
const MAX_VUELTAS = 6;
const MAX_REINTENTOS_JSON = 2;

// Fijo y sin datos variables (fecha, nombre): así el prefijo tools + system se reutiliza en la caché entre peticiones.
export const SISTEMA = [
    'Eres el asistente de SUSAN, el sistema de registro de asistencia académica de la UNACH (FCA C-I). Ayudas a un docente a entender',
    'la asistencia de SUS grupos: alumnos en riesgo de perder el derecho a examen, ausentismo por grupo, sesiones de hoy y justificantes',
    'pendientes.',
    '',
    'Reglas:',
    '- Toda cifra, nombre o fecha que des sale de una herramienta en esta conversación. Si no tienes el dato, consúltalo; si ninguna',
    '  herramienta lo da, dilo. Nunca inventes ni estimes cifras.',
    '- Para la fecha de hoy y el id_grupo de un grupo usa panel_docente.',
    '- Reglas de negocio: un alumno pierde el derecho a examen al superar el límite de faltas (limite_pct, normalmente 20 %);',
    '  retardos_por_ausencia retardos (normalmente 3) cuentan como una falta equivalente; los registros pendientes no cuentan hasta',
    '  resolverse.',
    '- Responde en español de México, breve y directo: primero la respuesta, luego el detalle. Texto plano, sin Markdown ni tablas;',
    '  para listas usa una línea por elemento que empiece con «- ». Máximo unas 10 líneas salvo que el docente pida más.',
    '- Menciona alumnos por nombre y matrícula solo cuando la pregunta lo requiera. No pidas ni repitas datos personales de más.',
    '- No puedes cambiar nada (no registras asistencias ni resuelves justificantes). Si te lo piden, indica en qué pantalla hacerlo:',
    '  Pasar lista, Revisión (pendientes y justificantes), Reportes o Analítica.',
    '- Si preguntan algo ajeno a la asistencia de sus grupos, dilo en una línea y ofrece lo que sí puedes responder.',
].join('\n');

// Cuerpo de POST /api/asistente. Tope de historial y de texto: acota el costo por pregunta y el tamaño de lo que se manda a Claude.
const MAX_MENSAJES = 20;
const MAX_TEXTO = 2000;

export const asistenteCuerpo = z.object({
    mensajes: z.array(z.object({
        rol: z.enum(['usuario', 'asistente']),
        texto: z.string().trim().min(1).max(MAX_TEXTO),
    }).strict()).min(1).max(MAX_MENSAJES)
        .refine((m) => m[m.length - 1].rol === 'usuario', 'El último mensaje debe ser del usuario.')
        .refine((m) => m.every((x, i) => i === 0 || x.rol !== m[i - 1].rol), 'Los mensajes deben alternar usuario y asistente.')
        .refine((m) => m[0].rol === 'usuario', 'La conversación empieza con un mensaje del usuario.'),
}).strict();

/** true si hay clave configurada en el servidor. Sin clave el asistente queda desactivado (la UI muestra el aviso). */
export const asistenteDisponible = () => Boolean(serverEnv().anthropicApiKey);

let clienteCache = null;
let claveCache = '';
function cliente() {
    const { anthropicApiKey } = serverEnv();
    if (!anthropicApiKey) {
        throw new ApiError({
            code: 'ASISTENTE_NO_CONFIGURADO',
            message: 'El asistente de IA no está configurado. Pide al administrador que agregue la clave de la Claude API.',
            status: 503,
        });
    }
    if (!clienteCache || claveCache !== anthropicApiKey) {
        clienteCache = new Anthropic({ apiKey: anthropicApiKey, maxRetries: 2, timeout: 120_000 });
        claveCache = anthropicApiKey;
    }
    return clienteCache;
}

/** Historial de la UI ({ rol, texto }) -> mensajes de la Messages API. Solo texto: los datos se vuelven a consultar en cada pregunta. */
export function aMensajes(mensajes) {
    return mensajes.map((m) => ({ role: m.rol === 'asistente' ? 'assistant' : 'user', content: m.texto }));
}

/**
 * Contenido de una respuesta que se devuelve a la API en la siguiente vuelta. Tras un `fallback` a mitad de la salida se omiten los
 * bloques de razonamiento y de herramienta anteriores al último `fallback` (reglas de eco de los fallbacks del servidor).
 */
export function contenidoParaHistorial(contenido) {
    const ultimo = contenido.map((b) => b.type).lastIndexOf('fallback');
    if (ultimo < 0) return contenido;
    const omitir = new Set(['thinking', 'redacted_thinking', 'tool_use', 'server_tool_use']);
    return contenido.filter((b, i) => i >= ultimo || !omitir.has(b.type));
}

/** Herramientas que hay que ejecutar: las posteriores al último `fallback` (las previas pertenecen al intento rechazado). */
function herramientasPedidas(contenido) {
    const ultimo = contenido.map((b) => b.type).lastIndexOf('fallback');
    return contenido.filter((b, i) => i > ultimo && b.type === 'tool_use');
}

const MENSAJE_RECHAZO = 'No puedo ayudarte con esa consulta. Pregúntame por la asistencia de tus grupos.';

/** Error de la Claude API -> { code, message } apto para el docente (sin detalles del proveedor). */
export function errorDeClaude(e) {
    if (e instanceof ApiError) return { code: e.code, message: e.message };
    if (e instanceof Anthropic.RateLimitError) {
        return { code: 'ASISTENTE_OCUPADO', message: 'El asistente está atendiendo muchas consultas. Inténtalo en un minuto.' };
    }
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
        return { code: 'ASISTENTE_NO_CONFIGURADO', message: 'La clave de la Claude API no es válida. Avisa al administrador.' };
    }
    if (e instanceof Anthropic.APIConnectionError) {
        return { code: 'ASISTENTE_SIN_CONEXION', message: 'No se pudo conectar con el asistente. Inténtalo de nuevo.' };
    }
    return { code: 'ASISTENTE_ERROR', message: 'El asistente no pudo responder. Inténtalo de nuevo.' };
}

/**
 * Corre la conversación y emite eventos:
 *   { tipo: 'texto', texto }                 fragmento de la respuesta
 *   { tipo: 'herramienta', nombre, etiqueta } se está consultando un dato
 *   { tipo: 'fin', motivo }                  'completo' | 'rechazo' | 'limite'
 * Lanza en errores de la API (el llamador los convierte con errorDeClaude).
 * @param {{ mensajes: {rol: string, texto: string}[], rpc: Function, emitir: (evento: object) => void, signal?: AbortSignal }} p
 */
export async function conversar({ mensajes, rpc, emitir, signal }) {
    const anthropic = cliente();
    const historial = aMensajes(mensajes);
    let reintentosJson = 0;

    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta += 1) {
        const stream = anthropic.beta.messages.stream(
            {
                model: MODELO_ASISTENTE,
                max_tokens: MAX_TOKENS,
                // Consultas de datos cortas: esfuerzo medio basta y responde más rápido. El razonamiento adaptativo es el de omisión.
                output_config: { effort: 'medium' },
                cache_control: { type: 'ephemeral' },
                // Si un clasificador rechaza la petición, la API la reintenta en el modelo recomendado (fallbacks del servidor).
                betas: ['server-side-fallback-2026-07-01'],
                fallbacks: 'default',
                system: SISTEMA,
                tools: DEFINICIONES_HERRAMIENTAS,
                messages: historial,
            },
            { signal },
        );
        stream.on('text', (delta) => emitir({ tipo: 'texto', texto: delta }));

        let mensaje;
        try {
            mensaje = await stream.finalMessage();
            reintentosJson = 0;
        } catch (e) {
            // Con eager_input_streaming, una entrada de herramienta ilegible rechaza finalMessage(): se repite la vuelta. Los errores de la
            // API (y la cancelación) se propagan.
            if (e instanceof Anthropic.APIError || e?.name === 'AbortError' || signal?.aborted) throw e;
            if (reintentosJson >= MAX_REINTENTOS_JSON) throw e;
            reintentosJson += 1;
            vuelta -= 1;
            continue;
        }

        if (mensaje.stop_reason === 'refusal') {
            emitir({ tipo: 'texto', texto: `\n${MENSAJE_RECHAZO}` });
            emitir({ tipo: 'fin', motivo: 'rechazo' });
            return;
        }
        const pedidas = herramientasPedidas(mensaje.content);
        if (mensaje.stop_reason === 'pause_turn') {
            historial.push({ role: 'assistant', content: contenidoParaHistorial(mensaje.content) });
            continue;
        }
        if (pedidas.length === 0 || mensaje.stop_reason === 'max_tokens') {
            // end_turn, o una entrada truncada por max_tokens: nunca se ejecuta una herramienta con entrada incompleta.
            emitir({ tipo: 'fin', motivo: mensaje.stop_reason === 'max_tokens' ? 'limite' : 'completo' });
            return;
        }

        historial.push({ role: 'assistant', content: contenidoParaHistorial(mensaje.content) });
        for (const b of pedidas) emitir({ tipo: 'herramienta', nombre: b.name, etiqueta: etiquetaHerramienta(b.name) });
        const resultados = await Promise.all(pedidas.map(async (b) => {
            const r = await ejecutarHerramienta(b.name, b.input, rpc);
            return { type: 'tool_result', tool_use_id: b.id, content: r.contenido, ...(r.ok ? {} : { is_error: true }) };
        }));
        // Todos los resultados en UN mensaje de usuario (uso paralelo de herramientas).
        historial.push({ role: 'user', content: resultados });
    }

    emitir({ tipo: 'texto', texto: '\nLa consulta necesitó demasiados pasos. Prueba con una pregunta más concreta.' });
    emitir({ tipo: 'fin', motivo: 'limite' });
}

// ---------------------------------------------------------------------------------------------------------
// Límite de uso por docente (en memoria, por proceso: frena abusos y bucles del cliente, no es facturación)
// ---------------------------------------------------------------------------------------------------------

const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 30;
const usos = new Map();

/** Lanza 429 DEMASIADOS_INTENTOS si el usuario ya hizo MAX_POR_VENTANA preguntas en los últimos 10 minutos. */
export function exigirCupoAsistente(idUsuario, ahora = Date.now()) {
    const recientes = (usos.get(idUsuario) ?? []).filter((t) => ahora - t < VENTANA_MS);
    if (recientes.length >= MAX_POR_VENTANA) {
        const espera = Math.ceil((VENTANA_MS - (ahora - recientes[0])) / 1000);
        usos.set(idUsuario, recientes);
        throw new ApiError({
            code: 'DEMASIADOS_INTENTOS',
            message: 'Hiciste muchas preguntas seguidas. Espera unos minutos.',
            status: 429,
            details: { reintentar_en_seg: Math.max(1, espera) },
        });
    }
    recientes.push(ahora);
    usos.set(idUsuario, recientes);
    if (usos.size > 5000) usos.delete(usos.keys().next().value);
}

/** Solo pruebas. */
export function reiniciarCupoAsistente() {
    usos.clear();
    clienteCache = null;
    claveCache = '';
}
