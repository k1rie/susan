import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));
vi.mock('@/lib/server/recognition', async (importar) => ({
    ...(await importar()),
    verificarFotoServicio: vi.fn(),
    verificarFotosServicio: vi.fn(),
    construirIndice: vi.fn(),
    activarIndice: vi.fn(),
    infoIndice: vi.fn(),
    manifiestoIndice: vi.fn(),
}));

import { getAdminBackend, getServerBackend } from '@/lib/backend';
import { ApiError } from '@/lib/api/errors';
import { activarIndice, construirIndice, infoIndice, manifiestoIndice, verificarFotoServicio, verificarFotosServicio } from '@/lib/server/recognition';
import { reiniciarCacheVigencia } from '@/lib/server/storage';
import { BYTES_JPEG, BYTES_PDF, BYTES_PNG, YO, archivo, conParams, crearBackend, errorDeNegocio, fotosDistintas, pedir } from '@/lib/server/testing';
import { POST as postPlantilla } from './alumnos/[id]/plantilla/route.js';
import { POST as postVerificar } from './plantilla/verificar/route.js';
import { POST as postConsentimiento } from './consentimientos/route.js';
import { POST as postRevocar } from './consentimientos/[id]/revocar/route.js';
import { GET as getDocConsent } from './documentos/consentimiento/[id]/route.js';
import { GET as getDocPlantilla } from './documentos/plantilla/[id]/route.js';
import { GET as getDocPlantillaFoto } from './documentos/plantilla_foto/[id]/route.js';
import { GET as getIndice } from './indice/route.js';
import { POST as postReconstruir } from './indice/reconstruir/route.js';
import { POST as postSincronizar } from './indice/sincronizar/route.js';
import { POST as postRevertir } from './indice/revertir/route.js';

const CALIDAD_OK = { rostros: 1, un_solo_rostro: true, calidad: { brillo: 120, nitidez: 80, tamano_rostro_px: 150, frontal: true }, motivo_rechazo: null };
const CALIDAD_FOTO = { brillo: 120.5, nitidez: 88.2, tamano_rostro_px: 210, frontal: true };
/** Respuesta de /v1/photo/check-set para n fotos; `cambios` pisa claves del conjunto y `porFoto` las de cada foto por índice. */
function conjunto(n, cambios = {}, porFoto = {}) {
    const fotos = Array.from({ length: n }, (_, i) => ({
        indice: i, estado: 'aceptada', rostros: 1, un_solo_rostro: true, calidad: CALIDAD_FOTO,
        motivo_rechazo: null, motivo_codigo: null, coseno_resto: n > 1 ? 0.8 - i * 0.01 : null, ...(porFoto[i] ?? {}),
    }));
    const aceptadas = fotos.filter((f) => f.estado === 'aceptada').length;
    return {
        total: n, aceptadas, minimo: 3, maximo: 8, suficiente: aceptadas >= 3, consistente: n > 1 ? true : null,
        ambiguo: false, umbral_coseno: 0.35, coseno_min: 0.75, coseno_medio: 0.78, coseno_max_par: 0.9, advertencias: [],
        fotos, ...cambios,
    };
}
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
            api_plantilla_registrar: (a) => { eventos.push('plantilla'); return { id_plantilla: 41, id_alumno: a.p_id_alumno, activa: true, indexada: false, requiere_reconstruccion: true, n_fotos: a.p_fotos?.length ?? 1 }; },
            api_consentimiento_registrar: () => ({ id_consent: 10, id_alumno: 17, estatus: 'vigente', vigente: true }),
            api_consentimiento_revocar: () => ({ id_consent: 9, estatus: 'revocado', plantillas_archivadas: 1, requiere_reconstruccion: true }),
            api_documento_url_autorizar: (a) => ({ tipo: a.p_tipo, id_registro: a.p_id_registro, id_alumno: 17, objeto: a.p_tipo === 'plantilla' || a.p_tipo === 'plantilla_foto' ? 'registro/17/0f8e1c2a-aaaa-4bbb-8ccc-123456789abc.jpg' : 'consentimientos/17/0f8e1c2a-aaaa-4bbb-8ccc-123456789abc.pdf', vigencia_seg: 900 }),
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
    verificarFotosServicio.mockImplementation(async (blobs) => { eventos.push('calidad_conjunto'); return conjunto(blobs.length); });
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

