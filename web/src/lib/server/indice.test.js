import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));
vi.mock('./recognition.js', () => ({
    construirIndice: vi.fn(),
    activarIndice: vi.fn(),
    infoIndice: vi.fn(),
    manifiestoIndice: vi.fn(),
}));

import { ApiError } from '@/lib/api/errors';
import { activarIndice, construirIndice, infoIndice, manifiestoIndice } from './recognition.js';
import { entradasDeBuild, estadoIndice, reconstruirIndice, revertirIndice, sincronizarIndice } from './indice.js';
import { crearBackend, errorDeNegocio } from './testing.js';

const PLAN = {
    dimension: 512,
    version_sugerida: 'v004',
    base: { id_indice: 3, version: 'v003', objeto_indice: 'indice/v003.json', total_vectores: 1 },
    motivo_sin_base: null,
    totales: { activas: 2, nuevas: 1, en_base: 1, obsoletas: 0 },
    nada_que_hacer: false,
    entries: [
        { id_plantilla: 12, id_alumno: 3, faiss_id: 1001, id_indice: 3, en_base: true, objeto_foto: 'registro/3/a.jpg' },
        { id_plantilla: 41, id_alumno: 17, faiss_id: 1043, id_indice: null, en_base: false, objeto_foto: 'registro/17/b.jpg' },
    ],
};
const MAPEO = [{ id_plantilla: 12, faiss_id: 1001 }, { id_plantilla: 41, faiss_id: 1043 }];
const BUILD_OK = { version: 'v004', objeto_indice: 'indice/v004.json', dimension: 512, ntotal: 2, mapeo: MAPEO, errores: [] };

/** Backend admin con la secuencia feliz; `anular` reemplaza RPC concretas. */
function admin(anular = {}) {
    return crearBackend({
        rpcs: {
            svc_bloqueo_adquirir: () => true,
            svc_bloqueo_liberar: () => true,
            svc_indice_plan: () => PLAN,
            svc_indice_registrar: () => ({ id_indice: 4, version: 'v004', ya_registrada: false }),
            svc_indice_activar: () => ({ id_indice: 4, version: 'v004', anterior: { id_indice: 3, version: 'v003' }, plantillas_asignadas: 2, plantillas_pendientes: 0, ya_activo: false }),
            svc_indice_en_uso: () => ({ id_indice: 4, version: 'v004' }),
            svc_fotos_registro_listar: () => ({ pendientes_total: 0, items: [] }),
            svc_fotos_registro_marcar: ({ p_ids }) => ({ solicitadas: p_ids.length, marcadas: p_ids.length }),
            svc_indice_revertir: () => ({ id_indice: 3, version: 'v003', anterior: { id_indice: 4, version: 'v004' }, plantillas_asignadas: 1, plantillas_pendientes: 1, ya_activo: false }),
            ...anular,
        },
    });
}

