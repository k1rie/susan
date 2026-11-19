// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const { mensajeCorreo, validarLogin } = await import('./login.utils.js');

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

describe('validación guiada', () => {
    beforeEach(() => {
        iniciarSesion.mockReset();
    });



    it('avisa del correo al salir del campo, con un mensaje concreto, y lo quita al corregirlo', async () => {
        const u = userEvent.setup();
        render(<LoginForm />);
        const correo = screen.getByLabelText(/Correo institucional/);
        await u.type(correo, 'sin-arroba');
        expect(screen.queryByText(/le falta la @/)).toBeNull(); // mientras se escribe por primera vez no hay ruido
        await u.tab();
        expect(await screen.findByText('Al correo le falta la @. Ejemplo: nombre@unach.mx')).toBeInTheDocument();
        expect(correo).toHaveAttribute('aria-invalid', 'true');
        await u.type(correo, '@unach.mx');
        expect(screen.queryByText(/le falta la @/)).toBeNull();
        expect(correo).not.toHaveAttribute('aria-invalid');
    });

    it('recorta los espacios del correo al salir del campo', async () => {
        const u = userEvent.setup();
        render(<LoginForm />);
        const correo = screen.getByLabelText(/Correo institucional/);
        await u.type(correo, '  a@susan.local  ');
        await u.tab();
        expect(correo).toHaveValue('a@susan.local');
    });

    it('enviar con errores enfoca el primer campo inválido y no llama a la API', async () => {
        const u = userEvent.setup();
        render(<LoginForm />);
        await u.type(screen.getByLabelText(/^Contraseña/), 'demo1234');
        await u.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
        expect(screen.getByLabelText(/Correo institucional/)).toHaveFocus();
        expect(iniciarSesion).not.toHaveBeenCalled();
        // Si falta solo la contraseña, el foco va a la contraseña.
        await u.type(screen.getByLabelText(/Correo institucional/), 'a@susan.local');
        await u.clear(screen.getByLabelText(/^Contraseña/));
        await u.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
        expect(screen.getByLabelText(/^Contraseña/)).toHaveFocus();
        expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument();
    });

    it('avisa del Bloq Mayús en la contraseña y deja de avisar al salir', async () => {
        render(<LoginForm />);
        const campo = screen.getByLabelText(/^Contraseña/);
        fireEvent.keyDown(campo, { key: 'A', modifierCapsLock: true });
        expect(screen.getByText('Bloq Mayús está activado.')).toBeInTheDocument();
        fireEvent.blur(campo);
        expect(screen.queryByText('Bloq Mayús está activado.')).toBeNull();
    });

    it('tras un error del servidor conserva lo escrito y deja la contraseña enfocada y seleccionada, sin marcarla como vacía', async () => {
        iniciarSesion.mockRejectedValue(new ApiError({ code: 'CREDENCIALES_INVALIDAS', message: 'x', status: 401 }));
        render(<LoginForm />);
        await llenar();
        expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
        expect(screen.getByLabelText(/Correo institucional/)).toHaveValue('a@susan.local');
        const clave = screen.getByLabelText(/^Contraseña/);
        expect(clave).toHaveValue('demo1234');
        await waitFor(() => expect(clave).toHaveFocus());
        expect([clave.selectionStart, clave.selectionEnd]).toEqual([0, 'demo1234'.length]);
        // La contraseña escrita no queda marcada como «obligatoria» tras el intento.
        expect(screen.queryByText('Escribe tu contraseña.')).toBeNull();
        expect(clave).not.toHaveAttribute('aria-invalid');
        // El botón vuelve a estar disponible para reintentar.
        expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
    });

    it('«¿Olvidaste tu contraseña?» está junto al campo de contraseña', () => {
        render(<LoginForm />);
        const enlace = screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' });
        expect(enlace).toHaveAttribute('href', '/recuperar');
        const clave = screen.getByLabelText(/^Contraseña/);
        // Comparten el mismo bloque de campo: el enlace va en la fila de la etiqueta, encima del campo.
        const bloque = screen.getByText('Contraseña', { selector: 'label' }).closest('div.flex-col');
        expect(bloque).toContainElement(enlace);
        expect(bloque).toContainElement(clave);
    });

    it('no deja pulsar dos veces mientras entra', async () => {
        let entra;
        iniciarSesion.mockReturnValue(new Promise((r) => { entra = r; }));
        const u = userEvent.setup();
        render(<LoginForm />);
        await llenar();
        const boton = screen.getByRole('button', { name: /Iniciar sesión|Procesando/ });
        expect(boton).toBeDisabled();
        entra({ home: '/docente' });
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente'));
        // Después de entrar sigue en «cargando» hasta que cambie la pantalla.
        expect(screen.getByRole('button', { name: /Iniciar sesión|Procesando/ })).toBeDisabled();
        void u;
        expect(iniciarSesion).toHaveBeenCalledTimes(1);
    });
});

describe('mensajeCorreo / validarLogin', () => {
    it('explica qué falta en cada caso', () => {
        expect(mensajeCorreo('')).toBe('Escribe tu correo institucional.');
        expect(mensajeCorreo('   ', { vacio: 'Escribe el correo de tu cuenta.' })).toBe('Escribe el correo de tu cuenta.');
        expect(mensajeCorreo('a@susan.local')).toBeNull();
        expect(mensajeCorreo('  a@susan.local  ')).toBeNull();
        expect(mensajeCorreo('nombre')).toMatch(/le falta la @/);
        expect(mensajeCorreo('a@@b.mx')).toBe('El correo solo puede llevar una @.');
        expect(mensajeCorreo('@unach.mx')).toMatch(/usuario antes de la @/);
        expect(mensajeCorreo('nombre@')).toMatch(/dominio después de la @/);
        expect(mensajeCorreo('nombre@unach')).toMatch(/Revisa el dominio/);
        expect(mensajeCorreo('na me@unach.mx')).toBe('El correo no puede llevar espacios.');
        expect(mensajeCorreo(`${'a'.repeat(120)}@unach.mx`)).toMatch(/demasiado largo/);
    });
    it('validarLogin devuelve un error por campo', () => {
        expect(validarLogin({ correo: '', contrasena: '' })).toEqual({ correo: 'Escribe tu correo institucional.', contrasena: 'Escribe tu contraseña.' });
        expect(validarLogin({ correo: 'a@susan.local', contrasena: 'x' })).toEqual({});
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