describe('POST /api/alumnos/{id}/plantilla con varias fotos', () => {
    const jpg = (bytes, nombre = 'f.jpg') => archivo(bytes, 'image/jpeg', nombre);
    const lote = (n) => fotosDistintas(n).map((b, i) => jpg(b, `t${i}.jpg`));
    const registrar = (fotos, extra = {}) => postPlantilla(
        pedir('/api/alumnos/17/plantilla', { form: { fotos, id_consent: '9', ...extra }, headers: { 'x-forwarded-for': '203.0.113.9' } }),
        conParams({ id: '17' }),
    );
    const llamadaRegistrar = () => usuario.rpc.mock.calls.find(([n]) => n === 'api_plantilla_registrar')[1];
    const MUESTRA = {
        id_plantilla: 41, total: 5, usadas: 5, descartadas: [{ indice: 2, motivo: 'inconsistente', coseno_resto: 0.21 }],
        coseno_min: 0.51, coseno_medio: 0.74, degradada: false,
    };

    it('5 fotos: consentimientos -> calidad del conjunto -> 5 subidas -> RPC con p_fotos exacto, y respuesta con muestra', async () => {
        construirIndice.mockResolvedValue({ version: 'v004', objeto_indice: 'indice/v004.json', dimension: 512, ntotal: 1, mapeo: MAPEO, errores: [], muestras: [MUESTRA] });
        const res = await registrar(lote(5));
        const cuerpo = await res.json();
        expect(res.status).toBe(201);
        expect(eventos).toEqual(['consentimientos', 'calidad_conjunto', 'subir', 'subir', 'subir', 'subir', 'subir', 'plantilla']);
        expect(verificarFotoServicio).not.toHaveBeenCalled();
        expect(verificarFotosServicio.mock.calls[0][0]).toHaveLength(5);

        const rutas = admin.bucket.upload.mock.calls.map(([ruta]) => ruta);
        expect(new Set(rutas).size).toBe(5);
        for (const r of rutas) expect(r).toMatch(/^registro\/17\/[0-9a-f-]{36}\.jpg$/);
        const args = llamadaRegistrar();
        expect(args).toEqual({
            p_id_alumno: 17, p_id_consent: 9, p_objeto_foto: rutas[0], p_ip: '203.0.113.9',
            p_fotos: rutas.map((ruta, i) => ({ objeto_foto: ruta, calidad: CALIDAD_FOTO, coseno_resto: 0.8 - i * 0.01 })),
        });
        expect(args.p_fotos.every((f) => !('tamano_rostro' in f.calidad))).toBe(true);
        expect(cuerpo).toMatchObject({ id_plantilla: 41, n_fotos: 5, version: 'v004', indice: { estado: 'activada', version: 'v004' } });
        expect(cuerpo.muestra).toEqual({
            total: 5, usadas: 5, descartadas: [{ indice: 2, motivo: 'inconsistente', coseno_resto: 0.21 }], coseno_min: 0.51, coseno_medio: 0.74, degradada: false,
        });
        // El arreglo completo de muestras (y cualquier vector) no viaja al cliente.
        expect(cuerpo.indice.muestras).toBeUndefined();
        expect(JSON.stringify(cuerpo)).not.toMatch(/"vector"|embedding|centroide/); // total_vectores es un contador, no un vector
    });

    it('omite las claves nulas de p_fotos (calidad y coseno_resto) para que la RPC no reciba null JSON de sobra', async () => {
        verificarFotosServicio.mockResolvedValue(conjunto(3, {}, { 0: { calidad: null, coseno_resto: null }, 1: { coseno_resto: null } }));
        expect((await registrar(lote(3))).status).toBe(201);
        const fotos = llamadaRegistrar().p_fotos;
        expect(Object.keys(fotos[0])).toEqual(['objeto_foto']);
        expect(Object.keys(fotos[1]).sort()).toEqual(['calidad', 'objeto_foto']);
        expect(Object.keys(fotos[2]).sort()).toEqual(['calidad', 'coseno_resto', 'objeto_foto']);
    });

    it('si el índice no reporta muestras de esta plantilla, muestra es null', async () => {
        const cuerpo = await (await registrar(lote(3))).json();
        expect(cuerpo.muestra).toBeNull();
        expect(cuerpo.n_fotos).toBe(3);
    });

    it('una foto rechazada: 422 FOTOS_RECHAZADAS con el estado de cada foto y NINGUNA subida ni RPC', async () => {
        verificarFotosServicio.mockResolvedValue(conjunto(5, { consistente: false, coseno_medio: 0.6 }, {
            4: { estado: 'inconsistente', motivo_codigo: 'NO_COINCIDE', motivo_rechazo: null, coseno_resto: 0.12 },
            2: { estado: 'calidad', un_solo_rostro: true, motivo_codigo: 'POCA_LUZ', motivo_rechazo: 'La foto esta muy oscura.', coseno_resto: null },
        }));
        const res = await registrar(lote(5));
        const cuerpo = await res.json();
        expect(res.status).toBe(422);
        expect(cuerpo.error.code).toBe('FOTOS_RECHAZADAS');
        expect(cuerpo.error.details).toMatchObject({ minimo: 3, maximo: 8, total: 5, aceptadas: 3, umbral_coseno: 0.35, consistente: false, ambiguo: false });
        expect(cuerpo.error.details.fotos).toHaveLength(5);
        expect(cuerpo.error.details.fotos[4]).toEqual({ indice: 4, estado: 'inconsistente', motivo_codigo: 'NO_COINCIDE', motivo_rechazo: null, coseno_resto: 0.12 });
        expect(cuerpo.error.details.fotos[2]).toMatchObject({ indice: 2, estado: 'calidad', motivo_codigo: 'POCA_LUZ' });
        expect(cuerpo.error.details.fotos[0]).toMatchObject({ indice: 0, estado: 'aceptada' });
        expect(admin.bucket.upload).not.toHaveBeenCalled();
        expect(usuario.llamadas).not.toContain('api_plantilla_registrar');
    });

    it('un conjunto ambiguo (todas inconsistentes) también es FOTOS_RECHAZADAS', async () => {
        const todas = { estado: 'inconsistente', motivo_codigo: 'CONJUNTO_AMBIGUO' };
        verificarFotosServicio.mockResolvedValue(conjunto(4, { ambiguo: true, consistente: false }, { 0: todas, 1: todas, 2: todas, 3: todas }));
        const cuerpo = await (await registrar(lote(4))).json();
        expect(cuerpo.error).toMatchObject({ code: 'FOTOS_RECHAZADAS', details: { ambiguo: true, aceptadas: 0 } });
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('2 fotos propias: 422 FOTOS_INSUFICIENTES con el mínimo que informa el servicio', async () => {
        verificarFotosServicio.mockResolvedValue(conjunto(2, { minimo: 4 }));
        const res = await registrar(lote(2));
        const cuerpo = await res.json();
        expect(res.status).toBe(422);
        expect(cuerpo.error).toMatchObject({ code: 'FOTOS_INSUFICIENTES', details: { minimo: 4, recibidas: 2 } });
        expect(cuerpo.error.message).toContain('4');
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('fotos de bytes idénticos: 422 FOTOS_DUPLICADAS con los pares, sin llamar al servicio ni subir', async () => {
        const [a, b, c] = fotosDistintas(3);
        const res = await registrar([jpg(a), jpg(b), jpg(a), jpg(c), jpg(b)]);
        const cuerpo = await res.json();
        expect(res.status).toBe(422);
        expect(cuerpo.error).toMatchObject({ code: 'FOTOS_DUPLICADAS', details: { duplicadas: [{ indice: 2, de: 0 }, { indice: 4, de: 1 }] } });
        expect(verificarFotosServicio).not.toHaveBeenCalled();
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it.each([
        ['menos fotos de las enviadas', (n) => conjunto(n - 1)],
        ['fotos desordenadas', (n) => { const c = conjunto(n); c.fotos.reverse(); return c; }],
        ['índices repetidos', (n) => { const c = conjunto(n); c.fotos[1].indice = 0; return c; }],
    ])('respuesta del servicio con %s: 502 y sin subir nada', async (_caso, hacer) => {
        verificarFotosServicio.mockImplementation(async (blobs) => hacer(blobs.length));
        const res = await registrar(lote(4));
        expect(res.status).toBe(502);
        expect((await res.json()).error.code).toBe('SERVICIO_RECONOCIMIENTO_ERROR');
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('si la RPC falla se BORRAN las 5 fotos subidas y se devuelve el error', async () => {
        preparar({ usuarioRpcs: { api_plantilla_registrar: () => errorDeNegocio('RUTA_INVALIDA', 'Ruta mala.') } });
        const res = await registrar(lote(5));
        expect(res.status).toBe(400);
        const subidas = admin.bucket.upload.mock.calls.map(([ruta]) => ruta);
        expect(subidas).toHaveLength(5);
        const borradas = admin.bucket.remove.mock.calls.flatMap(([rutas]) => rutas);
        expect([...borradas].sort()).toEqual([...subidas].sort());
    });

    it('si falla la 3.ª subida se borran las 2 anteriores, no se llama a la RPC y se relanza el error de almacenamiento', async () => {
        let n = 0;
        preparar({ storage: { upload: vi.fn(async () => { n += 1; eventos.push('subir'); return { error: n === 3 ? { message: 'x' } : null }; }) } });
        const res = await registrar(lote(5));
        expect(res.status).toBe(502);
        expect((await res.json()).error.code).toBe('ALMACENAMIENTO_NO_DISPONIBLE');
        const subidas = admin.bucket.upload.mock.calls.map(([ruta]) => ruta);
        expect(subidas).toHaveLength(3); // la 4.ª y la 5.ª ni se intentan
        const borradas = admin.bucket.remove.mock.calls.flatMap(([rutas]) => rutas);
        expect([...borradas].sort()).toEqual([subidas[0], subidas[1]].sort());
        expect(usuario.llamadas).not.toContain('api_plantilla_registrar');
    });

    it('si el índice falla la plantilla igual queda registrada (201) como pendiente y sin muestra', async () => {
        construirIndice.mockRejectedValue(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'x', status: 503 }));
        const res = await registrar(lote(5));
        const cuerpo = await res.json();
        expect(res.status).toBe(201);
        expect(cuerpo.indice).toMatchObject({ estado: 'pendiente', error: { code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE' } });
        expect(cuerpo.muestra).toBeNull();
        expect(admin.bucket.remove).not.toHaveBeenCalled(); // la plantilla ya está guardada: sus fotos no se tocan
    });

    it('consentimiento no vigente: 409 antes de analizar nada con el servicio', async () => {
        const res = await registrar(lote(5), { id_consent: '4' });
        expect(res.status).toBe(409);
        expect((await res.json()).error.code).toBe('RN_13_CONSENTIMIENTO_NO_VIGENTE');
        expect(verificarFotosServicio).not.toHaveBeenCalled();
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('límites: 9 fotos = 422 DEMASIADOS_ARCHIVOS; más de 9 MiB en total = 413; PNG = 415 con el índice', async () => {
        const res = await registrar(lote(9));
        expect(res.status).toBe(422);
        expect((await res.json()).error).toMatchObject({ code: 'DEMASIADOS_ARCHIVOS', details: { campo: 'fotos', maximo: 8, recibidos: 9 } });

        const pesada = (n) => { const b = new Uint8Array(n); b.set(BYTES_JPEG); return jpg(b); };
        const grandes = await registrar([pesada(4_900_000), pesada(4_900_000)]); // cada una < 5 MiB, juntas > 9 MiB
        expect(grandes.status).toBe(413);
        expect((await grandes.json()).error.code).toBe('ARCHIVO_DEMASIADO_GRANDE');

        const png = await registrar([...lote(2), archivo(BYTES_PNG, 'image/png')]);
        expect(png.status).toBe(415);
        expect((await png.json()).error.details).toMatchObject({ campo: 'fotos', indice: 2 });
        expect(verificarFotosServicio).not.toHaveBeenCalled();
    });

    it('un cuerpo mayor al tope del multipart da 413 limpio (no un formData truncado por el proxy)', async () => {
        const enorme = (() => { const b = new Uint8Array(10 * 1024 * 1024 + 1000); b.set(BYTES_JPEG); return jpg(b); })();
        const res = await registrar([enorme]);
        expect(res.status).toBe(413);
    });

    it("'foto' y 'fotos' juntos, o ninguno, es 422 VALIDACION; un campo foto repetido también", async () => {
        const juntos = await registrar(lote(3), { foto: jpg(BYTES_JPEG) });
        expect(juntos.status).toBe(422);
        expect((await juntos.json()).error.details.campos[0].campo).toBe('fotos');
        const ninguno = await postPlantilla(pedir('/api/alumnos/17/plantilla', { form: { id_consent: '9' } }), conParams({ id: '17' }));
        expect(ninguno.status).toBe(422);
        const doble = await postPlantilla(
            pedir('/api/alumnos/17/plantilla', { form: { foto: [jpg(BYTES_JPEG), jpg(BYTES_JPEG)], id_consent: '9' } }),
            conParams({ id: '17' }),
        );
        expect(doble.status).toBe(422);
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('solo administrador: el docente recibe 403 y no se procesa nada', async () => {
        preparar({ me: YO.docente });
        expect((await registrar(lote(5))).status).toBe(403);
        expect(verificarFotosServicio).not.toHaveBeenCalled();
    });

    it("'fotos' con UN solo archivo usa el camino heredado: calidad individual y RPC de 4 argumentos sin p_fotos", async () => {
        const res = await registrar([jpg(BYTES_JPEG)]);
        const cuerpo = await res.json();
        expect(res.status).toBe(201);
        expect(eventos).toEqual(['consentimientos', 'calidad', 'subir', 'plantilla']);
        expect(verificarFotosServicio).not.toHaveBeenCalled();
        expect(Object.keys(llamadaRegistrar()).sort()).toEqual(['p_id_alumno', 'p_id_consent', 'p_ip', 'p_objeto_foto']);
        expect(cuerpo.muestra).toBeNull();
        expect(cuerpo.n_fotos).toBe(1);
    });

    it('camino de una foto: FOTO_RECHAZADA lleva motivo_codigo en details', async () => {
        verificarFotoServicio.mockResolvedValue({ ...CALIDAD_OK, rostros: 0, un_solo_rostro: false, motivo_rechazo: 'No se detecto ningun rostro.', motivo_codigo: 'SIN_ROSTRO' });
        const res = await postPlantilla(
            pedir('/api/alumnos/17/plantilla', { form: { foto: jpg(BYTES_JPEG), id_consent: '9' } }),
            conParams({ id: '17' }),
        );
        const cuerpo = await res.json();
        expect(res.status).toBe(422);
        expect(cuerpo.error).toMatchObject({ code: 'FOTO_RECHAZADA', details: { motivo_codigo: 'SIN_ROSTRO', motivo_rechazo: 'No se detecto ningun rostro.' } });
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

    it('el modo heredado no exige alumno ni consentimiento ni consulta el conjunto', async () => {
        await postVerificar(pedir('/api/plantilla/verificar', { form: { foto: archivo(BYTES_JPEG, 'image/jpeg') } }));
        expect(usuario.llamadas).not.toContain('api_consentimientos_alumno');
        expect(verificarFotosServicio).not.toHaveBeenCalled();
    });
});

describe('POST /api/plantilla/verificar con varias fotos', () => {
    const jpg = (bytes) => archivo(bytes, 'image/jpeg', 'f.jpg');
    const verificar = (fotos, extra = { id_alumno: '17', id_consent: '9' }) => postVerificar(pedir('/api/plantilla/verificar', { form: { fotos, ...extra } }));

    it('devuelve el conjunto con el alias tamano_rostro, no guarda nada y exige consentimiento ANTES de llamar al servicio', async () => {
        const res = await verificar(fotosDistintas(5).map(jpg));
        const cuerpo = await res.json();
        expect(res.status).toBe(200);
        expect(eventos).toEqual(['consentimientos', 'calidad_conjunto']);
        expect(cuerpo).toMatchObject({ total: 5, aceptadas: 5, minimo: 3, maximo: 8, suficiente: true, consistente: true, umbral_coseno: 0.35, advertencias: [] });
        expect(cuerpo.fotos).toHaveLength(5);
        expect(cuerpo.fotos[3]).toMatchObject({ indice: 3, estado: 'aceptada', duplicada_de: null, coseno_resto: 0.77 });
        expect(cuerpo.fotos[3].calidad).toMatchObject({ tamano_rostro_px: 210, tamano_rostro: 210 });
        expect(admin.bucket.upload).not.toHaveBeenCalled();
        expect(usuario.llamadas).not.toContain('api_plantilla_registrar');
    });

    it('marca las copias exactas como duplicada (con duplicada_de) y NO las manda al servicio', async () => {
        const [a, b, c] = fotosDistintas(3);
        // El servicio solo ve las 3 únicas; la respuesta se reubica en las posiciones originales (5 enviadas).
        const res = await verificar([jpg(a), jpg(b), jpg(a), jpg(c), jpg(b)]);
        const cuerpo = await res.json();
        expect(verificarFotosServicio.mock.calls[0][0]).toHaveLength(3);
        expect(cuerpo.total).toBe(5);
        expect(cuerpo.aceptadas).toBe(3);
        expect(cuerpo.fotos.map((f) => f.estado)).toEqual(['aceptada', 'aceptada', 'duplicada', 'aceptada', 'duplicada']);
        expect(cuerpo.fotos.map((f) => f.indice)).toEqual([0, 1, 2, 3, 4]);
        expect(cuerpo.fotos[2]).toEqual({
            indice: 2, estado: 'duplicada', rostros: null, un_solo_rostro: null, calidad: null,
            motivo_rechazo: 'Es igual a otra foto del envío.', motivo_codigo: 'DUPLICADA', coseno_resto: null, duplicada_de: 0,
        });
        expect(cuerpo.fotos[4].duplicada_de).toBe(1);
        // La foto 3 era la 3.ª única: recibe el análisis de esa posición del servicio (coseno 0.78).
        expect(cuerpo.fotos[3].coseno_resto).toBe(0.78);
    });

    it('con fotos exige id_alumno e id_consent (422 con el campo) y no llama al servicio', async () => {
        const res = await verificar(fotosDistintas(3).map(jpg), {});
        const cuerpo = await res.json();
        expect(res.status).toBe(422);
        expect(cuerpo.error.details.campos.map((c) => c.campo).sort()).toEqual(['id_alumno', 'id_consent']);
        expect(verificarFotosServicio).not.toHaveBeenCalled();
        const solo = await verificar(fotosDistintas(3).map(jpg), { id_alumno: '17' });
        expect((await solo.json()).error.details.campos.map((c) => c.campo)).toEqual(['id_consent']);
    });

    it('consentimiento no vigente o ajeno: 409 sin analizar fotos', async () => {
        const vencido = await verificar(fotosDistintas(3).map(jpg), { id_alumno: '17', id_consent: '4' });
        expect(vencido.status).toBe(409);
        expect((await vencido.json()).error.code).toBe('RN_13_CONSENTIMIENTO_NO_VIGENTE');
        const ajeno = await verificar(fotosDistintas(3).map(jpg), { id_alumno: '17', id_consent: '777' });
        expect((await ajeno.json()).error.code).toBe('RN_13_CONSENTIMIENTO_AJENO');
        expect(verificarFotosServicio).not.toHaveBeenCalled();
    });

    it("'foto' y 'fotos' juntos, o ninguno: 422; 9 fotos: DEMASIADOS_ARCHIVOS; docente: 403", async () => {
        const juntos = await verificar(fotosDistintas(3).map(jpg), { id_alumno: '17', id_consent: '9', foto: jpg(BYTES_JPEG) });
        expect(juntos.status).toBe(422);
        const ninguno = await postVerificar(pedir('/api/plantilla/verificar', { form: { id_alumno: '17', id_consent: '9' } }));
        expect(ninguno.status).toBe(422);
        const muchas = await verificar(fotosDistintas(9).map(jpg));
        expect((await muchas.json()).error.code).toBe('DEMASIADOS_ARCHIVOS');
        preparar({ me: YO.docente });
        expect((await verificar(fotosDistintas(3).map(jpg))).status).toBe(403);
        expect(verificarFotosServicio).not.toHaveBeenCalled();
    });

    it('una respuesta incompleta del servicio es 502; sin servicio, 503; las advertencias del servicio pasan tal cual', async () => {
        verificarFotosServicio.mockImplementation(async (blobs) => conjunto(blobs.length - 1));
        expect((await verificar(fotosDistintas(4).map(jpg))).status).toBe(502);
        verificarFotosServicio.mockRejectedValue(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'x', status: 503 }));
        expect((await verificar(fotosDistintas(4).map(jpg))).status).toBe(503);
        verificarFotosServicio.mockImplementation(async (blobs) => conjunto(blobs.length, { advertencias: ['DIVERSIDAD_BAJA'] }));
        expect((await (await verificar(fotosDistintas(4).map(jpg))).json()).advertencias).toEqual(['DIVERSIDAD_BAJA']);
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
        expect(cuerpo.indice.muestras).toBeUndefined(); // detalle interno del build, no del contrato
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

    it('plantilla_foto: la RPC autoriza por id_foto con la IP, el TTL se acota a 300 s y no sale la ruta', async () => {
        const res = await pedirDoc(getDocPlantillaFoto, 'plantilla_foto');
        const cuerpo = await res.json();
        expect(res.status).toBe(200);
        expect(usuario.rpc.mock.calls.find(([n]) => n === 'api_documento_url_autorizar')[1]).toEqual({ p_tipo: 'plantilla_foto', p_id_registro: 9, p_ip: '203.0.113.9' });
        expect(admin.bucket.createSignedUrl.mock.calls[0][1]).toBe(300);
        expect(cuerpo).toMatchObject({ tipo: 'plantilla_foto', id_registro: 9, vigencia_seg: 300 });
        expect(Object.keys(cuerpo).some((k) => k.startsWith('objeto'))).toBe(false);
    });

    it('plantilla_foto: solo administrador, y una foto inexistente (404) o no autorizada no firma nada', async () => {
        preparar({ me: YO.docente });
        expect((await pedirDoc(getDocPlantillaFoto, 'plantilla_foto')).status).toBe(403);
        preparar({ usuarioRpcs: { api_documento_url_autorizar: () => errorDeNegocio('NO_ENCONTRADO', 'La foto de la plantilla no existe.') } });
        expect((await pedirDoc(getDocPlantillaFoto, 'plantilla_foto')).status).toBe(404);
        expect(admin.bucket.createSignedUrl).not.toHaveBeenCalled();
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
