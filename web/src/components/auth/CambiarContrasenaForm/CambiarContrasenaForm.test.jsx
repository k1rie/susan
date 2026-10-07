// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import { mensajeContrasena, reglasContrasena, validarContrasena } from './contrasena.utils.js';

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
    it('sin confirmación solo exige la política (el formulario ya no pide el doble tecleo)', () => {
        expect(validarContrasena('buenaclave123')).toEqual({});
        expect(validarContrasena('corta1').nueva).toMatch(/10 caracteres/);
        expect(validarContrasena('buenaclave123')).not.toHaveProperty('confirmacion');
    });
});

describe('mensajeContrasena', () => {
    it('resume lo que falta y manda a la lista de requisitos', () => {
        expect(mensajeContrasena('')).toBe('Escribe tu contraseña nueva.');
        expect(mensajeContrasena('buenaclave123')).toBeNull();
        expect(mensajeContrasena('corta1')).toBe('Aún no cumple: al menos 10 caracteres.');
        expect(mensajeContrasena('sololetrasaqui')).toBe('Aún no cumple: contiene un número.');
        expect(mensajeContrasena('abc')).toBe('Aún no cumple 2 requisitos de la lista.');
    });
    it('es coherente con la política: hay mensaje si y solo si falla alguna regla', () => {
        for (const clave of ['', 'abc', 'abcdefghijk', '1234567890', 'abcdefghij1', 'ñandú12345']) {
            const cumple = reglasContrasena(clave).every((r) => r.cumple);
            expect(mensajeContrasena(clave) === null).toBe(cumple);
            expect(Object.keys(validarContrasena(clave)).length === 0).toBe(cumple);
        }
    });
});

describe('reglasContrasena', () => {
    it('evalúa largo, letra y número; la coincidencia solo aparece con confirmación escrita', () => {
        expect(reglasContrasena('').map((r) => r.cumple)).toEqual([false, false, false]);
        expect(reglasContrasena('abcdefghij1').map((r) => r.cumple)).toEqual([true, true, true]);
        expect(reglasContrasena('corta1').find((r) => r.id === 'largo').cumple).toBe(false);
        expect(reglasContrasena('abcdefghij1', 'otra').find((x) => x.id === 'coincide').cumple).toBe(false);
        expect(reglasContrasena('abcdefghij1', 'abcdefghij1').find((x) => x.id === 'coincide').cumple).toBe(true);
    });
});

