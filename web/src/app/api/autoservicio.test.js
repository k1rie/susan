// Rutas de autoservicio del alumno (/api/yo/*): aceptar el aviso, revocar, verificar y registrar el propio rostro.
// Lo que se prueba aquí es lo que NO depende del alumno: que el id sale de la sesión, que no se guarda nada si falla una
// comprobación previa, que el rostro repetido se rechaza sin revelar de quién es y que el candado diario se avisa antes de gastar CPU.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));
vi.mock('@/lib/server/recognition', async (importar) => ({
    ...(await importar()),
    verificarFotosServicio: vi.fn(),
    reconocer: vi.fn(),
    construirIndice: vi.fn(),
    activarIndice: vi.fn(),
    infoIndice: vi.fn(),
    manifiestoIndice: vi.fn(),
}));

import { getAdminBackend, getServerBackend } from '@/lib/backend';
import { ApiError } from '@/lib/api/errors';
import { VERSION_AVISO } from '@/lib/avisoBiometrico';
import { activarIndice, construirIndice, infoIndice, manifiestoIndice, reconocer, verificarFotosServicio } from '@/lib/server/recognition';
import { reiniciarCacheVigencia } from '@/lib/server/storage';
import { BYTES_JPEG, YO, archivo, crearBackend, errorDeNegocio, fotosDistintas, pedir } from '@/lib/server/testing';
import { POST as postAceptar } from './yo/consentimiento/route.js';
import { POST as postRevocar } from './yo/consentimiento/revocar/route.js';
import { POST as postPlantilla } from './yo/plantilla/route.js';
import { POST as postVerificar } from './yo/plantilla/verificar/route.js';

const CALIDAD_FOTO = { brillo: 120.5, nitidez: 88.2, tamano_rostro_px: 210, frontal: true };
/** Respuesta de /v1/photo/check-set para n fotos. */
function conjunto(n, cambios = {}) {
    const fotos = Array.from({ length: n }, (_, i) => ({
        indice: i, estado: 'aceptada', rostros: 1, un_solo_rostro: true, calidad: CALIDAD_FOTO,
        motivo_rechazo: null, motivo_codigo: null, coseno_resto: 0.8 - i * 0.01,
    }));
    return {
        total: n, aceptadas: n, minimo: 3, maximo: 8, suficiente: n >= 3, consistente: true, ambiguo: false,
        umbral_coseno: 0.35, coseno_min: 0.75, coseno_medio: 0.78, coseno_max_par: 0.9, advertencias: [], fotos, ...cambios,
    };
}

const SIN_CONSENTIMIENTO = {
    id_alumno: 44, matricula: 'E20230045', nombre: 'Ana Pérez López', estatus: 'activo', hoy: '2026-10-07',
    ahora: '2026-10-07T09:12:41-06:00', puede_registrar: true, consentimiento: null, plantilla: null, completo: false,
    paso: 'consentimiento', vigencia_meses: 12, vigencia_prevista: '2027-10-07', registros_24h: 0, limite_registros_24h: 5,
};
const CON_CONSENTIMIENTO = {
    ...SIN_CONSENTIMIENTO,
    consentimiento: { id_consent: 9, fecha_firma: '2026-10-07', vigencia_hasta: '2027-10-07', dias_restantes: 365, origen: 'alumno', version_aviso: VERSION_AVISO },
    paso: 'rostro',
};
const MAPEO = [{ id_plantilla: 41, faiss_id: 1043 }];
const PLAN = {
    version_sugerida: 'v004', base: { id_indice: 3, version: 'v003', total_vectores: 0 }, nada_que_hacer: false,
    entries: [{ id_plantilla: 41, faiss_id: 1043, en_base: false, objeto_foto: 'registro/44/x.jpg' }],
};

let eventos;
let usuario;
let admin;

