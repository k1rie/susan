// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/docente' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import AsistenteIA from './AsistenteIA.jsx';

/** Respuesta NDJSON en trozos (el último evento partido a la mitad, como llega por la red). */
function respuestaNdjson(eventos) {
    const texto = eventos.map((e) => JSON.stringify(e)).join('\n') + '\n';
    const mitad = Math.floor(texto.length / 2);
    const trozos = [texto.slice(0, mitad), texto.slice(mitad)].map((t) => new TextEncoder().encode(t));
    return new Response(new ReadableStream({
        start(c) {
            trozos.forEach((t) => c.enqueue(t));
            c.close();
        },
    }), { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
}

beforeEach(() => {
    nav.pathname = '/docente';
    vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('AsistenteIA', () => {
    it('abre el panel con sugerencias; una sugerencia pregunta y muestra la respuesta en streaming', async () => {
        fetch.mockResolvedValue(respuestaNdjson([
            { tipo: 'herramienta', nombre: 'alumnos_en_riesgo', etiqueta: 'Buscando alumnos en riesgo' },
            { tipo: 'texto', texto: 'Tienes 1 alumno sin derecho:' },
            { tipo: 'texto', texto: '\n- Ana (A001)' },
            { tipo: 'fin', motivo: 'completo' },
        ]));
        const user = userEvent.setup();
        render(<AsistenteIA />);
        await user.click(screen.getByRole('button', { name: 'Asistente' }));
        const dialogo = screen.getByRole('dialog', { name: 'Asistente' });
        await user.click(within(dialogo).getByRole('button', { name: '¿Qué alumnos tengo en riesgo?' }));

        const log = within(dialogo).getByRole('log');
        await waitFor(() => expect(log).toHaveTextContent('Tienes 1 alumno sin derecho: - Ana (A001)'));
        expect(log).toHaveTextContent('¿Qué alumnos tengo en riesgo?');
        // Las sugerencias se van al empezar la conversación.
        expect(within(dialogo).queryByRole('button', { name: '¿Qué grupo falta más?' })).not.toBeInTheDocument();

        const [url, init] = fetch.mock.calls[0];
        expect(url).toBe('/api/asistente');
        expect(JSON.parse(init.body)).toEqual({ mensajes: [{ rol: 'usuario', texto: '¿Qué alumnos tengo en riesgo?' }] });
    });

    it('envía el historial anterior en la siguiente pregunta (Enter envía)', async () => {
        fetch
            .mockResolvedValueOnce(respuestaNdjson([{ tipo: 'texto', texto: 'Hoy tienes 2 sesiones.' }, { tipo: 'fin', motivo: 'completo' }]))
            .mockResolvedValueOnce(respuestaNdjson([{ tipo: 'texto', texto: 'A las 7:00.' }, { tipo: 'fin', motivo: 'completo' }]));
        const user = userEvent.setup();
        render(<AsistenteIA />);
        await user.click(screen.getByRole('button', { name: 'Asistente' }));
        const campo = screen.getByLabelText('Pregunta al asistente');
        await user.type(campo, '¿Qué sesiones tengo hoy?{Enter}');
        await screen.findByText(/Hoy tienes 2 sesiones/);
        await user.type(campo, '¿A qué hora?{Enter}');
        await screen.findByText(/A las 7:00/);
        expect(JSON.parse(fetch.mock.calls[1][1].body).mensajes).toEqual([
            { rol: 'usuario', texto: '¿Qué sesiones tengo hoy?' },
            { rol: 'asistente', texto: 'Hoy tienes 2 sesiones.' },
            { rol: 'usuario', texto: '¿A qué hora?' },
        ]);
    });

    it('muestra el error del servidor dentro de la conversación', async () => {
        fetch.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'DEMASIADOS_INTENTOS', message: 'Hiciste muchas preguntas seguidas.' } }), {
            status: 429, headers: { 'Content-Type': 'application/json' },
        }));
        const user = userEvent.setup();
        render(<AsistenteIA />);
        await user.click(screen.getByRole('button', { name: 'Asistente' }));
        await user.click(screen.getByRole('button', { name: '¿Qué grupo falta más?' }));
        expect(await screen.findByText(/Hiciste muchas preguntas seguidas/)).toBeInTheDocument();
    });

    it('sin clave configurada: aviso claro, campo deshabilitado y no llama al servidor', async () => {
        const user = userEvent.setup();
        render(<AsistenteIA disponible={false} />);
        await user.click(screen.getByRole('button', { name: 'Asistente' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Asistente no disponible');
        expect(screen.getByLabelText('Pregunta al asistente')).toBeDisabled();
        expect(screen.queryByRole('button', { name: '¿Qué alumnos tengo en riesgo?' })).not.toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('no se dibuja en el pase de lista ni en la sesión en vivo', () => {
        nav.pathname = '/docente/pasar-lista';
        const { rerender } = render(<AsistenteIA />);
        expect(screen.queryByRole('button', { name: 'Asistente' })).not.toBeInTheDocument();
        nav.pathname = '/docente/sesiones/12';
        rerender(<AsistenteIA />);
        expect(screen.queryByRole('button', { name: 'Asistente' })).not.toBeInTheDocument();
        nav.pathname = '/docente/revision';
        rerender(<AsistenteIA />);
        expect(screen.getByRole('button', { name: 'Asistente' })).toBeInTheDocument();
    });
});
