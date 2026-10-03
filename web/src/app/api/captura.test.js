import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));
vi.mock('@/lib/server/recognition', async (importar) => ({ ...(await importar()), reconocer: vi.fn() }));

import { getAdminBackend, getServerBackend } from '@/lib/backend';
import { ApiError } from '@/lib/api/errors';
import { reconocer } from '@/lib/server/recognition';
import { reiniciarCacheIntervalo } from '@/lib/server/captura';
import { reiniciarLimitador } from '@/lib/server/rateLimit';
import { BYTES_JPEG, YO, archivo, conParams, crearBackend, errorDeNegocio, pedir } from '@/lib/server/testing';
import { POST } from './sesiones/[id]/captura/route.js';

const MARCA = '2026-09-14T13:05:00.000Z';
const EPOCH = Date.parse(MARCA);

const MONITOR = (cambios = {}) => ({
    sesion: { id_sesion: 12, estatus: 'abierta', modo_registro: 'automatico', en_ventana: true, minuto_actual: 5, fase: 'presente', ...cambios.sesion },
    camaras: cambios.camaras ?? [
        { id_camara: 3, posicion: 'frente', tipo: 'navegador', estatus: 'activa' },
        { id_camara: 4, posicion: 'fondo', tipo: 'ip', estatus: 'activa' },
        { id_camara: 5, posicion: 'lateral', tipo: 'navegador', estatus: 'mantenimiento' },
    ],
    alumnos: [],
    totales: {},
});

const ROSTROS = {
    index_version: 'v003', elapsed_ms: 321, image: { width: 640, height: 480 },
    faces: [
        { bbox: [1, 2, 3, 4], det_score: 0.99, candidate: { faiss_id: 1001, score: 0.912 }, objeto_recorte: `recortes/12/3-${EPOCH}/1.jpg` },
        { bbox: [5, 6, 7, 8], det_score: 0.91, candidate: null, objeto_recorte: `recortes/12/3-${EPOCH}/2.jpg` },
    ],
};

let orden;
let usuario;
let admin;

function preparar({ usuarioRpcs = {}, adminRpcs = {}, me = YO.docente } = {}) {
    orden = [];
    const trazar = (n, f) => (args) => { orden.push(n); return f(args); };
    usuario = crearBackend({
        rpcs: {
            api_yo: () => me,
            api_parametros_publicos: () => ({ intervalo_muestreo_seg: 15 }),
            api_sesion_monitor: trazar('api_sesion_monitor', () => MONITOR()),
            ...usuarioRpcs,
        },
    });
    admin = crearBackend({
        rpcs: {
            svc_alumnos_candidatos: trazar('svc_alumnos_candidatos', () => ({ index_version: 'v003', faiss_ids: [1001, 1002], mapa: [] })),
            svc_camara_direccion: () => null,
            svc_crear_captura: trazar('svc_crear_captura', () => 4101),
            svc_registrar_detecciones: trazar('svc_registrar_detecciones', () => ({
                id_captura: 4101, rostros: 2, validas: 1, no_atribuidas: 1, cambios: [{ id_alumno: 41, estado: 'pendiente' }], ya_procesada: false,
            })),
            ...adminRpcs,
        },
    });
    getServerBackend.mockResolvedValue(usuario);
    getAdminBackend.mockResolvedValue(admin);
    reconocer.mockImplementation(async () => { orden.push('reconocer'); return ROSTROS; });
}

const capturaMultipart = (extra = {}) => pedir('/api/sesiones/12/captura', {
    form: { image: archivo(BYTES_JPEG, 'image/jpeg', 'f.jpg'), id_camara: '3', marca_tiempo: MARCA, ...extra },
});
const llamar = (req) => POST(req, conParams({ id: '12' }));

beforeEach(() => {
    reiniciarLimitador();
    reiniciarCacheIntervalo();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    preparar();
});