function preparar({ registro = SIN_CONSENTIMIENTO, usuarioRpcs = {}, adminRpcs = {}, storage = {}, me = YO.alumno } = {}) {
    eventos = [];
    usuario = crearBackend({
        rpcs: {
            api_yo: () => me,
            api_mi_registro: () => registro,
            api_mi_consentimiento_aceptar: () => ({ id_consent: 9, id_alumno: 44, estatus: 'vigente', vigente: true, origen: 'alumno', version_aviso: VERSION_AVISO }),
            api_mi_consentimiento_revocar: () => ({ id_alumno: 44, consentimientos_revocados: 1, plantillas_archivadas: 1, requiere_reconstruccion: true }),
            api_mi_plantilla_registrar: (a) => { eventos.push('plantilla'); return { id_plantilla: 41, id_alumno: 44, activa: true, indexada: false, requiere_reconstruccion: true, n_fotos: a.p_fotos?.length ?? 1 }; },
            api_parametros_publicos: () => ({ umbral_similitud: 0.85 }),
            ...usuarioRpcs,
        },
    });
    admin = crearBackend({
        rpcs: {
            svc_faiss_ids_otros_alumnos: () => ({ indice: 'v003', faiss_ids: [] }),
            svc_bloqueo_adquirir: () => true,
            svc_bloqueo_liberar: () => true,
            svc_indice_plan: () => PLAN,
            svc_indice_registrar: () => ({ id_indice: 4, version: 'v004' }),
            svc_indice_activar: () => ({ id_indice: 4, plantillas_asignadas: 1, plantillas_pendientes: 0, anterior: null }),
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

const llamada = (nombre) => usuario.rpc.mock.calls.find(([n]) => n === nombre)?.[1];
const jpg = (bytes, nombre = 'f.jpg') => archivo(bytes, 'image/jpeg', nombre);
const lote = (n) => fotosDistintas(n).map((b, i) => jpg(b, `t${i}.jpg`));

beforeEach(() => {
    reiniciarCacheVigencia();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    verificarFotosServicio.mockImplementation(async (blobs) => { eventos.push('calidad_conjunto'); return conjunto(blobs.length); });
    reconocer.mockImplementation(async () => { eventos.push('dedupe'); return { index_version: 'v003', elapsed_ms: 5, image: { width: 1, height: 1 }, faces: [] }; });
    construirIndice.mockResolvedValue({ version: 'v004', objeto_indice: 'indice/v004.json', dimension: 512, ntotal: 1, mapeo: MAPEO, errores: [] });
    activarIndice.mockResolvedValue({ version: 'v004', ntotal: 1, dimension: 512, active: true, preloaded: false });
    infoIndice.mockResolvedValue({ version: 'v004', ntotal: 1, dimension: 512 });
    manifiestoIndice.mockResolvedValue({ version: 'v003', ntotal: 0, dimension: 512, refs: [] });
    preparar();
});

describe('POST /api/yo/consentimiento', () => {
    const aceptar = (cuerpo = { version_aviso: VERSION_AVISO, acepto: true }) => postAceptar(
        pedir('/api/yo/consentimiento', { json: cuerpo, headers: { 'x-forwarded-for': '203.0.113.9' } }),
    );

    it('genera la constancia PDF, la sube con ruta del servidor y registra el consentimiento sin id_alumno', async () => {
        const res = await aceptar();
        expect(res.status).toBe(201);
        expect((await res.json())).toMatchObject({ id_consent: 9, origen: 'alumno', version_aviso: VERSION_AVISO });
        const [ruta, cuerpoPdf, opts] = admin.bucket.upload.mock.calls[0];
        expect(ruta).toMatch(/^consentimientos\/44\/[0-9a-f-]{36}\.pdf$/);
        expect(opts).toEqual({ contentType: 'application/pdf', upsert: false });
        expect(Buffer.from(cuerpoPdf).subarray(0, 5).toString('latin1')).toBe('%PDF-');
        expect(llamada('api_mi_consentimiento_aceptar')).toEqual({ p_objeto_documento: ruta, p_version_aviso: VERSION_AVISO, p_ip: '203.0.113.9' });
    });

    it('la constancia lleva el nombre, la matrícula y la vigencia del estado de la sesión', async () => {
        await aceptar();
        const texto = Buffer.from(admin.bucket.upload.mock.calls[0][1]).toString('latin1');
        expect(texto).toContain('Ana Pérez López'.normalize('NFC'));
        expect(texto).toContain('E20230045');
        expect(texto).toContain('2027-10-07');
        expect(texto).toContain('203.0.113.9');
    });

    it('un aviso de otra versión se rechaza (409) y no se sube nada', async () => {
        const res = await aceptar({ version_aviso: '2020-01', acepto: true });
        expect(res.status).toBe(409);
        expect((await res.json()).error.code).toBe('AVISO_DESACTUALIZADO');
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('sin marcar la declaración (acepto: false) es 422', async () => {
        const res = await aceptar({ version_aviso: VERSION_AVISO, acepto: false });
        expect(res.status).toBe(422);
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('no admite un id_alumno en el cuerpo: el alumno siempre es el de la sesión', async () => {
        const res = await aceptar({ version_aviso: VERSION_AVISO, acepto: true, id_alumno: 99 });
        expect(res.status).toBe(422);
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('con un consentimiento vigente no genera otro: 409 CONSENTIMIENTO_YA_VIGENTE', async () => {
        preparar({ registro: CON_CONSENTIMIENTO });
        const res = await aceptar();
        expect(res.status).toBe(409);
        expect((await res.json()).error.code).toBe('CONSENTIMIENTO_YA_VIGENTE');
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('un alumno que no está activo no puede aceptar (409 ALUMNO_INACTIVO)', async () => {
        preparar({ registro: { ...SIN_CONSENTIMIENTO, puede_registrar: false, estatus: 'baja_temporal' } });
        const res = await aceptar();
        expect(res.status).toBe(409);
        expect((await res.json()).error.code).toBe('ALUMNO_INACTIVO');
    });

    it('si registrar el consentimiento falla se BORRA la constancia subida', async () => {
        preparar({ usuarioRpcs: { api_mi_consentimiento_aceptar: () => errorDeNegocio('CONSENTIMIENTO_YA_VIGENTE', 'Ya vigente.') } });
        const res = await aceptar();
        expect(res.status).toBe(409);
        const subida = admin.bucket.upload.mock.calls[0][0];
        expect(admin.bucket.remove).toHaveBeenCalledWith([subida]);
    });

    it('solo el alumno: docente y administrador reciben 403', async () => {
        for (const me of [YO.docente, YO.admin, YO.tecnico]) {
            preparar({ me });
            expect((await aceptar()).status).toBe(403);
        }
    });
});

describe('POST /api/yo/consentimiento/revocar', () => {
    const revocar = () => postRevocar(pedir('/api/yo/consentimiento/revocar', { json: {}, headers: { 'x-forwarded-for': '203.0.113.9' } }));

    it('revoca el propio consentimiento y reconstruye el índice si había plantillas indexadas', async () => {
        const res = await revocar();
        const cuerpo = await res.json();
        expect(res.status).toBe(200);
        expect(cuerpo).toMatchObject({ consentimientos_revocados: 1, plantillas_archivadas: 1, indice: { estado: 'activada' } });
        expect(llamada('api_mi_consentimiento_revocar')).toEqual({ p_ip: '203.0.113.9' });
        expect(admin.llamadas).toContain('svc_indice_activar');
    });

    it('sin plantillas indexadas no reconstruye el índice', async () => {
        preparar({ usuarioRpcs: { api_mi_consentimiento_revocar: () => ({ id_alumno: 44, consentimientos_revocados: 1, plantillas_archivadas: 0, requiere_reconstruccion: false }) } });
        const cuerpo = await (await revocar()).json();
        expect(cuerpo.indice).toBeUndefined();
        expect(admin.llamadas).not.toContain('svc_indice_activar');
    });

    it('sin consentimiento vigente: 409 con el código de la regla', async () => {
        preparar({ usuarioRpcs: { api_mi_consentimiento_revocar: () => errorDeNegocio('RN_13_CONSENTIMIENTO_NO_VIGENTE', 'No tienes uno vigente.') } });
        const res = await revocar();
        expect(res.status).toBe(409);
        expect((await res.json()).error.code).toBe('RN_13_CONSENTIMIENTO_NO_VIGENTE');
    });

    it('solo el alumno', async () => {
        preparar({ me: YO.admin });
        expect((await revocar()).status).toBe(403);
    });
});

describe('POST /api/yo/plantilla/verificar', () => {
    const verificar = (fotos = lote(5)) => postVerificar(pedir('/api/yo/plantilla/verificar', { form: { fotos } }));

    it('verifica el conjunto con el consentimiento propio y devuelve el análisis', async () => {
        preparar({ registro: CON_CONSENTIMIENTO });
        const res = await verificar();
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ total: 5, aceptadas: 5, suficiente: true });
        expect(verificarFotosServicio).toHaveBeenCalledTimes(1);
    });

    it('sin consentimiento vigente: 409 y no se calcula nada de su rostro (RN-13)', async () => {
        const res = await verificar();
        expect(res.status).toBe(409);
        expect((await res.json()).error.code).toBe('RN_13_CONSENTIMIENTO_NO_VIGENTE');
        expect(verificarFotosServicio).not.toHaveBeenCalled();
    });

    it('con el cupo diario agotado: 429 antes de llamar al servicio de reconocimiento', async () => {
        preparar({ registro: { ...CON_CONSENTIMIENTO, registros_24h: 5 } });
        const res = await verificar();
        expect(res.status).toBe(429);
        expect((await res.json()).error.code).toBe('AUTOREGISTRO_LIMITE');
        expect(verificarFotosServicio).not.toHaveBeenCalled();
    });

    it('no acepta id_alumno ni id_consent de la persona: la ruta no declara campos de texto y los ignora', async () => {
        preparar({ registro: CON_CONSENTIMIENTO });
        const res = await postVerificar(pedir('/api/yo/plantilla/verificar', { form: { fotos: lote(3), id_alumno: '99', id_consent: '1' } }));
        // El texto no se lee ni se usa: lo que se consulta es siempre el estado del alumno de la sesión.
        expect(res.status).toBe(200);
        expect(llamada('api_mi_registro')).toBeDefined();
    });

    it('solo el alumno', async () => {
        preparar({ registro: CON_CONSENTIMIENTO, me: YO.docente });
        expect((await verificar()).status).toBe(403);
    });
});

describe('POST /api/yo/plantilla', () => {
    const registrar = (fotos = lote(5)) => postPlantilla(pedir('/api/yo/plantilla', { form: { fotos }, headers: { 'x-forwarded-for': '203.0.113.9' } }));
    const resultado = (score) => async () => {
        eventos.push('dedupe');
        return { index_version: 'v003', elapsed_ms: 5, image: { width: 1, height: 1 }, faces: [{ bbox: [0, 0, 1, 1], det_score: 0.99, candidate: { faiss_id: 5, score }, objeto_recorte: null }] };
    };

    beforeEach(() => preparar({ registro: CON_CONSENTIMIENTO }));

    it('calidad -> rostro no repetido -> sube todas -> registra -> reconstruye, con el id y el consentimiento de la sesión', async () => {
        const res = await registrar();
        const cuerpo = await res.json();
        expect(res.status).toBe(201);
        expect(eventos).toEqual(['calidad_conjunto', 'subir', 'subir', 'subir', 'subir', 'subir', 'plantilla']);
        expect(cuerpo).toMatchObject({ id_plantilla: 41, n_fotos: 5, indice: { estado: 'activada', version: 'v004' }, version: 'v004' });
        const args = llamada('api_mi_plantilla_registrar');
        expect(Object.keys(args).sort()).toEqual(['p_fotos', 'p_id_consent', 'p_ip', 'p_objeto_foto']);
        expect(args.p_id_consent).toBe(9);
        expect(args.p_ip).toBe('203.0.113.9');
        expect(args.p_fotos).toHaveLength(5);
        expect(args.p_objeto_foto).toBe(args.p_fotos[0].objeto_foto);
        for (const f of args.p_fotos) expect(f.objeto_foto).toMatch(/^registro\/44\/[0-9a-f-]{36}\.jpg$/);
    });

    it('no usa la RPC del administrador ni recibe id_alumno', async () => {
        await registrar();
        expect(usuario.llamadas).not.toContain('api_plantilla_registrar');
    });

    it('sin otros rostros en el índice no busca duplicados', async () => {
        await registrar();
        expect(reconocer).not.toHaveBeenCalled();
    });

    describe('con otros alumnos en el índice', () => {
        beforeEach(() => preparar({ registro: CON_CONSENTIMIENTO, adminRpcs: { svc_faiss_ids_otros_alumnos: () => ({ indice: 'v003', faiss_ids: [5, 6, 7] }) } }));

        it('busca el rostro entre los faiss_id de los DEMÁS alumnos, con un solo rostro, en 3 tomas como máximo', async () => {
            await registrar(lote(8));
            expect(reconocer).toHaveBeenCalledTimes(3);
            for (const [args] of reconocer.mock.calls) expect(args).toMatchObject({ allowedFaissIds: [5, 6, 7], maxFaces: 1 });
        });

        it('si se parece a otra persona (score >= umbral): 409 ROSTRO_YA_REGISTRADO, nada se guarda y no se revela de quién es', async () => {
            reconocer.mockImplementation(resultado(0.91));
            const res = await registrar();
            const cuerpo = await res.json();
            expect(res.status).toBe(409);
            expect(cuerpo.error.code).toBe('ROSTRO_YA_REGISTRADO');
            expect(JSON.stringify(cuerpo)).not.toMatch(/faiss|score|0\.91|matr/i);
            expect(admin.bucket.upload).not.toHaveBeenCalled();
            expect(usuario.llamadas).not.toContain('api_mi_plantilla_registrar');
        });

        it('justo en el umbral cuenta como el mismo rostro; por debajo, no', async () => {
            reconocer.mockImplementation(resultado(0.85));
            expect((await registrar()).status).toBe(409);
            reconocer.mockImplementation(resultado(0.849));
            expect((await registrar()).status).toBe(201);
        });

        it('usa el umbral del sistema, no uno fijo', async () => {
            preparar({
                registro: CON_CONSENTIMIENTO,
                usuarioRpcs: { api_parametros_publicos: () => ({ umbral_similitud: 0.7 }) },
                adminRpcs: { svc_faiss_ids_otros_alumnos: () => ({ indice: 'v003', faiss_ids: [5] }) },
            });
            reconocer.mockImplementation(resultado(0.75));
            expect((await registrar()).status).toBe(409);
        });

        it('un rostro distinto pasa: se registra', async () => {
            reconocer.mockImplementation(resultado(0.31));
            expect((await registrar()).status).toBe(201);
        });

        it('si el servicio de reconocimiento falla al buscar, no se guarda nada (falla cerrado)', async () => {
            reconocer.mockRejectedValue(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'x', status: 503 }));
            const res = await registrar();
            expect(res.status).toBe(503);
            expect(admin.bucket.upload).not.toHaveBeenCalled();
            expect(usuario.llamadas).not.toContain('api_mi_plantilla_registrar');
        });
    });

    it('sin consentimiento vigente: 409 y no se procesa ni se guarda el rostro (RN-13)', async () => {
        preparar({ registro: SIN_CONSENTIMIENTO });
        const res = await registrar();
        expect(res.status).toBe(409);
        expect((await res.json()).error.code).toBe('RN_13_CONSENTIMIENTO_NO_VIGENTE');
        expect(verificarFotosServicio).not.toHaveBeenCalled();
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('con el cupo diario agotado: 429 y sin gastar el servicio de reconocimiento', async () => {
        preparar({ registro: { ...CON_CONSENTIMIENTO, registros_24h: 5 } });
        const res = await registrar();
        expect(res.status).toBe(429);
        expect((await res.json()).error.code).toBe('AUTOREGISTRO_LIMITE');
        expect(verificarFotosServicio).not.toHaveBeenCalled();
    });

    it('menos tomas que el mínimo del servicio: 422 FOTOS_INSUFICIENTES y nada guardado', async () => {
        const res = await registrar(lote(2));
        expect(res.status).toBe(422);
        expect((await res.json()).error.code).toBe('FOTOS_INSUFICIENTES');
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('una toma rechazada por calidad: 422 FOTOS_RECHAZADAS y nada guardado', async () => {
        verificarFotosServicio.mockImplementation(async (blobs) => {
            const c = conjunto(blobs.length);
            c.fotos[1] = { ...c.fotos[1], estado: 'calidad', motivo_codigo: 'ROSTRO_PEQUENO', motivo_rechazo: 'El rostro es muy pequeño.' };
            return { ...c, aceptadas: blobs.length - 1 };
        });
        const res = await registrar();
        expect(res.status).toBe(422);
        expect((await res.json()).error.code).toBe('FOTOS_RECHAZADAS');
        expect(admin.bucket.upload).not.toHaveBeenCalled();
    });

    it('si registrar la plantilla falla se BORRAN todas las fotos subidas', async () => {
        preparar({ registro: CON_CONSENTIMIENTO, usuarioRpcs: { api_mi_plantilla_registrar: () => errorDeNegocio('RN_13_CONSENTIMIENTO_NO_VIGENTE', 'Ya no vigente.') } });
        const res = await registrar();
        expect(res.status).toBe(409);
        const subidas = admin.bucket.upload.mock.calls.map(([ruta]) => ruta);
        expect(subidas).toHaveLength(5);
        expect(admin.bucket.remove).toHaveBeenCalledTimes(5);
        for (const ruta of subidas) expect(admin.bucket.remove).toHaveBeenCalledWith([ruta]);
    });

    it('si la reconstrucción del índice falla, la plantilla igual queda registrada (201) como pendiente', async () => {
        construirIndice.mockRejectedValue(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'x', status: 503 }));
        const res = await registrar();
        expect(res.status).toBe(201);
        expect((await res.json()).indice).toMatchObject({ estado: 'pendiente' });
    });

    it('solo JPEG por firma binaria y solo el alumno', async () => {
        const falsa = jpg(new TextEncoder().encode('no es un jpeg'));
        expect((await registrar([falsa, ...lote(2)])).status).toBe(422);
        expect(verificarFotosServicio).not.toHaveBeenCalled();
        preparar({ registro: CON_CONSENTIMIENTO, me: YO.admin });
        expect((await registrar()).status).toBe(403);
    });

    it('fotos repetidas: 422 FOTOS_DUPLICADAS', async () => {
        const res = await registrar([jpg(BYTES_JPEG, 'a.jpg'), jpg(BYTES_JPEG, 'b.jpg'), ...lote(3)]);
        expect(res.status).toBe(422);
        expect((await res.json()).error.code).toBe('FOTOS_DUPLICADAS');
    });
});
