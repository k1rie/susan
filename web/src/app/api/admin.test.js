import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));
vi.mock('@/lib/server/recognition', async (importar) => ({ ...(await importar()), reconocer: vi.fn() }));

import { getAdminBackend, getServerBackend } from '@/lib/backend';
import { ApiError } from '@/lib/api/errors';
import { generarContrasenaTemporal } from '@/lib/server/admin';
import { reconocer } from '@/lib/server/recognition';
import { YO, conParams, crearBackend, errorDeNegocio, pedir } from '@/lib/server/testing';
import { POST as postUsuario } from './admin/usuarios/route.js';
import { POST as postRestablecer } from './admin/usuarios/[id]/restablecer/route.js';
import { POST as postProbar } from './admin/camaras/[id]/probar/route.js';
import { GET as getSalud } from './salud/route.js';

let usuario;
let admin;

function preparar({ me = YO.admin, usuarioRpcs = {}, adminRpcs = {}, authAdmin = {} } = {}) {
    usuario = crearBackend({ rpcs: { api_yo: () => me, ...usuarioRpcs } });
    admin = crearBackend({ rpcs: { svc_usuario_crear: () => 55, ...adminRpcs }, authAdmin });
    getServerBackend.mockResolvedValue(usuario);
    getAdminBackend.mockResolvedValue(admin);
}

let consolas;
beforeEach(() => {
    consolas = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    preparar();
});
const textoDeLogs = () => consolas.flatMap((c) => c.mock.calls).flat().map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');

