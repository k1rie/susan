import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// Claude simulado: cada llamada a beta.messages.stream consume el siguiente guion { textos, mensaje } (o { error }).
const sdk = vi.hoisted(() => ({ guiones: [], llamadas: [], opciones: [] }));

vi.mock('@anthropic-ai/sdk', () => {
    class APIError extends Error {}
    class RateLimitError extends APIError {}
    class AuthenticationError extends APIError {}
    class PermissionDeniedError extends APIError {}
    class APIConnectionError extends APIError {}
    class Anthropic {
        constructor(opciones) {
            sdk.opciones.push(opciones);
            this.beta = {
                messages: {
                    stream: (params) => {
                        sdk.llamadas.push(structuredClone(params));
                        const guion = sdk.guiones.shift() ?? { mensaje: { stop_reason: 'end_turn', content: [] } };
                        const oyentes = [];
                        return {
                            on(evento, fn) {
                                if (evento === 'text') oyentes.push(fn);
                                return this;
                            },
                            async finalMessage() {
                                if (guion.error) throw guion.error;
                                for (const t of guion.textos ?? []) oyentes.forEach((fn) => fn(t));
                                return guion.mensaje;
                            },
                        };
                    },
                },
            };
        }
    }
    Object.assign(Anthropic, { APIError, RateLimitError, AuthenticationError, PermissionDeniedError, APIConnectionError });
    return { default: Anthropic };
});
vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));

import Anthropic from '@anthropic-ai/sdk';
import { getServerBackend } from '@/lib/backend';
import { reiniciarCupoAsistente } from '@/lib/server/asistente';
import { YO, crearBackend, errorDeNegocio, pedir } from '@/lib/server/testing';
import { POST } from './asistente/route.js';

const CLAVE = 'sk-ant-prueba-no-real';

const ALERTAS = {
    total: 2, sin_derecho: 1, en_limite: 1,
    items: [
        {
            tipo: 'sin_derecho', id_grupo: 5, clave_grupo: 'A1', periodo: '2026-2', materia_clave: 'MAT1', materia_nombre: 'Matemáticas',
            id_alumno: 41, matricula: 'A001', apellido_paterno: 'Pérez', apellido_materno: 'Luna', nombres: 'Ana',
            nombre_completo: 'Pérez Luna Ana', id_inscripcion: 900, sesiones_programadas: 48, presentes: 30, retardos: 2, ausencias: 10,
            justificadas: 0, pendientes: 0, faltas_equivalentes: 10, porcentaje_faltas: 20.83, limite_pct: 20, faltas_maximas_permitidas: 9,
            faltas_restantes_antes_limite: 0, supera_limite: true, en_limite: false, derecho_examen: false,
        },
        {
            tipo: 'en_limite', id_grupo: 5, clave_grupo: 'A1', periodo: '2026-2', materia_clave: 'MAT1', materia_nombre: 'Matemáticas',
            id_alumno: 42, matricula: 'A002', apellido_paterno: 'Ruiz', apellido_materno: 'Sol', nombres: 'Beto',
            nombre_completo: 'Ruiz Sol Beto', id_inscripcion: 901, faltas_equivalentes: 9, porcentaje_faltas: 18.75, limite_pct: 20,
            faltas_restantes_antes_limite: 1, derecho_examen: true,
        },
    ],
};

let usuario;

function preparar({ me = YO.docente, rpcs = {} } = {}) {
    usuario = crearBackend({ rpcs: { api_yo: () => me, api_alertas_docente: () => ALERTAS, ...rpcs } });
    getServerBackend.mockResolvedValue(usuario);
}

const preguntar = (mensajes = [{ rol: 'usuario', texto: '¿Qué alumnos tengo en riesgo?' }]) => POST(pedir('/api/asistente', { json: { mensajes } }));

/** Lee el NDJSON completo de la respuesta. */
async function eventos(res) {
    const texto = await res.text();
    return texto.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const usoHerramienta = (name, input, id = 'tu_1') => ({ type: 'tool_use', id, name, input });

beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = CLAVE;
    reiniciarCupoAsistente();
    sdk.guiones.length = 0;
    sdk.llamadas.length = 0;
    sdk.opciones.length = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    preparar();
});

afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
});

