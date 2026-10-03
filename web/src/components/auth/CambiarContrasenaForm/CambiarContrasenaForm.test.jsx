// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import { validarContrasena } from './contrasena.utils.js';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api/auth.js', () => ({
    obtenerSesion: vi.fn(),
    suscribirCambioAuth: vi.fn(async () => () => {}),
    cambiarContrasena: vi.fn(),
}));

const auth = await import('@/lib/api/auth.js');
const { default: Form } = await import('./CambiarContrasenaForm.jsx');

describe('validarContrasena', () => {
    it('aplica la política', () => {
        expect(validarContrasena('corta1', 'corta1').nueva).toMatch(/10 caracteres/);
        expect(validarContrasena('sololetrasaqui', 'sololetrasaqui').nueva).toMatch(/letra y un número/);
        expect(validarContrasena('1234567890123', '1234567890123').nueva).toMatch(/letra y un número/);
        expect(validarContrasena('buenaclave123', 'otra').confirmacion).toMatch(/no coinciden/);
        expect(validarContrasena('buenaclave123', 'buenaclave123')).toEqual({});
    });
});

describe('CambiarContrasenaForm', () => {
    beforeEach(() => replace.mockClear());

    it('sin sesión muestra enlace expirado', async () => {
        auth.obtenerSesion.mockResolvedValue({ autenticado: false });
        render(<Form />);
        expect(await screen.findByText(/El enlace expiró/, {}, { timeout: 4000 })).toBeTruthy();
        expect(screen.getByRole('link', { name: /enlace nuevo/ }).getAttribute('href')).toBe('/recuperar');
    }, 8000);

    it('con sesión cambia la contraseña y vuelve a la raíz', async () => {
        auth.obtenerSesion.mockResolvedValue({ autenticado: true });
        auth.cambiarContrasena.mockResolvedValue();
        render(<Form />);
        const u = userEvent.setup();
        await u.type(await screen.findByLabelText(/Nueva contraseña/), 'buenaclave123');
        await u.type(screen.getByLabelText(/Confirmar contraseña/), 'buenaclave123');
        await u.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
        expect(auth.cambiarContrasena).toHaveBeenCalledWith({ contrasena: 'buenaclave123' });
    });

    it('muestra el error de contraseña igual', async () => {
        auth.obtenerSesion.mockResolvedValue({ autenticado: true });
        auth.cambiarContrasena.mockRejectedValue(new ApiError({ code: 'CONTRASENA_IGUAL', message: 'x', status: 422 }));
        render(<Form />);
        const u = userEvent.setup();
        await u.type(await screen.findByLabelText(/Nueva contraseña/), 'buenaclave123');
        await u.type(screen.getByLabelText(/Confirmar contraseña/), 'buenaclave123');
        await u.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
        expect(await screen.findByText('La nueva contraseña debe ser distinta de la actual.')).toBeTruthy();
    });
});
