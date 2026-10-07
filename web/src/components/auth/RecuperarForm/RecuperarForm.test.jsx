// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';

vi.mock('@/lib/api/auth.js', () => ({ recuperarContrasena: vi.fn() }));
const { recuperarContrasena } = await import('@/lib/api/auth.js');
const { default: RecuperarForm } = await import('./RecuperarForm.jsx');

async function enviar(correo, u = userEvent.setup()) {
    await u.type(screen.getByLabelText(/Correo institucional/), correo);
    await u.click(screen.getByRole('button', { name: 'Enviar instrucciones' }));
    return u;
}

beforeEach(() => {
    recuperarContrasena.mockReset();
});

describe('RecuperarForm', () => {
    it('muestra siempre el mensaje neutro (anti-enumeración) con el correo escrito', async () => {
        recuperarContrasena.mockResolvedValue();
        render(<RecuperarForm />);
        await enviar('nadie@susan.local');
        expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument();
        expect(screen.getByText(/está registrado, te enviamos un enlace/)).toBeInTheDocument();
        expect(screen.getByText('nadie@susan.local')).toBeInTheDocument();
        expect(recuperarContrasena).toHaveBeenCalledWith({ correo: 'nadie@susan.local' });
    });

    it('muestra el error de límite de intentos y conserva el correo', async () => {
        recuperarContrasena.mockRejectedValue(new ApiError({ code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos.', status: 429 }));
        render(<RecuperarForm />);
        await enviar('a@susan.local');
        expect(await screen.findByText('Demasiados intentos.')).toBeInTheDocument();
        expect(screen.getByLabelText(/Correo institucional/)).toHaveValue('a@susan.local');
        expect(screen.getByRole('button', { name: 'Enviar instrucciones' })).toBeEnabled();
    });

    it('valida el correo con un mensaje concreto al enviar y enfoca el campo', async () => {
        render(<RecuperarForm />);
        await enviar('sin-arroba');
        expect(screen.getByText('Al correo le falta la @. Ejemplo: nombre@unach.mx')).toBeInTheDocument();
        expect(screen.getByLabelText(/Correo institucional/)).toHaveFocus();
        expect(recuperarContrasena).not.toHaveBeenCalled();
    });

    it('al salir del campo avisa del correo mal escrito y, vacío, pide el correo de la cuenta', async () => {
        const u = userEvent.setup();
        render(<RecuperarForm />);
        const campo = screen.getByLabelText(/Correo institucional/);
        await u.type(campo, 'nombre@unach');
        await u.tab();
        expect(await screen.findByText(/Revisa el dominio/)).toBeInTheDocument();
        await u.clear(campo);
        expect(screen.getByText('Escribe el correo de tu cuenta.')).toBeInTheDocument();
    });

    it('«Usar otro correo» vuelve al formulario con el correo escrito', async () => {
        recuperarContrasena.mockResolvedValue();
        render(<RecuperarForm />);
        const u = await enviar('a@susan.local');
        await u.click(await screen.findByRole('button', { name: 'Usar otro correo' }));
        expect(screen.getByLabelText(/Correo institucional/)).toHaveValue('a@susan.local');
        expect(screen.getByRole('button', { name: 'Enviar instrucciones' })).toBeInTheDocument();
    });

    it('lleva de vuelta a iniciar sesión desde el formulario y desde la confirmación', async () => {
        recuperarContrasena.mockResolvedValue();
        render(<RecuperarForm />);
        expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/login');
        await enviar('a@susan.local');
        await screen.findByRole('heading', { name: 'Revisa tu correo' });
        expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/login');
    });
});

describe('RecuperarForm: reenvío con enfriamiento', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('«Reenviar» arranca bloqueado con la cuenta atrás y se habilita a los 60 s', async () => {
        recuperarContrasena.mockResolvedValue();
        const u = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
        render(<RecuperarForm />);
        await enviar('a@susan.local', u);
        const boton = await screen.findByRole('button', { name: /Reenviar en/ });
        expect(boton).toBeDisabled();
        expect(boton).toHaveTextContent(/Reenviar en (59|60) s/);
        expect(screen.getByRole('status')).toHaveTextContent('Podrás reenviar el enlace en 60 segundos.');

        act(() => {
            vi.advanceTimersByTime(30_000);
        });
        expect(screen.getByRole('button', { name: /Reenviar en/ })).toHaveTextContent(/Reenviar en (29|30) s/);

        act(() => {
            vi.advanceTimersByTime(31_000);
        });
        expect(screen.getByRole('button', { name: 'Reenviar enlace' })).toBeEnabled();
        expect(screen.getByRole('status')).toHaveTextContent('Ya puedes reenviar el enlace.');
    });

    it('al reenviar vuelve a llamar a la API, confirma y reinicia la espera', async () => {
        recuperarContrasena.mockResolvedValue();
        const u = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
        render(<RecuperarForm />);
        await enviar('a@susan.local', u);
        await screen.findByRole('button', { name: /Reenviar en/ });
        act(() => {
            vi.advanceTimersByTime(61_000);
        });
        await u.click(screen.getByRole('button', { name: 'Reenviar enlace' }));
        expect(await screen.findByText('Te enviamos el enlace otra vez.')).toBeInTheDocument();
        expect(recuperarContrasena).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('button', { name: /Reenviar en/ })).toBeDisabled();
    });

    it('si el reenvío falla lo dice y deja reintentar', async () => {
        recuperarContrasena.mockResolvedValueOnce();
        recuperarContrasena.mockRejectedValueOnce(new ApiError({ code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos. Espera unos minutos.', status: 429 }));
        const u = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
        render(<RecuperarForm />);
        await enviar('a@susan.local', u);
        await screen.findByRole('button', { name: /Reenviar en/ });
        act(() => {
            vi.advanceTimersByTime(61_000);
        });
        await u.click(screen.getByRole('button', { name: 'Reenviar enlace' }));
        expect(await screen.findByText('Demasiados intentos. Espera unos minutos.')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Reenviar enlace' })).toBeEnabled());
    });
});