describe('POST /api/sesiones/{id}/captura', () => {
    it('llama en orden: monitor (docente) -> candidatos -> servicio -> crear captura -> detecciones', async () => {
        const res = await llamar(capturaMultipart());
        expect(res.status).toBe(200);
        expect(orden).toEqual(['api_sesion_monitor', 'svc_alumnos_candidatos', 'reconocer', 'svc_crear_captura', 'svc_registrar_detecciones']);
        // El monitor corre con la identidad del docente; las svc_* con service_role.
        expect(usuario.llamadas).toContain('api_sesion_monitor');
        expect(admin.llamadas).not.toContain('api_sesion_monitor');
        expect(usuario.llamadas.some((n) => n.startsWith('svc_'))).toBe(false);
    });

    it('entrega al servicio los candidatos, el prefijo de recortes y la imagen; crea la captura con los rostros reales', async () => {
        await llamar(capturaMultipart());
        const args = reconocer.mock.calls[0][0];
        expect(args.allowedFaissIds).toEqual([1001, 1002]);
        expect(args.cropPrefix).toBe(`recortes/12/3-${EPOCH}/`);
        expect(args.imagen).toBeInstanceOf(Blob);
        expect(args.cameraUrl).toBeUndefined();
        const crear = admin.rpc.mock.calls.find(([n]) => n === 'svc_crear_captura')[1];
        expect(crear).toEqual({ p_id_sesion: 12, p_id_camara: 3, p_marca_tiempo: MARCA, p_rostros: 2 });
        const reg = admin.rpc.mock.calls.find(([n]) => n === 'svc_registrar_detecciones')[1];
        expect(reg).toEqual({
            p_id_captura: 4101,
            p_detecciones: [
                { faiss_id: 1001, score: 0.912, objeto_recorte: `recortes/12/3-${EPOCH}/1.jpg` },
                { faiss_id: null, score: null, objeto_recorte: `recortes/12/3-${EPOCH}/2.jpg` },
            ],
        });
    });

    it('responde el resumen y nunca bbox, vectores ni rutas de recorte', async () => {
        const cuerpo = await (await llamar(capturaMultipart())).json();
        expect(cuerpo).toMatchObject({ id_captura: 4101, rostros: 2, validas: 1, no_atribuidas: 1, ya_procesada: false, marca_tiempo: MARCA, index_version: 'v003' });
        expect(cuerpo.camara).toEqual({ id_camara: 3, posicion: 'frente' });
        expect(JSON.stringify(cuerpo)).not.toMatch(/bbox|recortes\/|vector|embedding/);
    });

    it('es idempotente: reenviar el mismo fotograma usa el mismo prefijo y la misma captura, sin 429', async () => {
        const a = await llamar(capturaMultipart());
        admin.rpc.mockClear();
        preparar({ adminRpcs: { svc_registrar_detecciones: () => ({ id_captura: 4101, rostros: 2, validas: 1, no_atribuidas: 1, cambios: [], ya_procesada: true }) } });
        const b = await llamar(capturaMultipart());
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        expect((await b.json()).ya_procesada).toBe(true);
        expect(reconocer.mock.calls[0][0].cropPrefix).toBe(`recortes/12/3-${EPOCH}/`);
    });

    it('limita a 1 solicitud por cámara cada intervalo/2: otro fotograma enseguida recibe 429 con Retry-After', async () => {
        await llamar(capturaMultipart());
        const otra = await llamar(capturaMultipart({ marca_tiempo: '2026-09-14T13:05:01.000Z' }));
        expect(otra.status).toBe(429);
        expect(Number(otra.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
        expect((await otra.json()).error.code).toBe('DEMASIADOS_INTENTOS');
    });

    it('si el servicio de reconocimiento falla: 503 sin tocar la BD (no crea captura ni detecciones)', async () => {
        reconocer.mockRejectedValue(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'El servicio de reconocimiento no está disponible.', status: 503 }));
        const res = await llamar(capturaMultipart());
        expect(res.status).toBe(503);
        expect((await res.json()).error.code).toBe('SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE');
        expect(admin.llamadas).not.toContain('svc_crear_captura');
        expect(admin.llamadas).not.toContain('svc_registrar_detecciones');
        expect(admin.llamadas).toEqual(['svc_alumnos_candidatos']); // solo lectura
    });

    it.each(['CAPTURA_EN_OTRA_SESION', 'FUERA_DE_VENTANA', 'SESION_NO_ABIERTA'])('%s al crear la captura = fin del muestreo (409) y limpia los recortes huérfanos', async (hint) => {
        preparar({ adminRpcs: { svc_crear_captura: () => errorDeNegocio(hint, 'Mensaje de la BD.') } });
        const res = await llamar(capturaMultipart());
        const cuerpo = await res.json();
        expect(res.status).toBe(409);
        expect(cuerpo.error.code).toBe(hint);
        expect(cuerpo.error.details.fin_muestreo).toBe(true);
        expect(admin.llamadas).not.toContain('svc_registrar_detecciones');
        expect(admin.bucket.remove).toHaveBeenCalledTimes(2);
    });

    it('SESION_NO_ABIERTA al registrar detecciones también es fin de muestreo', async () => {
        preparar({ adminRpcs: { svc_registrar_detecciones: () => errorDeNegocio('SESION_NO_ABIERTA', 'Cerrada.') } });
        const res = await llamar(capturaMultipart());
        expect(res.status).toBe(409);
        expect((await res.json()).error.details.fin_muestreo).toBe(true);
    });

    it.each([
        [{ sesion: { estatus: 'cerrada' } }, 'SESION_NO_ABIERTA'],
        [{ sesion: { modo_registro: 'manual' } }, 'SESION_NO_AUTOMATICA'],
        [{ sesion: { en_ventana: false } }, 'FUERA_DE_VENTANA'],
    ])('el monitor %j termina el muestreo con 409 %s sin llamar al servicio', async (cambios, codigo) => {
        preparar({ usuarioRpcs: { api_sesion_monitor: () => MONITOR(cambios) } });
        const res = await llamar(capturaMultipart());
        expect(res.status).toBe(409);
        const cuerpo = await res.json();
        expect(cuerpo.error.code).toBe(codigo);
        expect(cuerpo.error.details.fin_muestreo).toBe(true);
        expect(reconocer).not.toHaveBeenCalled();
        expect(admin.rpc).not.toHaveBeenCalled();
    });

    it('un docente ajeno (RLS) recibe 403 del monitor y no pasa de ahí', async () => {
        preparar({ usuarioRpcs: { api_sesion_monitor: () => errorDeNegocio('NO_AUTORIZADO', 'No eres titular.') } });
        expect((await llamar(capturaMultipart())).status).toBe(403);
        expect(reconocer).not.toHaveBeenCalled();
    });

    it('cámara de otra aula -> 409 CAMARA_FUERA_DE_AULA; inactiva -> 409 CAMARA_INACTIVA', async () => {
        const fuera = await llamar(capturaMultipart({ id_camara: '99' }));
        expect(fuera.status).toBe(409);
        expect((await fuera.json()).error.code).toBe('CAMARA_FUERA_DE_AULA');
        reiniciarLimitador();
        const inactiva = await llamar(capturaMultipart({ id_camara: '5', marca_tiempo: '2026-09-14T13:06:00.000Z' }));
        expect((await inactiva.json()).error.code).toBe('CAMARA_INACTIVA');
        expect(reconocer).not.toHaveBeenCalled();
    });

    it('solo el docente: el alumno recibe 403 y sin sesión 401', async () => {
        preparar({ me: YO.alumno });
        expect((await llamar(capturaMultipart())).status).toBe(403);
        getServerBackend.mockResolvedValue(crearBackend({ user: null }));
        expect((await llamar(capturaMultipart())).status).toBe(401);
    });

    it('cámara del navegador sin imagen -> 422; imagen falsa (firma) -> 422 ARCHIVO_INVALIDO', async () => {
        const sinImagen = await llamar(pedir('/api/sesiones/12/captura', { json: { id_camara: 3, marca_tiempo: MARCA } }));
        expect(sinImagen.status).toBe(422);
        expect(reconocer).not.toHaveBeenCalled();
        const falsa = await llamar(capturaMultipart({ image: archivo(new TextEncoder().encode('no soy jpeg'), 'image/jpeg') }));
        expect(falsa.status).toBe(422);
        expect((await falsa.json()).error.code).toBe('ARCHIVO_INVALIDO');
    });

    it('valida entrada: id de ruta, id_camara y marca_tiempo', async () => {
        expect((await POST(capturaMultipart(), conParams({ id: 'abc' }))).status).toBe(422);
        expect((await llamar(pedir('/api/sesiones/12/captura', { json: { id_camara: 'x' } }))).status).toBe(422);
        expect((await llamar(pedir('/api/sesiones/12/captura', { json: { id_camara: 4, marca_tiempo: 'ayer' } }))).status).toBe(422);
        expect((await llamar(pedir('/api/sesiones/12/captura', { json: { id_camara: 4, intruso: 1 } }))).status).toBe(422);
    });

    describe('cámaras IP', () => {
        it('JSON { id_camara }: el servicio jala http://<ip>/snapshot.jpg', async () => {
            preparar({ usuarioRpcs: { api_sesion_monitor: () => MONITOR({ camaras: [{ id_camara: 4, posicion: 'fondo', tipo: 'ip', estatus: 'activa', direccion_ip: '10.20.4.21' }] }) } });
            const res = await llamar(pedir('/api/sesiones/12/captura', { json: { id_camara: 4, marca_tiempo: MARCA } }));
            expect(res.status).toBe(200);
            const args = reconocer.mock.calls[0][0];
            expect(args.cameraUrl).toBe('http://10.20.4.21/snapshot.jpg');
            expect(args.imagen).toBeUndefined();
        });

        it('resuelve la dirección por svc_camara_direccion y respeta CAMERA_SNAPSHOT_PATH', async () => {
            vi.stubEnv('CAMERA_SNAPSHOT_PATH', '/cgi-bin/snap.cgi?chn=0');
            preparar({ adminRpcs: { svc_camara_direccion: () => '2001:db8::5' } });
            await llamar(pedir('/api/sesiones/12/captura', { json: { id_camara: 4, marca_tiempo: MARCA } }));
            expect(reconocer.mock.calls[0][0].cameraUrl).toBe('http://[2001:db8::5]/cgi-bin/snap.cgi?chn=0');
            vi.unstubAllEnvs();
        });

        it('sin dirección resoluble: 503 CAMARA_SIN_DIRECCION, no llama al servicio ni crea la captura', async () => {
            const res = await llamar(pedir('/api/sesiones/12/captura', { json: { id_camara: 4, marca_tiempo: MARCA } }));
            expect(res.status).toBe(503);
            expect((await res.json()).error.code).toBe('CAMARA_SIN_DIRECCION');
            expect(reconocer).not.toHaveBeenCalled();
            expect(orden).not.toContain('svc_crear_captura');
        });

        it('una cámara IP no acepta imagen subida (422)', async () => {
            const res = await llamar(capturaMultipart({ id_camara: '4' }));
            expect(res.status).toBe(422);
            expect(reconocer).not.toHaveBeenCalled();
        });
    });
});