describe('generarContrasenaTemporal', () => {
    it('>= 12 caracteres, con las cuatro clases, distinta en cada llamada', () => {
        const vistas = new Set();
        for (let i = 0; i < 200; i += 1) {
            const p = generarContrasenaTemporal();
            expect(p.length).toBeGreaterThanOrEqual(12);
            expect(p).toMatch(/[A-Z]/);
            expect(p).toMatch(/[a-z]/);
            expect(p).toMatch(/[0-9]/);
            expect(p).toMatch(/[!#$%*+\-=?@]/);
            vistas.add(p);
        }
        expect(vistas.size).toBe(200);
        expect(generarContrasenaTemporal(4).length).toBe(12); // nunca menos de 12
    });
});

describe('POST /api/admin/usuarios', () => {
    const crear = (json) => postUsuario(pedir('/api/admin/usuarios', { json }));

    it('crea la cuenta de Auth (email_confirm) y la fila usuario; devuelve la contraseña temporal una vez', async () => {
        const res = await crear({ correo: '  Docente.Nuevo@UNACH.mx ', rol: 'docente', id_docente: 12 });
        const cuerpo = await res.json();
        expect(res.status).toBe(201);
        const [datosAuth] = admin.auth.admin.createUser.mock.calls[0];
        expect(datosAuth).toMatchObject({ email: 'docente.nuevo@unach.mx', email_confirm: true });
        expect(datosAuth.password.length).toBeGreaterThanOrEqual(12);
        expect(cuerpo).toEqual({ id_usuario: 55, correo: 'docente.nuevo@unach.mx', rol: 'docente', contrasena_temporal: datosAuth.password });
        expect(admin.rpc.mock.calls[0]).toEqual(['svc_usuario_crear', {
            p_correo: 'docente.nuevo@unach.mx', p_rol: 'docente', p_id_docente: 12, p_auth_uid: 'nuevo-uid',
        }]);
        expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('la contraseña NO aparece en ningún log (ni en éxito ni en fallo)', async () => {
        const ok = await (await crear({ correo: 'a@x.mx', rol: 'tecnico' })).json();
        preparar({ adminRpcs: { svc_usuario_crear: () => errorDeNegocio('DUPLICADO', 'Ya existe.') } });
        const falla = await crear({ correo: 'b@x.mx', rol: 'tecnico' });
        const claveDeLaFalla = admin.auth.admin.createUser.mock.calls[0][0].password;
        expect(falla.status).toBe(409);
        const logs = textoDeLogs();
        expect(logs).not.toContain(ok.contrasena_temporal);
        expect(logs).not.toContain(claveDeLaFalla);
        expect(await falla.text()).not.toContain(claveDeLaFalla);
    });

    it('si el segundo paso falla BORRA la cuenta de Auth (compensación) y responde el error', async () => {
        preparar({ adminRpcs: { svc_usuario_crear: () => errorDeNegocio('ROL_VINCULO_INCOHERENTE', 'Vínculo incoherente.') } });
        const res = await crear({ correo: 'a@x.mx', rol: 'alumno', id_alumno: 3 });
        expect(res.status).toBe(409);
        expect((await res.json()).error.code).toBe('ROL_VINCULO_INCOHERENTE');
        expect(admin.auth.admin.createUser).toHaveBeenCalledTimes(1);
        expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('nuevo-uid');
    });

    it('si hasta la compensación falla, responde el error original y deja una línea de log sin datos personales', async () => {
        preparar({
            adminRpcs: { svc_usuario_crear: () => errorDeNegocio('DUPLICADO', 'Ya existe.') },
            authAdmin: { deleteUser: vi.fn(async () => { throw new Error('red caída'); }) },
        });
        const res = await crear({ correo: 'secreto@x.mx', rol: 'tecnico' });
        expect(res.status).toBe(409);
        expect(textoDeLogs()).toContain('no se pudo compensar');
        expect(textoDeLogs()).not.toContain('secreto@x.mx');
    });

    it('si Auth falla no se llama a svc_usuario_crear; correo repetido = 409 DUPLICADO', async () => {
        preparar({ authAdmin: { createUser: vi.fn(async () => ({ data: { user: null }, error: { code: 'email_exists', status: 422, message: 'a@x.mx already registered' } })) } });
        const res = await crear({ correo: 'a@x.mx', rol: 'tecnico' });
        expect(res.status).toBe(409);
        expect((await res.json()).error.code).toBe('DUPLICADO');
        expect(admin.llamadas).toEqual([]);
        preparar({ authAdmin: { createUser: vi.fn(async () => { throw new Error('ECONNREFUSED'); }) } });
        const caido = await crear({ correo: 'a@x.mx', rol: 'tecnico' });
        expect(caido.status).toBe(502);
        expect((await caido.json()).error.code).toBe('AUTH_NO_DISPONIBLE');
    });

    it('valida correo, rol y vínculo coherente ANTES de crear nada', async () => {
        for (const mal of [
            { correo: 'no-es-correo', rol: 'tecnico' },
            { correo: 'a@x.mx', rol: 'superadmin' },
            { correo: 'a@x.mx', rol: 'docente' },
            { correo: 'a@x.mx', rol: 'alumno', id_docente: 3 },
            { correo: 'a@x.mx', rol: 'tecnico', id_alumno: 3 },
            { correo: 'a@x.mx', rol: 'tecnico', password: 'x' },
        ]) {
            expect((await crear(mal)).status, JSON.stringify(mal)).toBe(422);
        }
        expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    });

    it('solo el administrador', async () => {
        preparar({ me: YO.docente });
        expect((await crear({ correo: 'a@x.mx', rol: 'tecnico' })).status).toBe(403);
        expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    });
});

describe('POST /api/admin/usuarios/{id}/restablecer', () => {
    const restablecer = (id = '31') => postRestablecer(pedir(`/api/admin/usuarios/${id}/restablecer`, { json: {} }), conParams({ id }));
    const conUsuarios = () => preparar({
        usuarioRpcs: { api_usuarios_listar: () => ({ total: 1, items: [{ id_usuario: 31, correo: 'e20230045@unach.mx', rol: 'alumno', activo: true }] }) },
        authAdmin: { listUsers: vi.fn(async () => ({ data: { users: [{ id: 'uid-otro', email: 'x@y.z' }, { id: 'uid-31', email: 'E20230045@unach.mx' }] }, error: null })) },
    });

    it('genera otra contraseña temporal, la aplica a la cuenta correcta y la devuelve una vez sin registrarla', async () => {
        conUsuarios();
        const res = await restablecer();
        const cuerpo = await res.json();
        expect(res.status).toBe(200);
        expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('uid-31', { password: cuerpo.contrasena_temporal });
        expect(cuerpo).toMatchObject({ id_usuario: 31, correo: 'e20230045@unach.mx' });
        expect(cuerpo.contrasena_temporal.length).toBeGreaterThanOrEqual(12);
        expect(textoDeLogs()).not.toContain(cuerpo.contrasena_temporal);
    });

    it('cuenta inexistente -> 404 sin tocar Auth; solo administrador', async () => {
        conUsuarios();
        expect((await restablecer('999')).status).toBe(404);
        expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
        preparar({ me: YO.tecnico });
        expect((await restablecer()).status).toBe(403);
    });

    it('error de Auth al actualizar -> 502 sin filtrar texto de Auth', async () => {
        conUsuarios();
        admin.auth.admin.updateUserById.mockResolvedValue({ error: { message: 'detalle interno de gotrue', status: 500 } });
        const res = await restablecer();
        expect(res.status).toBe(502);
        expect(await res.text()).not.toContain('gotrue');
    });
});

describe('POST /api/admin/camaras/{id}/probar', () => {
    const CAMARAS = { items: [{ id_camara: 4, tipo: 'ip', direccion_ip: '10.20.4.21' }, { id_camara: 3, tipo: 'navegador', direccion_ip: null }] };
    const probar = (id) => postProbar(pedir(`/api/admin/camaras/${id}/probar`, { json: {} }), conParams({ id: String(id) }));
    beforeEach(() => preparar({ usuarioRpcs: { api_camaras_estado: () => CAMARAS } }));

    it("'ip': pide un fotograma al servicio con allowed_faiss_ids vacío y reporta rostros y ms", async () => {
        reconocer.mockResolvedValue({ index_version: 'v1', elapsed_ms: 210, image: { width: 640, height: 480 }, faces: [{ bbox: [1, 2, 3, 4], det_score: 0.9, candidate: null, objeto_recorte: null }, { bbox: [1, 2, 3, 4], det_score: 0.8, candidate: null, objeto_recorte: null }] });
        const cuerpo = await (await probar(4)).json();
        expect(reconocer).toHaveBeenCalledWith({ cameraUrl: 'http://10.20.4.21/snapshot.jpg', allowedFaissIds: [] });
        expect(cuerpo).toMatchObject({ ok: true, tipo: 'ip', probada: true, rostros: 2, servicio_ms: 210 });
        expect(typeof cuerpo.ms).toBe('number');
    });

    it("'navegador': ok sin probar y sin llamar al servicio", async () => {
        const cuerpo = await (await probar(3)).json();
        expect(cuerpo).toMatchObject({ ok: true, tipo: 'navegador', probada: false });
        expect(reconocer).not.toHaveBeenCalled();
    });

    it('cámara inalcanzable se reporta como resultado (ok: false), no como fallo HTTP', async () => {
        reconocer.mockRejectedValue(new ApiError({ code: 'CAMARA_INALCANZABLE', message: 'No se pudo obtener imagen de la cámara.', status: 504 }));
        const res = await probar(4);
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ ok: false, codigo: 'CAMARA_INALCANZABLE' });
    });

    it('un fallo del servicio de reconocimiento sí es error (503); cámara inexistente 404; técnico permitido, docente no', async () => {
        reconocer.mockRejectedValue(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'x', status: 503 }));
        expect((await probar(4)).status).toBe(503);
        expect((await probar(99)).status).toBe(404);
        preparar({ me: YO.tecnico, usuarioRpcs: { api_camaras_estado: () => CAMARAS } });
        expect((await probar(3)).status).toBe(200);
        preparar({ me: YO.docente });
        expect((await probar(3)).status).toBe(403);
    });
});

describe('GET /api/salud', () => {
    it('es pública y no toca BD ni servicio', async () => {
        const res = await getSalud(pedir('/api/salud', { method: 'GET' }));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ estado: 'ok' });
        expect(getServerBackend).not.toHaveBeenCalled();
        expect(getAdminBackend).not.toHaveBeenCalled();
    });
});
