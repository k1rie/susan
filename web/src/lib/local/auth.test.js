import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { URL_BD_PRUEBAS, bdDisponible } from './db.testutil.js';

const hayBd = await bdDisponible();

describe.skipIf(!hayBd)('autenticacion local sobre auth.users', () => {
    let auth;
    let cerrarPool;

    beforeAll(async () => {
        process.env.LOCAL_DATABASE_URL = URL_BD_PRUEBAS;
        auth = await import('./auth.js');
        ({ cerrarPool } = await import('./pool.js'));
    });
    afterAll(async () => {
        await cerrarPool?.();
    });

    it('login correcto (demo1234) devuelve el usuario sin el hash', async () => {
        const r = await auth.verificarCredenciales('docente1@susan.local', 'demo1234');
        expect(r.error).toBeUndefined();
        expect(r.user.email).toBe('docente1@susan.local');
        expect(JSON.stringify(r.user)).not.toMatch(/\$2[aby]\$/);
        expect(r.user).not.toHaveProperty('encrypted_password');
    });

    it('el correo no distingue mayusculas', async () => {
        const r = await auth.verificarCredenciales('Docente1@SUSAN.local', 'demo1234');
        expect(r.user?.email).toBe('docente1@susan.local');
    });

    it('login incorrecto: mismo error para clave mala y correo inexistente', async () => {
        const a = await auth.verificarCredenciales('docente1@susan.local', 'mala-clave');
        const b = await auth.verificarCredenciales('nadie@susan.local', 'demo1234');
        expect(a.user).toBeUndefined();
        expect(a.error.code).toBe('invalid_credentials');
        expect(b.error).toEqual(a.error);
    });

    it('entradas raras no rompen ni inyectan', async () => {
        for (const [c, p] of [["' OR 1=1 --", 'x'], ['docente1@susan.local', "' OR '1'='1"], ['', ''], [null, null], ['a'.repeat(400) + '@x.y', 'x']]) {
            const r = await auth.verificarCredenciales(c, p);
            expect(r.user).toBeUndefined();
            expect(r.error).toBeTruthy();
        }
    });

    it('admin: crear, listar, cambiar clave, iniciar sesion y borrar un usuario', async () => {
        const admin = auth.crearAdminAuth();
        const correo = `prueba-${Date.now()}@susan.local`;
        const creado = await admin.createUser({ email: correo, password: 'Clave-segura-123', email_confirm: true });
        expect(creado.error).toBeNull();
        const id = creado.data.user.id;
        try {
            expect(creado.data.user.email_confirmed_at).toBeTruthy();
            expect((await admin.createUser({ email: correo, password: 'Clave-segura-123' })).error.code).toBe('email_exists');
            expect((await admin.createUser({ email: 'x@y.zz', password: 'corta' })).error.code).toBe('weak_password');

            expect((await auth.verificarCredenciales(correo, 'Clave-segura-123')).user.id).toBe(id);
            const act = await admin.updateUserById(id, { password: 'Otra-clave-456' });
            expect(act.error).toBeNull();
            expect((await auth.verificarCredenciales(correo, 'Clave-segura-123')).error).toBeTruthy();
            expect((await auth.verificarCredenciales(correo, 'Otra-clave-456')).user.id).toBe(id);

            // cambiarContrasena: misma clave -> same_password; distinta -> ok
            expect((await auth.cambiarContrasena(id, 'Otra-clave-456')).error.code).toBe('same_password');
            expect((await auth.cambiarContrasena(id, 'debil')).error.code).toBe('weak_password');
            expect((await auth.cambiarContrasena(id, 'Tercera-clave-789')).error).toBeUndefined();

            const lista = await admin.listUsers({ page: 1, perPage: 1000 });
            expect(lista.data.users.some((u) => u.id === id)).toBe(true);
            expect(lista.data.users[0]).not.toHaveProperty('encrypted_password');
        } finally {
            expect((await admin.deleteUser(id)).error).toBeNull();
        }
        expect((await admin.deleteUser(id)).error.code).toBe('user_not_found');
        expect(await auth.obtenerUsuarioPorId(id)).toBeNull();
    });
});