describe('CambiarContrasenaForm', () => {
    beforeEach(() => {
        replace.mockClear();
        auth.cambiarContrasena.mockReset();
    });

    it('sin sesión muestra enlace expirado', async () => {
        auth.obtenerSesion.mockResolvedValue({ autenticado: false });
        render(<Form />);
        expect(await screen.findByText(/El enlace expiró/, {}, { timeout: 4000 })).toBeTruthy();
        expect(screen.getByRole('link', { name: /enlace nuevo/ }).getAttribute('href')).toBe('/recuperar');
    }, 8000);

    it('con sesión cambia la contraseña con UN solo campo y vuelve a la raíz', async () => {
        auth.obtenerSesion.mockResolvedValue({ autenticado: true });
        auth.cambiarContrasena.mockResolvedValue();
        render(<Form />);
        const u = userEvent.setup();
        await u.type(await screen.findByLabelText(/Nueva contraseña/), 'buenaclave123');
        expect(screen.queryByLabelText(/Confirmar contraseña/)).toBeNull();
        await u.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
        expect(auth.cambiarContrasena).toHaveBeenCalledWith({ contrasena: 'buenaclave123' });
    });

    it('los requisitos avanzan en vivo («N de 3») y el campo recibe el foco al abrir', async () => {
        auth.obtenerSesion.mockResolvedValue({ autenticado: true });
        render(<Form />);
        const u = userEvent.setup();
        const campo = await screen.findByLabelText(/Nueva contraseña/);
        expect(campo).toHaveFocus();
        expect(screen.getByText('0 de 3 requisitos')).toBeInTheDocument();
        await u.type(campo, 'abcdefghij');
        expect(screen.getByText('2 de 3 requisitos')).toBeInTheDocument();
        await u.type(campo, '1');
        expect(screen.getByText('3 de 3 requisitos')).toBeInTheDocument();
        const lista = screen.getByRole('list', { name: 'Requisitos de la contraseña' });
        expect(lista).toHaveTextContent('Al menos 10 caracteres (cumple)');
    });

    it('al salir del campo con requisitos sin cumplir avisa qué falta; al corregirlo el aviso desaparece', async () => {
        auth.obtenerSesion.mockResolvedValue({ autenticado: true });
        render(<Form />);
        const u = userEvent.setup();
        const campo = await screen.findByLabelText(/Nueva contraseña/);
        await u.type(campo, 'corta1');
        expect(screen.queryByRole('alert')).toBeNull();
        await u.tab(); // pasa al botón «Mostrar»: ya salió del campo
        expect(screen.getByRole('alert')).toHaveTextContent('Aún no cumple: al menos 10 caracteres.');
        await u.type(campo, 'abcdef');
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('enviar con requisitos sin cumplir no llama a la API y enfoca el campo', async () => {
        auth.obtenerSesion.mockResolvedValue({ autenticado: true });
        render(<Form />);
        const u = userEvent.setup();
        const campo = await screen.findByLabelText(/Nueva contraseña/);
        await u.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
        expect(await screen.findByText('Escribe tu contraseña nueva.')).toBeInTheDocument();
        expect(campo).toHaveFocus();
        expect(auth.cambiarContrasena).not.toHaveBeenCalled();
    });

    it('muestra el error de contraseña igual pegado al campo', async () => {
        auth.obtenerSesion.mockResolvedValue({ autenticado: true });
        auth.cambiarContrasena.mockRejectedValue(new ApiError({ code: 'CONTRASENA_IGUAL', message: 'x', status: 422 }));
        render(<Form />);
        const u = userEvent.setup();
        const campo = await screen.findByLabelText(/Nueva contraseña/);
        await u.type(campo, 'buenaclave123');
        await u.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
        const aviso = await screen.findByText('La nueva contraseña debe ser distinta de la actual.');
        expect(campo).toHaveAttribute('aria-describedby', expect.stringContaining(aviso.id));
        expect(campo).toHaveAttribute('aria-invalid', 'true');
        expect(campo).toHaveFocus();
    });

    it('un error inesperado se muestra en un aviso y conserva lo escrito', async () => {
        auth.obtenerSesion.mockResolvedValue({ autenticado: true });
        auth.cambiarContrasena.mockRejectedValue(new ApiError({ code: 'ERROR_RED', message: 'Sin conexión.', status: 0 }));
        render(<Form />);
        const u = userEvent.setup();
        const campo = await screen.findByLabelText(/Nueva contraseña/);
        await u.type(campo, 'buenaclave123');
        await u.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
        expect(await screen.findByText('Sin conexión.')).toBeInTheDocument();
        expect(campo).toHaveValue('buenaclave123');
    });

    it('en modo activar con onExito avisa al asistente en lugar de redirigir', async () => {
        auth.obtenerSesion.mockResolvedValue({ autenticado: true });
        auth.cambiarContrasena.mockResolvedValue();
        const onExito = vi.fn();
        render(<Form modo="activar" onExito={onExito} />);
        const u = userEvent.setup();
        await u.type(await screen.findByLabelText(/Crea tu contraseña/), 'buenaclave123');
        await u.click(screen.getByRole('button', { name: 'Activar mi cuenta' }));
        await waitFor(() => expect(onExito).toHaveBeenCalled());
        expect(replace).not.toHaveBeenCalled();
    });
});
