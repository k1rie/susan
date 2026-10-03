import { describe, expect, it, vi } from 'vitest';
import {
    cambiarContrasena, cerrarSesion, iniciarSesion, obtenerSesion, recuperarContrasena, suscribirCambioSesion,
} from './auth.js';

const ME = { id_usuario: 1, rol: 'docente', activo: true, home: '/docente' };

function crear({ signIn = { data: {}, error: null }, yo = { data: ME, error: null }, ...resto } = {}) {
    return {
        auth: {
            signInWithPassword: vi.fn().mockResolvedValue(signIn),
            signOut: vi.fn().mockResolvedValue({ error: null }),
            resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
            updateUser: vi.fn().mockResolvedValue({ error: null }),
            getSession: vi.fn().mockResolvedValue({ data: { session: { x: 1 } } }),
            ...resto,
        },
        rpc: vi.fn().mockResolvedValue(yo),
    };
}

describe('iniciarSesion', () => {
    it('normaliza el correo y devuelve Me', async () => {
        const backend = crear();
        await expect(iniciarSesion({ correo: '  Ana@UNACH.mx ', contrasena: 'x' }, { backend })).resolves.toEqual(ME);
        expect(backend.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@unach.mx', password: 'x' });
    });
    it('credenciales invalidas', async () => {
        const backend = crear({ signIn: { data: null, error: { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 } } });
        await expect(iniciarSesion({ correo: 'a@b.c', contrasena: 'x' }, { backend }))
            .rejects.toMatchObject({ code: 'CREDENCIALES_INVALIDAS', status: 401, message: 'Correo o contraseña incorrectos.' });
    });
    it('demasiados intentos', async () => {
        const backend = crear({ signIn: { data: null, error: { status: 429, message: 'x' } } });
        await expect(iniciarSesion({ correo: 'a@b.c', contrasena: 'x' }, { backend })).rejects.toMatchObject({ code: 'DEMASIADOS_INTENTOS', status: 429 });
    });
    it('cuenta inactiva cierra la sesion', async () => {
        const backend = crear({ yo: { data: { ...ME, activo: false }, error: null } });
        await expect(iniciarSesion({ correo: 'a@b.c', contrasena: 'x' }, { backend })).rejects.toMatchObject({ code: 'CUENTA_INACTIVA' });
        expect(backend.auth.signOut).toHaveBeenCalled();
    });
    it('cuenta no vinculada cierra la sesion y relanza', async () => {
        const backend = crear({ yo: { data: null, error: { code: 'P0001', hint: 'CUENTA_NO_VINCULADA', message: 'Sin perfil' } } });
        await expect(iniciarSesion({ correo: 'a@b.c', contrasena: 'x' }, { backend })).rejects.toMatchObject({ code: 'CUENTA_NO_VINCULADA' });
        expect(backend.auth.signOut).toHaveBeenCalled();
    });
    it('error de red', async () => {
        const backend = crear();
        backend.auth.signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(iniciarSesion({ correo: 'a@b.c', contrasena: 'x' }, { backend })).rejects.toMatchObject({ code: 'ERROR_RED' });
    });
});

describe('cerrarSesion y eventos', () => {
    it('ignora errores y avisa del cierre', async () => {
        const backend = crear();
        backend.auth.signOut.mockRejectedValue(new Error('red'));
        const oyente = vi.fn();
        const baja = suscribirCambioSesion(oyente);
        await expect(cerrarSesion({ backend })).resolves.toBeUndefined();
        expect(oyente).toHaveBeenCalledWith('cierre');
        baja();
    });
});

describe('recuperarContrasena', () => {
    it('envia redirectTo a /cambiar-contrasena', async () => {
        const backend = crear();
        await recuperarContrasena({ correo: 'A@B.C' }, { backend });
        const [correo, opts] = backend.auth.resetPasswordForEmail.mock.calls[0];
        expect(correo).toBe('a@b.c');
        expect(opts.redirectTo.endsWith('/cambiar-contrasena')).toBe(true);
    });
    it('silencia errores salvo limite de tasa y red', async () => {
        const otro = crear();
        otro.auth.resetPasswordForEmail.mockResolvedValue({ error: { code: 'user_not_found', message: 'x' } });
        await expect(recuperarContrasena({ correo: 'a@b.c' }, { backend: otro })).resolves.toBeUndefined();
        const tasa = crear();
        tasa.auth.resetPasswordForEmail.mockResolvedValue({ error: { code: 'over_email_send_rate_limit', message: 'x' } });
        await expect(recuperarContrasena({ correo: 'a@b.c' }, { backend: tasa })).rejects.toMatchObject({ code: 'DEMASIADOS_INTENTOS' });
        const red = crear();
        red.auth.resetPasswordForEmail.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(recuperarContrasena({ correo: 'a@b.c' }, { backend: red })).rejects.toMatchObject({ code: 'ERROR_RED' });
    });
});

describe('cambiarContrasena y obtenerSesion', () => {
    it('contrasena debil, igual y sesion expirada', async () => {
        const casos = [
            [{ code: 'weak_password', message: 'x' }, 'CONTRASENA_DEBIL'],
            [{ code: 'same_password', message: 'x' }, 'CONTRASENA_IGUAL'],
            [{ message: 'Auth session missing!' }, 'NO_AUTENTICADO'],
        ];
        for (const [error, code] of casos) {
            const backend = crear();
            backend.auth.updateUser.mockResolvedValue({ error });
            await expect(cambiarContrasena({ contrasena: 'x' }, { backend })).rejects.toMatchObject({ code });
        }
    });
    it('exito y obtenerSesion', async () => {
        const backend = crear();
        await expect(cambiarContrasena({ contrasena: 'Nueva123' }, { backend })).resolves.toBeUndefined();
        expect(backend.auth.updateUser).toHaveBeenCalledWith({ password: 'Nueva123' });
        await expect(obtenerSesion({ backend })).resolves.toEqual({ autenticado: true });
    });
});
