// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock('@/lib/api/auth.js', () => ({ iniciarSesion: vi.fn(), cerrarSesion: vi.fn() }));

const { iniciarSesion, cerrarSesion } = await import('@/lib/api/auth.js');
const { default: LoginForm } = await import('./LoginForm.jsx');
const { rutaSegura } = await import('./rutaSegura.js');

async function llenar(correo = 'a@susan.local', clave = 'demo1234') {
    const u = userEvent.setup();
    if (correo) await u.type(screen.getByLabelText(/Correo institucional/), correo);
    if (clave) await u.type(screen.getByLabelText(/^Contraseña/), clave);
    await u.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    return u;
}

describe('LoginForm', () => {
    beforeEach(() => {
        replace.mockClear();
        refresh.mockClear();
    });

    it('valida campos vacíos sin llamar a la API', async () => {
        render(<LoginForm />);
        await llenar('', '');
        expect(screen.getByText('Escribe tu correo institucional.')).toBeTruthy();
        expect(screen.getByText('Escribe tu contraseña.')).toBeTruthy();
        expect(iniciarSesion).not.toHaveBeenCalled();
    });

    it('muestra el error de credenciales', async () => {
        iniciarSesion.mockRejectedValue(new ApiError({ code: 'CREDENCIALES_INVALIDAS', message: 'x', status: 401 }));
        render(<LoginForm />);
        await llenar();
        expect((await screen.findAllByText('Correo o contraseña incorrectos.')).length).toBeGreaterThan(0);
        expect(replace).not.toHaveBeenCalled();
    });

    it('redirige a la home del rol', async () => {
        iniciarSesion.mockResolvedValue({ home: '/docente' });
        render(<LoginForm />);
        await llenar();
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente'));
        expect(refresh).toHaveBeenCalled();
    });

    it('respeta next interno y rechaza uno malicioso', async () => {
        iniciarSesion.mockResolvedValue({ home: '/docente' });
        const { unmount } = render(<LoginForm next="/reportes?x=1" />);
        await llenar();
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/reportes?x=1'));
        unmount();
        replace.mockClear();
        render(<LoginForm next="//evil.com" />);
        await llenar();
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente'));
    });

    it('con cuenta inactiva cierra la sesión huérfana y avisa', () => {
        render(<LoginForm mensaje="cuenta_inactiva" />);
        expect(cerrarSesion).toHaveBeenCalled();
        expect(screen.getByText('Tu cuenta está inactiva. Contacta al administrador.')).toBeTruthy();
    });

    it('muestra/oculta la contraseña', async () => {
        render(<LoginForm />);
        const campo = screen.getByLabelText(/^Contraseña/);
        expect(campo.type).toBe('password');
        await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
        expect(campo.type).toBe('text');
    });
});

describe('rutaSegura', () => {
    it('solo acepta rutas internas', () => {
        expect(rutaSegura('/docente')).toBe('/docente');
        for (const m of ['//evil.com', 'https://evil.com', '/\\evil', 'javascript:1', '', null, undefined]) {
            expect(rutaSegura(m, '/x')).toBe('/x');
        }
    });
});
