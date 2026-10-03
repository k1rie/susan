import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { URL_BD_PRUEBAS, bdDisponible, idDeUsuario } from './db.testutil.js';

const hayBd = await bdDisponible();

describe.skipIf(!hayBd)('ejecutor de RPC contra la BD local', () => {
    let ejecutarRpc;
    let cerrarPool;
    let docente;
    let alumno;
    let admin;

    beforeAll(async () => {
        process.env.LOCAL_DATABASE_URL = URL_BD_PRUEBAS;
        ({ ejecutarRpc } = await import('./rpc.js'));
        ({ cerrarPool } = await import('./pool.js'));
        docente = await idDeUsuario('docente1@susan.local');
        alumno = await idDeUsuario('e260001@susan.local');
        admin = await idDeUsuario('admin@susan.local');
    });
    afterAll(async () => {
        await cerrarPool?.();
    });

    const como = (sub, email) => ({ rol: 'authenticated', claims: { sub, email } });

    it('con los claims de docente1@susan.local, api_yo devuelve a ese usuario', async () => {
        const { data, error } = await ejecutarRpc('api_yo', {}, como(docente, 'docente1@susan.local'));
        expect(error).toBeNull();
        expect(data.correo).toBe('docente1@susan.local');
        expect(data.rol).toBe('docente');
    });

    it('cada usuario ve lo suyo (alumno != docente)', async () => {
        const { data } = await ejecutarRpc('api_yo', {}, como(alumno, 'e260001@susan.local'));
        expect(data.rol).toBe('alumno');
    });

    it('un authenticated NO puede ejecutar svc_*', async () => {
        const { data, error } = await ejecutarRpc(
            'svc_crear_captura',
            { p_id_sesion: 1, p_id_camara: 1, p_marca_tiempo: '2026-09-14T07:00:00Z', p_rostros: 0 },
            como(docente, 'docente1@susan.local'),
        );
        expect(data).toBeNull();
        expect(error.code).toBe('42501');
    });

    it('service_role si ejecuta svc_* (llega a la logica de la funcion, no al permiso)', async () => {
        const { error } = await ejecutarRpc(
            'svc_crear_captura',
            { p_id_sesion: 999999, p_id_camara: 1, p_marca_tiempo: '2026-09-14T07:00:00Z', p_rostros: 0 },
            { rol: 'service_role' },
        );
        expect(error?.code).not.toBe('42501');
    });

    it('sin sub se rechaza (NO_AUTENTICADO) sin tocar la base', async () => {
        for (const claims of [undefined, {}, { sub: '' }, { sub: "x'; select 1;--" }]) {
            const { data, error } = await ejecutarRpc('api_yo', {}, { rol: 'authenticated', claims });
            expect(data).toBeNull();
            expect(error.hint).toBe('NO_AUTENTICADO');
        }
    });

    it('un error de negocio llega con su HINT', async () => {
        // Un alumno no es administrador: api_admin_resumen lanza P0001 con HINT NO_AUTORIZADO.
        const { data, error } = await ejecutarRpc('api_admin_resumen', {}, como(alumno, 'e260001@susan.local'));
        expect(data).toBeNull();
        expect(error.code).toBe('P0001');
        expect(error.hint).toBe('NO_AUTORIZADO');
        expect(typeof error.message).toBe('string');
        expect(error).toHaveProperty('details');
    });

    it('argumentos con nombre: p_id_sesion inexistente da NO_ENCONTRADO', async () => {
        const { error } = await ejecutarRpc('api_cerrar_sesion', { p_id_sesion: 999999 }, como(docente, 'docente1@susan.local'));
        expect(error.hint).toBe('NO_ENCONTRADO');
    });

    it('jsonb escalar -> objeto; jsonb con paginacion -> {total, items}', async () => {
        const { data, error } = await ejecutarRpc('api_alumnos_listar', { p_limit: 5, p_offset: 0 }, como(admin, 'admin@susan.local'));
        expect(error).toBeNull();
        expect(data.items).toHaveLength(5);
        expect(typeof data.total).toBe('number');
    });

    it('un argumento jsonb (p) acepta objetos', async () => {
        const { error } = await ejecutarRpc('api_alumno_guardar', { p: { matricula: '' } }, como(admin, 'admin@susan.local'));
        // Valida datos (VALIDACION), pero llega a la funcion: el jsonb se paso bien.
        expect(error?.hint).toMatch(/VALIDACION|[A-Z_]+/);
        expect(error?.code).toBe('P0001');
    });

    it('rechaza nombres y argumentos que no cumplen el patron o no existen', async () => {
        const ctx = como(docente, 'docente1@susan.local');
        const malos = [
            ['api_yo; DROP TABLE usuario', {}],
            ['pg_sleep', {}],
            ['API_YO', {}],
            ['api_yo()--', {}],
            ['api_no_existe', {}],
            ['app.now', {}],
            ['api_yo', { 'p_x"; select 1; --': 1 }],
            ['api_yo', { id: 1 }],
            ['api_yo', { p_inexistente: 1 }],
            ['api_yo', [1]],
        ];
        for (const [n, a] of malos) {
            const { data, error } = await ejecutarRpc(n, a, ctx);
            expect(data, n).toBeNull();
            expect(error, n).not.toBeNull();
        }
    });

    it('un rol que no es authenticated/service_role se rechaza (nunca postgres ni anon)', async () => {
        for (const rol of ['postgres', 'anon', 'authenticated; select 1']) {
            const { error } = await ejecutarRpc('api_yo', {}, { rol, claims: { sub: docente } });
            expect(error.code).toBe('42501');
        }
    });

    it('la transaccion no deja rol ni claims pegados a la conexion del pool', async () => {
        await ejecutarRpc('api_yo', {}, como(docente, 'docente1@susan.local'));
        // Si la conexion conservara los claims, esta llamada "sin sub" saldria con datos.
        const { error } = await ejecutarRpc('api_yo', {}, { rol: 'authenticated', claims: {} });
        expect(error.hint).toBe('NO_AUTENTICADO');
    });
});
