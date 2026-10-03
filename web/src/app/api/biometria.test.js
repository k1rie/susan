import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));
vi.mock('@/lib/server/recognition', async (importar) => ({
    ...(await importar()),
    verificarFotoServicio: vi.fn(),
    construirIndice: vi.fn(),
    activarIndice: vi.fn(),
    infoIndice: vi.fn(),
    manifiestoIndice: vi.fn(),
}));

import { getAdminBackend, getServerBackend } from '@/lib/backend';
import { ApiError } from '@/lib/api/errors';
import { activarIndice, construirIndice, infoIndice, manifiestoIndice, verificarFotoServicio } from '@/lib/server/recognition';
import { reiniciarCacheVigencia } from '@/lib/server/storage';
import { BYTES_JPEG, BYTES_PDF, BYTES_PNG, YO, archivo, conParams, crearBackend, errorDeNegocio, pedir } from '@/lib/server/testing';
import { POST as postPlantilla } from './alumnos/[id]/plantilla/route.js';
import { POST as postVerificar } from './plantilla/verificar/route.js';
import { POST as postConsentimiento } from './consentimientos/route.js';
import { POST as postRevocar } from './consentimientos/[id]/revocar/route.js';
import { GET as getDocConsent } from './documentos/consentimiento/[id]/route.js';
import { GET as getDocPlantilla } from './documentos/plantilla/[id]/route.js';
import { GET as getIndice } from './indice/route.js';
import { POST as postReconstruir } from './indice/reconstruir/route.js';
import { POST as postSincronizar } from './indice/sincronizar/route.js';
import { POST as postRevertir } from './indice/revertir/route.js';

const CALIDAD_OK = { rostros: 1, un_solo_rostro: true, calidad: { brillo: 120, nitidez: 80, tamano_rostro_px: 150, frontal: true }, motivo_rechazo: null };
const CONSENT = { id_alumno: 17, vigente: true, items: [{ id_consent: 9, vigente: true, estatus: 'vigente', estatus_efectivo: 'vigente' }, { id_consent: 4, vigente: false, estatus: 'vencido', estatus_efectivo: 'vencido' }] };
const PLAN = {
    version_sugerida: 'v004', base: { id_indice: 3, version: 'v003', total_vectores: 0 }, nada_que_hacer: false,
    entries: [{ id_plantilla: 41, faiss_id: 1043, en_base: false, objeto_foto: 'registro/17/x.jpg' }],
};
const MAPEO = [{ id_plantilla: 41, faiss_id: 1043 }];

let eventos;
let usuario;
let admin;

function preparar({ usuarioRpcs = {}, adminRpcs = {}, storage = {}, me = YO.admin } = {}) {
    eventos = [];
    usuario = crearBackend({
        rpcs: {
            api_yo: () => me,
            api_consentimientos_alumno: () => { eventos.push('consentimientos'); return CONSENT; },
            api_plantilla_registrar: (a) => { eventos.push('plantilla'); return { id_plantilla: 41, id_alumno: a.p_id_alumno, activa: true, indexada: false, requiere_reconstruccion: true }; },
            api_consentimiento_registrar: () => ({ id_consent: 10, id_alumno: 17, estatus: 'vigente', vigente: true }),
            api_consentimiento_revocar: () => ({ id_consent: 9, estatus: 'revocado', plantillas_archivadas: 1, requiere_reconstruccion: true }),
            api_documento_url_autorizar: (a) => ({ tipo: a.p_tipo, id_registro: a.p_id_registro, id_alumno: 17, objeto: a.p_tipo === 'plantilla' ? 'registro/17/0f8e1c2a-aaaa-4bbb-8ccc-123456789abc.jpg' : 'consentimientos/17/0f8e1c2a-aaaa-4bbb-8ccc-123456789abc.pdf', vigencia_seg: 900 }),
            api_indice_estado: () => ({ en_uso: { id_indice: 4, version: 'v004' }, versiones: { total: 2, items: [{ id_indice: 4, version: 'v004', en_uso: true }, { id_indice: 3, version: 'v003', en_uso: false }] } }),
            ...usuarioRpcs,
        },
    });
    admin = crearBackend({
        rpcs: {
            svc_bloqueo_adquirir: () => true,
            svc_bloqueo_liberar: () => true,
            svc_indice_plan: () => PLAN,
            svc_indice_registrar: () => ({ id_indice: 4, version: 'v004' }),
            svc_indice_activar: () => ({ id_indice: 4, plantillas_asignadas: 1, plantillas_pendientes: 0, anterior: null }),
            svc_indice_revertir: () => ({ id_indice: 3, version: 'v003', plantillas_asignadas: 0, plantillas_pendientes: 1 }),
            svc_indice_en_uso: () => ({ id_indice: 4, version: 'v004' }),
            ...adminRpcs,
        },
        storage: {
            upload: vi.fn(async () => { eventos.push('subir'); return { error: null }; }),
            ...storage,
        },
    });
    getServerBackend.mockResolvedValue(usuario);
    getAdminBackend.mockResolvedValue(admin);
}