beforeEach(() => {
    construirIndice.mockResolvedValue(BUILD_OK);
    activarIndice.mockResolvedValue({ version: 'v004', ntotal: 2, dimension: 512, active: true, preloaded: false });
    manifiestoIndice.mockResolvedValue({ version: 'v003', ntotal: 1, dimension: 512, refs: [{ id_plantilla: 12, faiss_id: 1001 }] });
    infoIndice.mockResolvedValue({ version: 'v004', ntotal: 2, dimension: 512, model: 'fake', loaded_at: 't' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('entradasDeBuild', () => {
    const plan = (entries) => ({ entries });

    it('en_base da keep; objetos_foto de más de una ruta da objetos_foto; una foto o sin la clave da objeto_foto como hoy', () => {
        const entradas = entradasDeBuild(plan([
            { id_plantilla: 1, faiss_id: 10, en_base: true, objeto_foto: 'registro/1/a.jpg', objetos_foto: null },
            { id_plantilla: 2, faiss_id: 11, en_base: false, objeto_foto: 'registro/2/a.jpg', objetos_foto: ['registro/2/a.jpg', 'registro/2/b.jpg', 'registro/2/c.jpg'] },
            { id_plantilla: 3, faiss_id: 12, en_base: false, objeto_foto: 'registro/3/a.jpg', objetos_foto: ['registro/3/a.jpg'] },
            { id_plantilla: 4, faiss_id: 13, en_base: false, objeto_foto: 'registro/4/a.jpg' },
            { id_plantilla: 5, faiss_id: 14, en_base: false, objeto_foto: 'registro/5/a.jpg', objetos_foto: null },
        ]));
        expect(entradas).toEqual([
            { id_plantilla: 1, faiss_id: 10, keep: true },
            { id_plantilla: 2, faiss_id: 11, objetos_foto: ['registro/2/a.jpg', 'registro/2/b.jpg', 'registro/2/c.jpg'] },
            { id_plantilla: 3, faiss_id: 12, objeto_foto: 'registro/3/a.jpg' },
            { id_plantilla: 4, faiss_id: 13, objeto_foto: 'registro/4/a.jpg' },
            { id_plantilla: 5, faiss_id: 14, objeto_foto: 'registro/5/a.jpg' },
        ]);
        // Una entrada nunca mezcla formas (el servicio rechaza mezclar keep / objeto_foto / objetos_foto con 422).
        for (const e of entradas) expect(['keep', 'objeto_foto', 'objetos_foto'].filter((k) => k in e)).toHaveLength(1);
    });

    it('reconstruirIndice manda la forma multifoto al servicio y propaga las muestras', async () => {
        const muestras = [{ id_plantilla: 41, total: 3, usadas: 3, descartadas: [], coseno_min: 0.5, coseno_medio: 0.7, degradada: false }];
        construirIndice.mockResolvedValue({ ...BUILD_OK, muestras });
        const plan = {
            ...PLAN,
            entries: [
                PLAN.entries[0],
                { ...PLAN.entries[1], objetos_foto: ['registro/17/b.jpg', 'registro/17/c.jpg', 'registro/17/d.jpg'] },
            ],
        };
        const r = await reconstruirIndice({ admin: admin({ svc_indice_plan: () => plan }) });
        expect(construirIndice.mock.calls[0][0].entries[1]).toEqual({
            id_plantilla: 41, faiss_id: 1043, objetos_foto: ['registro/17/b.jpg', 'registro/17/c.jpg', 'registro/17/d.jpg'],
        });
        expect(r.muestras).toEqual(muestras);
    });

    it('SIN_MUESTRAS_UTILIZABLES: el build con errores es INDICE_CONSTRUCCION_FALLIDA con el código en details.errores', async () => {
        construirIndice.mockResolvedValue({
            ...BUILD_OK, objeto_indice: null, mapeo: [],
            errores: [{ id_plantilla: 41, motivo: 'Ninguna de las 3 fotos es utilizable.', codigo: 'SIN_MUESTRAS_UTILIZABLES' }],
        });
        const e = await reconstruirIndice({ admin: admin() }).catch((x) => x);
        expect(e).toMatchObject({ code: 'INDICE_CONSTRUCCION_FALLIDA', status: 422 });
        expect(e.details.errores).toEqual([{ id_plantilla: 41, motivo: 'Ninguna de las 3 fotos es utilizable.', codigo: 'SIN_MUESTRAS_UTILIZABLES' }]);
    });
});

describe('reconstruirIndice', () => {
    it('orquesta en orden: bloqueo -> plan -> build -> registrar -> precarga -> activar BD -> activar servicio -> purgar fotos -> liberar', async () => {
        const orden = [];
        const a = admin();
        const original = a.rpc.getMockImplementation();
        a.rpc.mockImplementation(async (n, args) => { orden.push(n); return original(n, args); });
        construirIndice.mockImplementation(async () => { orden.push('/build'); return BUILD_OK; });
        activarIndice.mockImplementation(async ({ preloadOnly }) => { orden.push(preloadOnly ? '/activate(preload)' : '/activate'); return {}; });

        const r = await reconstruirIndice({ admin: a });

        expect(orden).toEqual([
            'svc_bloqueo_adquirir', 'svc_indice_plan', '/build', 'svc_indice_registrar', '/activate(preload)',
            'svc_indice_activar', '/activate', 'svc_fotos_registro_listar', 'svc_bloqueo_liberar',
        ]);
        expect(r).toMatchObject({ estado: 'activada', version: 'v004', id_indice: 4, total_vectores: 2, plantillas_asignadas: 2 });
    });

    it('arma entries: keep para las de la base y objeto_foto para las nuevas; base_version del plan', async () => {
        await reconstruirIndice({ admin: admin() });
        expect(construirIndice).toHaveBeenCalledWith({
            version: 'v004',
            baseVersion: 'v003',
            entries: [
                { id_plantilla: 12, faiss_id: 1001, keep: true },
                { id_plantilla: 41, faiss_id: 1043, objeto_foto: 'registro/17/b.jpg' },
            ],
        });
    });

    it('pasa el mapeo del build (refs) a svc_indice_activar y el id registrado', async () => {
        const a = admin();
        await reconstruirIndice({ admin: a });
        const llamada = a.rpc.mock.calls.find(([n]) => n === 'svc_indice_activar');
        expect(llamada[1]).toEqual({ p_id_indice: 4, p_mapeo: MAPEO });
    });

    it('errores[] del servicio ABORTA: no registra, no precarga, no activa, y libera el bloqueo', async () => {
        construirIndice.mockResolvedValue({ ...BUILD_OK, objeto_indice: null, ntotal: 0, mapeo: [], errores: [{ id_plantilla: 41, motivo: 'No se detecto ningun rostro.' }] });
        const a = admin();
        const e = await reconstruirIndice({ admin: a }).catch((x) => x);
        expect(e).toBeInstanceOf(ApiError);
        expect(e).toMatchObject({ code: 'INDICE_CONSTRUCCION_FALLIDA', status: 422 });
        expect(e.details.errores).toEqual([{ id_plantilla: 41, motivo: 'No se detecto ningun rostro.' }]);
        expect(a.llamadas).not.toContain('svc_indice_registrar');
        expect(a.llamadas).not.toContain('svc_indice_activar');
        expect(activarIndice).not.toHaveBeenCalled();
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('si el build lanza (servicio caído) no hay efectos en BD y el bloqueo se libera', async () => {
        construirIndice.mockRejectedValue(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'x', status: 503 }));
        const a = admin();
        const e = await reconstruirIndice({ admin: a }).catch((x) => x);
        expect(e).toMatchObject({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', details: { fase: 'construccion', version: 'v004' } });
        expect(a.llamadas).toEqual(['svc_bloqueo_adquirir', 'svc_indice_plan', 'svc_bloqueo_liberar']);
    });

    it('si falla la precarga NO activa en BD (la BD no cambia de versión) y libera el bloqueo', async () => {
        activarIndice.mockRejectedValueOnce(new ApiError({ code: 'INDICE_INVALIDO', message: 'x', status: 422 }));
        const a = admin();
        const e = await reconstruirIndice({ admin: a }).catch((x) => x);
        expect(e.details.fase).toBe('precarga');
        expect(a.llamadas).not.toContain('svc_indice_activar');
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('si falla svc_indice_activar (plan obsoleto) no cambia el puntero del servicio y reporta la fase', async () => {
        const a = admin({ svc_indice_activar: () => errorDeNegocio('INDICE_PLAN_OBSOLETO', 'El plan cambió.') });
        const e = await reconstruirIndice({ admin: a }).catch((x) => x);
        expect(e).toMatchObject({ code: 'INDICE_PLAN_OBSOLETO', details: { fase: 'activacion_bd' } });
        expect(activarIndice).toHaveBeenCalledTimes(1); // solo la precarga
        expect(activarIndice.mock.calls[0][0].preloadOnly).toBe(true);
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('si falla el cambio final del servicio avisa que la BD ya quedó activada (sincronizar)', async () => {
        activarIndice.mockResolvedValueOnce({}).mockRejectedValueOnce(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'x', status: 503 }));
        const a = admin();
        const e = await reconstruirIndice({ admin: a }).catch((x) => x);
        expect(e.details).toMatchObject({ fase: 'activacion_servicio', bd_activada: true, sincronizado: false });
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('si otro proceso tiene el bloqueo: 409 RECONSTRUCCION_EN_CURSO, sin plan ni liberar un bloqueo ajeno', async () => {
        const a = admin({ svc_bloqueo_adquirir: () => false });
        await expect(reconstruirIndice({ admin: a })).rejects.toMatchObject({ code: 'RECONSTRUCCION_EN_CURSO', status: 409 });
        expect(a.llamadas).toEqual(['svc_bloqueo_adquirir']);
    });

    it('nada_que_hacer -> sin_cambios, sin llamar al servicio, y libera el bloqueo', async () => {
        const a = admin({ svc_indice_plan: () => ({ ...PLAN, nada_que_hacer: true }) });
        const r = await reconstruirIndice({ admin: a });
        expect(r).toMatchObject({ estado: 'sin_cambios', version: 'v003' });
        expect(construirIndice).not.toHaveBeenCalled();
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('un fallo al liberar el bloqueo no oculta el resultado', async () => {
        const a = admin({ svc_bloqueo_liberar: () => errorDeNegocio('VALIDACION', 'x') });
        await expect(reconstruirIndice({ admin: a })).resolves.toMatchObject({ estado: 'activada' });
    });

    it('reintento seguro: tras un fallo, la siguiente corrida vuelve a intentar completa', async () => {
        activarIndice.mockRejectedValueOnce(new ApiError({ code: 'X', message: 'x', status: 500 }));
        const a = admin();
        await reconstruirIndice({ admin: a }).catch(() => {});
        await expect(reconstruirIndice({ admin: a })).resolves.toMatchObject({ estado: 'activada' });
        expect(a.llamadas.filter((n) => n === 'svc_bloqueo_liberar')).toHaveLength(2);
    });

    it('completa: true se lo pide al plan', async () => {
        const a = admin();
        await reconstruirIndice({ completa: true, admin: a });
        expect(a.rpc.mock.calls.find(([n]) => n === 'svc_indice_plan')[1]).toEqual({ p_completa: true });
    });
});

describe('estado, sincronizar y revertir', () => {
    it('estadoIndice combina BD y servicio y marca sincronizado', async () => {
        const backend = crearBackend({ rpcs: { api_indice_estado: () => ({ en_uso: { id_indice: 4, version: 'v004' }, plantillas: {} }) } });
        const ok = await estadoIndice({ backend });
        expect(ok).toMatchObject({ sincronizado: true, servicio: { disponible: true, version: 'v004' } });
        infoIndice.mockResolvedValueOnce({ version: 'v003', ntotal: 1, dimension: 512 });
        expect((await estadoIndice({ backend })).sincronizado).toBe(false);
        infoIndice.mockRejectedValueOnce(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'x', status: 503 }));
        const caido = await estadoIndice({ backend });
        expect(caido.servicio).toEqual({ disponible: false, motivo: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE' });
        expect(caido.sincronizado).toBeNull();
    });

    it('sincronizarIndice activa en el servicio la versión en uso de la BD; sin versión -> 409', async () => {
        const r = await sincronizarIndice({ admin: admin() });
        expect(activarIndice).toHaveBeenCalledWith({ version: 'v004' });
        expect(r.estado).toBe('sincronizada');
        await expect(sincronizarIndice({ admin: admin({ svc_indice_en_uso: () => null }) })).rejects.toMatchObject({ code: 'SIN_INDICE_EN_USO', status: 409 });
    });

    it('revertirIndice usa los refs del manifiesto como mapeo y bloquea', async () => {
        const a = admin();
        const r = await revertirIndice({ idIndice: 3, version: 'v003', admin: a });
        const llamada = a.rpc.mock.calls.find(([n]) => n === 'svc_indice_revertir');
        expect(llamada[1]).toEqual({ p_id_indice: 3, p_mapeo: [{ id_plantilla: 12, faiss_id: 1001 }] });
        expect(r).toMatchObject({ estado: 'revertida', version: 'v003', plantillas_pendientes: 1 });
        expect(a.llamadas[0]).toBe('svc_bloqueo_adquirir');
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
        expect(activarIndice.mock.calls.map(([x]) => x.preloadOnly ?? false)).toEqual([true, false]);
    });
});

// ---- Fotos de registro efímeras (extensión 18) ----
const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const RUTA_NUEVA = `registro/17/${UUID(1)}.jpg`;
const planConFoto = (extra = {}) => ({
    ...PLAN,
    entries: [
        { id_plantilla: 12, id_alumno: 3, faiss_id: 1001, id_indice: 3, en_base: true, objeto_foto: null, objetos_foto: null },
        { id_plantilla: 41, id_alumno: 17, faiss_id: 1043, id_indice: null, en_base: false, objeto_foto: RUTA_NUEVA, objetos_foto: [RUTA_NUEVA] },
    ],
    ...extra,
});

describe('reconstruirIndice: borra las fotos que acaba de convertir en vector', () => {
    it('tras activar, purga SOLO las plantillas nuevas de este build y reporta cuántos objetos borró', async () => {
        const a = admin({
            svc_indice_plan: () => planConFoto(),
            svc_fotos_registro_listar: vi.fn()
                .mockReturnValueOnce({ pendientes_total: 1, items: [{ id_plantilla: 41, objetos: [RUTA_NUEVA] }] })
                .mockReturnValue({ pendientes_total: 0, items: [] }),
        });
        const r = await reconstruirIndice({ admin: a });
        const listar = a.rpc.mock.calls.find(([n]) => n === 'svc_fotos_registro_listar');
        expect(listar[1]).toMatchObject({ p_ids: [41] }); // la 12 (en_base, ya indexada antes) no se vuelve a tocar
        expect(a.bucket.remove).toHaveBeenCalledWith([RUTA_NUEVA]);
        expect(a.rpc.mock.calls.find(([n]) => n === 'svc_fotos_registro_marcar')[1]).toEqual({ p_ids: [41] });
        expect(r).toMatchObject({ estado: 'activada', fotos_purgadas: 1 });
    });

    it('la purga ocurre DESPUÉS de activar en el servicio, nunca antes (la foto es la única copia hasta ese punto)', async () => {
        const orden = [];
        const a = admin({ svc_indice_plan: () => planConFoto() });
        const original = a.rpc.getMockImplementation();
        a.rpc.mockImplementation(async (n, args) => { orden.push(n); return original(n, args); });
        activarIndice.mockImplementation(async ({ preloadOnly }) => { orden.push(preloadOnly ? '/activate(preload)' : '/activate'); return {}; });
        await reconstruirIndice({ admin: a });
        expect(orden.indexOf('svc_fotos_registro_listar')).toBeGreaterThan(orden.indexOf('/activate'));
        expect(orden.indexOf('svc_fotos_registro_listar')).toBeGreaterThan(orden.indexOf('svc_indice_activar'));
    });

    it('si el build falla NO se borra ninguna foto (se necesitarán para reintentar)', async () => {
        const a = admin({ svc_indice_plan: () => planConFoto() });
        construirIndice.mockResolvedValue({ ...BUILD_OK, objeto_indice: null, errores: [{ id_plantilla: 41, motivo: 'x' }] });
        await expect(reconstruirIndice({ admin: a })).rejects.toMatchObject({ code: 'INDICE_CONSTRUCCION_FALLIDA' });
        expect(a.llamadas).not.toContain('svc_fotos_registro_listar');
        expect(a.bucket.remove).not.toHaveBeenCalled();
    });

    it('si falla la activación en la BD NO se borra ninguna foto', async () => {
        const a = admin({
            svc_indice_plan: () => planConFoto(),
            svc_indice_activar: () => errorDeNegocio('INDICE_PLAN_OBSOLETO', 'El plan cambió.'),
        });
        await expect(reconstruirIndice({ admin: a })).rejects.toMatchObject({ code: 'INDICE_PLAN_OBSOLETO' });
        expect(a.llamadas).not.toContain('svc_fotos_registro_listar');
        expect(a.bucket.remove).not.toHaveBeenCalled();
    });

    it('si falla el cambio final del servicio NO se borra ninguna foto (la reconstrucción se reintenta)', async () => {
        const a = admin({ svc_indice_plan: () => planConFoto() });
        activarIndice.mockResolvedValueOnce({}).mockRejectedValueOnce(new ApiError({ code: 'SERVICIO_NO_DISPONIBLE', message: 'x', status: 503 }));
        await expect(reconstruirIndice({ admin: a })).rejects.toMatchObject({ details: { fase: 'activacion_servicio' } });
        expect(a.llamadas).not.toContain('svc_fotos_registro_listar');
    });

    it('un fallo al borrar NO invalida la activación: queda activada y el job purgar-fotos-registro lo reintenta', async () => {
        const a = admin({
            svc_indice_plan: () => planConFoto(),
            svc_fotos_registro_listar: () => ({ pendientes_total: 1, items: [{ id_plantilla: 41, objetos: [RUTA_NUEVA] }] }),
        });
        a.bucket.remove.mockResolvedValue({ error: { message: 'storage caído' } });
        const r = await reconstruirIndice({ admin: a });
        expect(r).toMatchObject({ estado: 'activada', version: 'v004', fotos_purgadas: null });
        expect(a.llamadas).not.toContain('svc_fotos_registro_marcar'); // la ruta sigue en BD para el reintento
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('sin plantillas nuevas (todas en_base) no consulta ni borra nada', async () => {
        const plan = {
            ...PLAN,
            totales: { activas: 1, nuevas: 0, en_base: 1, obsoletas: 1 },
            entries: [{ id_plantilla: 12, id_alumno: 3, faiss_id: 1001, id_indice: 3, en_base: true, objeto_foto: null, objetos_foto: null }],
        };
        const a = admin({ svc_indice_plan: () => plan });
        construirIndice.mockResolvedValue({ ...BUILD_OK, ntotal: 1, mapeo: [{ id_plantilla: 12, faiss_id: 1001 }] });
        const r = await reconstruirIndice({ admin: a });
        expect(r.estado).toBe('activada');
        expect(a.llamadas).not.toContain('svc_fotos_registro_listar');
    });
});

describe('reconstruirIndice: plantillas que ya no conservan su foto', () => {
    it('PLANTILLAS_SIN_FOTO: una reconstrucción completa sobre plantillas ya purgadas se rechaza ANTES de llamar al servicio', async () => {
        const plan = {
            ...PLAN,
            base: null,
            motivo_sin_base: 'completa',
            entries: [
                { id_plantilla: 12, id_alumno: 3, faiss_id: 1, id_indice: 3, en_base: false, objeto_foto: null, objetos_foto: [null] },
                { id_plantilla: 41, id_alumno: 17, faiss_id: 2, id_indice: 3, en_base: false, objeto_foto: null, objetos_foto: [null, null, null] },
            ],
        };
        const a = admin({ svc_indice_plan: () => plan });
        const e = await reconstruirIndice({ completa: true, admin: a }).catch((x) => x);
        expect(e).toBeInstanceOf(ApiError);
        expect(e).toMatchObject({ code: 'PLANTILLAS_SIN_FOTO', status: 409 });
        expect(e.message).toContain('2 plantillas');
        expect(e.details).toMatchObject({
            fase: 'plan',
            motivo_sin_base: 'completa',
            plantillas: [{ id_plantilla: 12, id_alumno: 3 }, { id_plantilla: 41, id_alumno: 17 }],
        });
        expect(construirIndice).not.toHaveBeenCalled();
        expect(a.llamadas).not.toContain('svc_indice_registrar');
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('con UNA sola plantilla sin foto el mensaje va en singular', async () => {
        const plan = { ...PLAN, entries: [{ id_plantilla: 41, id_alumno: 17, faiss_id: 2, id_indice: null, en_base: false, objeto_foto: null, objetos_foto: [null] }] };
        const e = await reconstruirIndice({ admin: admin({ svc_indice_plan: () => plan }) }).catch((x) => x);
        expect(e.message).toContain('1 plantilla ya no conserva');
    });

    it('las plantillas en_base sin foto NO bloquean: se conservan con keep (su vector ya está en el JSON)', async () => {
        const a = admin({ svc_indice_plan: () => planConFoto() });
        await reconstruirIndice({ admin: a });
        expect(construirIndice).toHaveBeenCalledWith(expect.objectContaining({
            entries: [{ id_plantilla: 12, faiss_id: 1001, keep: true }, { id_plantilla: 41, faiss_id: 1043, objeto_foto: RUTA_NUEVA }],
        }));
    });
});

describe('revertirIndice: no deja plantillas sin vector', () => {
    const planRevertir = (entries) => ({ ...PLAN, entries });

    it('REVERSION_PERDERIA_PLANTILLAS: la versión destino no conoce una plantilla cuya foto ya se borró', async () => {
        const a = admin({
            svc_indice_plan: () => planRevertir([
                { id_plantilla: 12, id_alumno: 3, faiss_id: 1001, id_indice: 4, en_base: true, objeto_foto: null, objetos_foto: null },
                { id_plantilla: 41, id_alumno: 17, faiss_id: 1043, id_indice: 4, en_base: true, objeto_foto: null, objetos_foto: null },
            ]),
        });
        // El manifiesto de v003 solo conoce la plantilla 12: la 41 se indexó después y su foto ya no existe.
        const e = await revertirIndice({ idIndice: 3, version: 'v003', admin: a }).catch((x) => x);
        expect(e).toBeInstanceOf(ApiError);
        expect(e).toMatchObject({ code: 'REVERSION_PERDERIA_PLANTILLAS', status: 409 });
        expect(e.details).toMatchObject({ fase: 'verificacion', version: 'v003', plantillas: [{ id_plantilla: 41, id_alumno: 17 }] });
        expect(a.llamadas).not.toContain('svc_indice_revertir');
        expect(activarIndice).not.toHaveBeenCalled(); // ni siquiera se precarga
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('si la plantilla que la versión destino no conoce AÚN conserva su foto, revertir es seguro (se reindexará)', async () => {
        const a = admin({
            svc_indice_plan: () => planRevertir([
                { id_plantilla: 12, id_alumno: 3, faiss_id: 1001, id_indice: 4, en_base: true, objeto_foto: null, objetos_foto: null },
                { id_plantilla: 41, id_alumno: 17, faiss_id: 1043, id_indice: null, en_base: false, objeto_foto: RUTA_NUEVA, objetos_foto: [RUTA_NUEVA] },
            ]),
        });
        const r = await revertirIndice({ idIndice: 3, version: 'v003', admin: a });
        expect(r.estado).toBe('revertida');
    });

    it('si todas las plantillas están en el manifiesto de la versión destino, revertir no se bloquea aunque no tengan foto', async () => {
        const a = admin({
            svc_indice_plan: () => planRevertir([{ id_plantilla: 12, id_alumno: 3, faiss_id: 1001, id_indice: 4, en_base: true, objeto_foto: null, objetos_foto: null }]),
        });
        expect((await revertirIndice({ idIndice: 3, version: 'v003', admin: a })).estado).toBe('revertida');
    });
});
