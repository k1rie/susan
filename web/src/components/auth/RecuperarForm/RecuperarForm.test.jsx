// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';

vi.mock('@/lib/api/auth.js', () => ({ recuperarContrasena: vi.fn() }));
const { recuperarContrasena } = await import('@/lib/api/auth.js');
const { default: RecuperarForm } = await import('./RecuperarForm.jsx');

async function enviar(correo) {
    const u = userEvent.setup();
    await u.type(screen.getByLabelText(/Correo institucional/), correo);
    await u.click(screen.getByRole('button', { name: 'Enviar instrucciones' }));
}

describe('RecuperarForm', () => {
    it('muestra siempre el mensaje neutro', async () => {
        recuperarContrasena.mockResolvedValue();
        render(<RecuperarForm />);
        await enviar('nadie@susan.local');
        expect(await screen.findByText(/Si el correo está registrado/)).toBeTruthy();
    });

    it('muestra el error de límite de intentos', async () => {
        recuperarContrasena.mockRejectedValue(new ApiError({ code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos.', status: 429 }));
        render(<RecuperarForm />);
        await enviar('a@susan.local');
        expect(await screen.findByText('Demasiados intentos.')).toBeTruthy();
    });

    it('valida el correo', async () => {
        render(<RecuperarForm />);
        await enviar('sin-arroba');
        expect(screen.getByText('Escribe un correo válido.')).toBeTruthy();
    });
});