beforeEach(() => {
    reiniciarCacheVigencia();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    verificarFotoServicio.mockImplementation(async () => { eventos.push('calidad'); return CALIDAD_OK; });
    construirIndice.mockResolvedValue({ version: 'v004', objeto_indice: 'indice/v004.json', dimension: 512, ntotal: 1, mapeo: MAPEO, errores: [] });
    activarIndice.mockResolvedValue({ version: 'v004', ntotal: 1, dimension: 512, active: true, preloaded: false });
    infoIndice.mockResolvedValue({ version: 'v004', ntotal: 1, dimension: 512 });
    manifiestoIndice.mockResolvedValue({ version: 'v003', ntotal: 0, dimension: 512, refs: [] });
    preparar();
});

describe('POST /api/alumnos/{id}/plantilla', () => {
    const registrar = (form = {}, ip = '203.0.113.9') => postPlantilla(
        pedir('/api/alumnos/17/plantilla', { form: { foto: archivo(BYTES_JPEG, 'image/jpeg', 'x.jpg'), id_consent: '9', ...form }, headers: { 'x-forwarded-for': ip } }),
        conParams({ id: '17' }),
    );

    it('verifica consentimiento -> calidad -> sube -> registra -> reconstruye, y devuelve la versión', async () => {
        const res = await registrar();
        const cuerpo = await res.json();
        expect(res.status).toBe(201);
        expect(eventos).toEqual(['consentimientos', 'calidad', 'subir', 'plantilla']);
        expect(cuerpo).toMatchObject({ id_plantilla: 41, indice: { estado: 'activada', version: 'v004' }, version: 'v004' });
        expect(admin.llamadas).toContain('svc_indice_activar');
    });

    it('la ruta de la foto la construye el servidor y la RPC recibe esa ruta, el consentimiento y la IP', async () => {
        await registrar();
        const [ruta, , opts] = admin.bucket.upload.mock.calls[0];
        expect(ruta).toMatch(/^registro\/17\/[0-9a-f-]{36}\.jpg$/);
        expect(opts).toEqual({ contentType: 'image/jpeg', upsert: false });
        expect(usuario.rpc.mock.calls.find(([n]) => n === 'api_plantilla_registrar')[1]).toEqual({
            p_id_alumno: 17, p_id_consent: 9, p_objeto_foto: ruta, p_ip: '203.0.113.9',
        });
    });

    it('consentimiento no vigente: 409 y no se procesa ni se guarda el rostro', async () => {
        const res = await registrar({ id_consent: '4' });
        expect(res.status).toBe(409);
        expect((await res.json()).error.code).toBe('RN_13_CONSENTIMIENTO_NO_VIGENTE');
        expect(eventos).toEqual(['consentimientos']);
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('consentimiento de otro alumno o inexistente: 409 RN_13_CONSENTIMIENTO_AJENO', async () => {
        const res = await registrar({ id_consent: '777' });
        expect((await res.json()).error.code).toBe('RN_13_CONSENTIMIENTO_AJENO');
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('foto rechazada por calidad: 422 FOTO_RECHAZADA con el motivo y sin subir', async () => {
        verificarFotoServicio.mockResolvedValue({ ...CALIDAD_OK, rostros: 2, un_solo_rostro: false, motivo_rechazo: 'Hay mas de un rostro en la foto.' });
        const res = await registrar();
        const cuerpo = await res.json();
        expect(res.status).toBe(422);
        expect(cuerpo.error.code).toBe('FOTO_RECHAZADA');
        expect(cuerpo.error.details.motivo_rechazo).toBe('Hay mas de un rostro en la foto.');
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('si registrar la plantilla falla se BORRA la foto subida (compensación) y se devuelve el error', async () => {
        preparar({ usuarioRpcs: { api_plantilla_registrar: () => errorDeNegocio('RN_13_CONSENTIMIENTO_NO_VIGENTE', 'Ya no vigente.') } });
        const res = await registrar();
        expect(res.status).toBe(409);
        const subida = admin.bucket.upload.mock.calls[0][0];
        expect(admin.bucket.remove).toHaveBeenCalledWith([subida]);
    });

    it('si la reconstrucción del índice falla, la plantilla igual queda registrada (201) como pendiente', async () => {
        construirIndice.mockRejectedValue(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'x', status: 503 }));
        const res = await registrar();
        const cuerpo = await res.json();
        expect(res.status).toBe(201);
        expect(cuerpo.indice).toMatchObject({ estado: 'pendiente', error: { code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE' } });
        expect(admin.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('si otra reconstrucción está en curso informa estado en_curso', async () => {
        preparar({ adminRpcs: { svc_bloqueo_adquirir: () => false } });
        const cuerpo = await (await registrar()).json();
        expect(cuerpo.indice.estado).toBe('en_curso');
    });

    it('foto PNG o con firma falsa se rechaza; solo administrador', async () => {
        expect((await registrar({ foto: archivo(BYTES_PNG, 'image/png') })).status).toBe(415);
        expect((await registrar({ foto: archivo(new TextEncoder().encode('no jpeg'), 'image/jpeg') })).status).toBe(422);
        expect(verificarFotoServicio).not.toHaveBeenCalled();
        preparar({ me: YO.docente });
        expect((await registrar()).status).toBe(403);
    });

    it('sin servicio de reconocimiento al verificar: 503 y nada guardado', async () => {
        verificarFotoServicio.mockRejectedValue(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'x', status: 503 }));
        const res = await registrar();
        expect(res.status).toBe(503);
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });
});

describe('POST /api/plantilla/verificar', () => {
    it('devuelve la calidad con el alias tamano_rostro y no guarda nada', async () => {
        const res = await postVerificar(pedir('/api/plantilla/verificar', { form: { foto: archivo(BYTES_JPEG, 'image/jpeg') } }));
        const cuerpo = await res.json();
        expect(res.status).toBe(200);
        expect(cuerpo.calidad).toMatchObject({ tamano_rostro_px: 150, tamano_rostro: 150 });
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });
});

describe('POST /api/consentimientos', () => {
    const enviar = (form = {}) => postConsentimiento(pedir('/api/consentimientos', {
        form: { id_alumno: '17', fecha_firma: '2026-08-24', vigencia_hasta: '2027-08-23', documento: archivo(BYTES_PDF, 'application/pdf', 'c.pdf'), ...form },
        headers: { 'x-forwarded-for': '198.51.100.4' },
    }));

    it('sube el PDF con ruta de servidor y registra el consentimiento con esa ruta y la IP', async () => {
        const res = await enviar();
        expect(res.status).toBe(201);
        const [ruta, , opts] = admin.bucket.upload.mock.calls[0];
        expect(ruta).toMatch(/^consentimientos\/17\/[0-9a-f-]{36}\.pdf$/);
        expect(opts).toEqual({ contentType: 'application/pdf', upsert: false });
        expect(usuario.rpc.mock.calls.find(([n]) => n === 'api_consentimiento_registrar')[1]).toEqual({
            p_id_alumno: 17, p_fecha_firma: '2026-08-24', p_vigencia_hasta: '2027-08-23', p_objeto_documento: ruta, p_ip: '198.51.100.4',
        });
    });

    it('rechaza un PDF falso (422), una imagen (415) y fechas incoherentes (422) sin subir nada', async () => {
        expect((await enviar({ documento: archivo(new TextEncoder().encode('<html>'), 'application/pdf') })).status).toBe(422);
        expect((await enviar({ documento: archivo(BYTES_JPEG, 'image/jpeg') })).status).toBe(415);
        expect((await enviar({ vigencia_hasta: '2026-08-24' })).status).toBe(422);
        expect((await enviar({ fecha_firma: '2026-02-31' })).status).toBe(422);
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('si la RPC falla borra el PDF subido', async () => {
        preparar({ usuarioRpcs: { api_consentimiento_registrar: () => errorDeNegocio('NO_ENCONTRADO', 'El alumno no existe.') } });
        expect((await enviar()).status).toBe(404);
        expect(admin.bucket.remove).toHaveBeenCalledWith([admin.bucket.upload.mock.calls[0][0]]);
    });
});

describe('POST /api/consentimientos/{id}/revocar', () => {
    it('revoca y reconstruye el índice (archivó plantillas)', async () => {
        const res = await postRevocar(pedir('/api/consentimientos/9/revocar', { json: {} }), conParams({ id: '9' }));
        const cuerpo = await res.json();
        expect(res.status).toBe(200);
        expect(cuerpo).toMatchObject({ estatus: 'revocado', indice: { estado: 'activada' } });
    });
});

describe('GET /api/documentos/*/{id}', () => {
    const pedirDoc = (GET, tipo) => GET(pedir(`/api/documentos/${tipo}/9`, { method: 'GET', headers: { 'x-forwarded-for': '203.0.113.9' } }), conParams({ id: '9' }));

    it('consentimiento: la RPC autoriza con la IP, el TTL se acota a 300 s y no sale la ruta', async () => {
        const res = await pedirDoc(getDocConsent, 'consentimiento');
        const cuerpo = await res.json();
        expect(res.status).toBe(200);
        expect(usuario.rpc.mock.calls.find(([n]) => n === 'api_documento_url_autorizar')[1]).toEqual({ p_tipo: 'consentimiento', p_id_registro: 9, p_ip: '203.0.113.9' });
        expect(admin.bucket.createSignedUrl.mock.calls[0][1]).toBe(300);
        expect(cuerpo).toMatchObject({ tipo: 'consentimiento', id_registro: 9, vigencia_seg: 300 });
        expect(Object.keys(cuerpo).some((k) => k.startsWith('objeto'))).toBe(false);
    });

    it('plantilla: firma la foto de registro; un no autorizado no firma nada', async () => {
        expect((await pedirDoc(getDocPlantilla, 'plantilla')).status).toBe(200);
        preparar({ usuarioRpcs: { api_documento_url_autorizar: () => errorDeNegocio('NO_AUTORIZADO', 'No.') } });
        expect((await pedirDoc(getDocPlantilla, 'plantilla')).status).toBe(403);
        expect(admin.bucket.createSignedUrl).not.toHaveBeenCalled();
    });
});

describe('rutas del índice', () => {
    it('GET /api/indice: técnico y administrador; el alumno no', async () => {
        preparar({ me: YO.tecnico });
        const res = await getIndice(pedir('/api/indice', { method: 'GET' }));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ sincronizado: true, servicio: { disponible: true } });
        preparar({ me: YO.alumno });
        expect((await getIndice(pedir('/api/indice', { method: 'GET' }))).status).toBe(403);
        preparar({ me: YO.admin });
        expect((await getIndice(pedir('/api/indice?limit=500', { method: 'GET' }))).status).toBe(422);
    });

    it('POST /api/indice/reconstruir: técnico reconstruye; falla de fotos = 422 con errores', async () => {
        preparar({ me: YO.tecnico });
        const ok = await postReconstruir(pedir('/api/indice/reconstruir', { json: { completa: true } }));
        expect(ok.status).toBe(200);
        expect((await ok.json()).estado).toBe('activada');
        expect(admin.rpc.mock.calls.find(([n]) => n === 'svc_indice_plan')[1]).toEqual({ p_completa: true });

        construirIndice.mockResolvedValue({ version: 'v004', objeto_indice: null, dimension: 512, ntotal: 0, mapeo: [], errores: [{ id_plantilla: 41, motivo: 'No se detecto ningun rostro.' }] });
        const mal = await postReconstruir(pedir('/api/indice/reconstruir', { json: {} }));
        const cuerpo = await mal.json();
        expect(mal.status).toBe(422);
        expect(cuerpo.error.code).toBe('INDICE_CONSTRUCCION_FALLIDA');
        expect(cuerpo.error.details.errores[0].id_plantilla).toBe(41);
    });

    it('reconstruir con otra reconstrucción en curso: 409 RECONSTRUCCION_EN_CURSO', async () => {
        preparar({ me: YO.tecnico, adminRpcs: { svc_bloqueo_adquirir: () => false } });
        const res = await postReconstruir(pedir('/api/indice/reconstruir', { json: {} }));
        expect(res.status).toBe(409);
        expect((await res.json()).error.code).toBe('RECONSTRUCCION_EN_CURSO');
    });

    it('POST /api/indice/sincronizar y /revertir (solo técnico)', async () => {
        preparar({ me: YO.tecnico });
        expect((await postSincronizar(pedir('/api/indice/sincronizar', { json: {} }))).status).toBe(200);
        const rev = await postRevertir(pedir('/api/indice/revertir', { json: { id_indice: 3 } }));
        expect(rev.status).toBe(200);
        expect(await rev.json()).toMatchObject({ estado: 'revertida', version: 'v003' });
        expect((await postRevertir(pedir('/api/indice/revertir', { json: { id_indice: 999 } }))).status).toBe(404);
        preparar({ me: YO.admin });
        expect((await postRevertir(pedir('/api/indice/revertir', { json: { id_indice: 3 } }))).status).toBe(403);
    });
});