describe('POST /api/asistente', () => {
    it('consulta las alertas con la sesión del docente, manda a Claude solo lo necesario y responde en streaming', async () => {
        sdk.guiones.push(
            { mensaje: { stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '', signature: 'x' }, usoHerramienta('alumnos_en_riesgo', {})] } },
            { textos: ['Tienes 2 alumnos en riesgo:', '\n- Ana (A001)'], mensaje: { stop_reason: 'end_turn', content: [{ type: 'text', text: '...' }] } },
        );
        const res = await preguntar();
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toMatch(/application\/x-ndjson/);
        expect(res.headers.get('cache-control')).toBe('no-store');
        const evs = await eventos(res);
        expect(evs).toEqual([
            { tipo: 'herramienta', nombre: 'alumnos_en_riesgo', etiqueta: 'Buscando alumnos en riesgo' },
            { tipo: 'texto', texto: 'Tienes 2 alumnos en riesgo:' },
            { tipo: 'texto', texto: '\n- Ana (A001)' },
            { tipo: 'fin', motivo: 'completo' },
        ]);

        // La RPC corre con el backend DEL USUARIO (la RLS limita a sus grupos).
        expect(usuario.rpc).toHaveBeenCalledWith('api_alertas_docente', expect.objectContaining({ p_limit: 60 }));

        // Petición a Claude: modelo, herramientas, fallbacks del servidor y la clave solo en el constructor del cliente.
        const [primera, segunda] = sdk.llamadas;
        expect(primera.model).toBe('claude-opus-5-5');
        expect(primera.fallbacks).toBe('default');
        expect(primera.betas).toEqual(['server-side-fallback-2026-07-01']);
        expect(primera.tools.map((t) => t.name)).toEqual([
            'panel_docente', 'alumnos_en_riesgo', 'ausentismo_por_grupo', 'reporte_grupo', 'tendencia_grupo', 'justificantes_pendientes',
        ]);
        expect(primera.messages).toEqual([{ role: 'user', content: '¿Qué alumnos tengo en riesgo?' }]);
        expect(sdk.opciones[0].apiKey).toBe(CLAVE);
        expect(JSON.stringify(primera)).not.toContain(CLAVE);

        // Segunda vuelta: el turno del asistente sin tocar y UN mensaje con el resultado de la herramienta, reducido.
        expect(segunda.messages[1].role).toBe('assistant');
        expect(segunda.messages[1].content[0].type).toBe('thinking');
        const resultado = segunda.messages[2].content[0];
        expect(resultado).toMatchObject({ type: 'tool_result', tool_use_id: 'tu_1' });
        const datos = JSON.parse(resultado.content);
        expect(datos.alumnos[0]).toEqual({
            tipo: 'sin_derecho', matricula: 'A001', nombre: 'Pérez Luna Ana', grupo: 'A1', materia: 'Matemáticas', faltas_equivalentes: 10,
            porcentaje_faltas: 20.83, limite_pct: 20, faltas_restantes_antes_limite: 0, derecho_examen: false,
        });
        expect(resultado.content).not.toMatch(/id_inscripcion|apellido_paterno|id_alumno/);
    });

    it('valida la entrada de la herramienta antes de consultar y devuelve el error a Claude como is_error', async () => {
        sdk.guiones.push(
            { mensaje: { stop_reason: 'tool_use', content: [usoHerramienta('reporte_grupo', { id_grupo: 'x' })] } },
            { textos: ['Necesito el grupo.'], mensaje: { stop_reason: 'end_turn', content: [] } },
        );
        await eventos(await preguntar());
        expect(usuario.llamadas).not.toContain('api_reporte_grupo');
        const resultado = sdk.llamadas[1].messages[2].content[0];
        expect(resultado.is_error).toBe(true);
        expect(JSON.parse(resultado.content).error).toBe('ENTRADA_INVALIDA');
    });

    it('un error de negocio de la RPC llega a Claude solo como código (sin texto de la base)', async () => {
        preparar({ rpcs: { api_reporte_grupo: () => errorDeNegocio('NO_AUTORIZADO', 'grupo 9 de otro docente: detalle interno') } });
        sdk.guiones.push(
            { mensaje: { stop_reason: 'tool_use', content: [usoHerramienta('reporte_grupo', { id_grupo: 9 })] } },
            { textos: ['Ese grupo no es tuyo.'], mensaje: { stop_reason: 'end_turn', content: [] } },
        );
        await eventos(await preguntar());
        const resultado = sdk.llamadas[1].messages[2].content[0];
        expect(resultado.is_error).toBe(true);
        expect(resultado.content).not.toContain('detalle interno');
    });

    it('un rechazo de Claude termina con un mensaje claro y motivo rechazo', async () => {
        sdk.guiones.push({ mensaje: { stop_reason: 'refusal', content: [], stop_details: { type: 'refusal', category: null } } });
        const evs = await eventos(await preguntar());
        expect(evs.at(-1)).toEqual({ tipo: 'fin', motivo: 'rechazo' });
        expect(evs.some((e) => e.tipo === 'texto' && /No puedo ayudarte/.test(e.texto))).toBe(true);
    });

    it('no ejecuta herramientas si la respuesta se cortó por max_tokens', async () => {
        sdk.guiones.push({ mensaje: { stop_reason: 'max_tokens', content: [usoHerramienta('reporte_grupo', { id_grupo: 5 })] } });
        const evs = await eventos(await preguntar());
        expect(usuario.llamadas).not.toContain('api_reporte_grupo');
        expect(evs.at(-1)).toEqual({ tipo: 'fin', motivo: 'limite' });
    });

    it('un error de la Claude API sale como evento de error sin detalles del proveedor', async () => {
        sdk.guiones.push({ error: new Anthropic.RateLimitError('429 overloaded org-123') });
        const evs = await eventos(await preguntar());
        expect(evs).toEqual([{ tipo: 'error', code: 'ASISTENTE_OCUPADO', message: expect.any(String) }]);
        expect(JSON.stringify(evs)).not.toContain('org-123');
    });

    it('503 ASISTENTE_NO_CONFIGURADO sin ANTHROPIC_API_KEY (no llama a Claude)', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        const res = await preguntar();
        expect(res.status).toBe(503);
        expect((await res.json()).error.code).toBe('ASISTENTE_NO_CONFIGURADO');
        expect(sdk.llamadas).toHaveLength(0);
    });

    it('solo el docente: 403 para el alumno y 401 sin sesión', async () => {
        preparar({ me: YO.alumno });
        expect((await preguntar()).status).toBe(403);
        usuario = crearBackend({ user: null });
        getServerBackend.mockResolvedValue(usuario);
        expect((await preguntar()).status).toBe(401);
        expect(sdk.llamadas).toHaveLength(0);
    });

    it('422 si el historial no termina en el usuario, no alterna o trae campos extra', async () => {
        expect((await preguntar([{ rol: 'usuario', texto: 'hola' }, { rol: 'asistente', texto: 'hola' }])).status).toBe(422);
        expect((await preguntar([{ rol: 'usuario', texto: 'a' }, { rol: 'usuario', texto: 'b' }])).status).toBe(422);
        expect((await preguntar([{ rol: 'usuario', texto: 'a', id_alumno: 3 }])).status).toBe(422);
        expect((await preguntar([{ rol: 'usuario', texto: 'x'.repeat(2001) }])).status).toBe(422);
        expect(sdk.llamadas).toHaveLength(0);
    });

    it('429 al pasar el cupo de preguntas por docente', async () => {
        for (let i = 0; i < 30; i += 1) {
            sdk.guiones.push({ textos: ['ok'], mensaje: { stop_reason: 'end_turn', content: [] } });
            await eventos(await preguntar());
        }
        const res = await preguntar();
        expect(res.status).toBe(429);
        expect(res.headers.get('retry-after')).toMatch(/^\d+$/);
    });

    it('tras un fallback a mitad de la salida, no reenvía el razonamiento ni las herramientas del intento rechazado', async () => {
        sdk.guiones.push(
            {
                mensaje: {
                    stop_reason: 'tool_use',
                    content: [
                        { type: 'thinking', thinking: '', signature: 'a' },
                        usoHerramienta('reporte_grupo', { id_grupo: 5 }, 'rechazada'),
                        { type: 'fallback', from: { model: 'claude-opus-5-5' }, to: { model: 'claude-opus-5' } },
                        usoHerramienta('alumnos_en_riesgo', {}, 'buena'),
                    ],
                },
            },
            { textos: ['Listo.'], mensaje: { stop_reason: 'end_turn', content: [] } },
        );
        await eventos(await preguntar());
        expect(usuario.llamadas).not.toContain('api_reporte_grupo');
        const turno = sdk.llamadas[1].messages[1].content;
        expect(turno.map((b) => b.type)).toEqual(['fallback', 'tool_use']);
        expect(sdk.llamadas[1].messages[2].content.map((r) => r.tool_use_id)).toEqual(['buena']);
    });
});
