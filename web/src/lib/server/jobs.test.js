import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));
vi.mock('./indice.js', () => ({ reconstruirIndice: vi.fn(), CLAVE_BLOQUEO_INDICE: 'indice' }));

import { getAdminBackend, getServerBackend } from '@/lib/backend';
import { ApiError } from '@/lib/api/errors';
import { compararSecreto } from './auth.js';
import { ejecutarJob, handleJob, NOMBRES_JOB } from './jobs.js';
import { reconstruirIndice } from './indice.js';
import { crearBackend, pedir } from './testing.js';

const SECRETO = 'secreto-de-cron-0123456789';
const conBearer = (token, method = 'POST') => pedir('/api/jobs/x', { method, headers: token === null ? {} : { authorization: `Bearer ${token}` } });
let admin;

beforeEach(() => {
    vi.stubEnv('CRON_SECRET', SECRETO);
    admin = crearBackend({
        rpcs: {
            svc_bloqueo_adquirir: () => true,
            svc_bloqueo_liberar: () => true,
            svc_job_cerrar_sesiones: () => ({ candidatas: 3, cerradas: 2, items: [], errores: [] }),
            svc_job_resolver_pendientes: () => ({ candidatas: 5, resueltas: 5, errores: [] }),
            svc_job_recalcular: () => ({ periodo: '2026-2', grupos: 18, recalculados: 18, errores: [] }),
            svc_job_reconstruir_indice: () => ({ requiere: false, motivo: 'ninguno' }),
        },
    });
    getAdminBackend.mockResolvedValue(admin);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe('autorización de jobs (Bearer CRON_SECRET)', () => {
    it.each(NOMBRES_JOB)('%s: sin Bearer responde 401 y no ejecuta nada', async (nombre) => {
        const res = await handleJob(nombre)(conBearer(null));
        expect(res.status).toBe(401);
        expect((await res.json()).error.code).toBe('NO_AUTENTICADO');
        expect(admin.rpc).not.toHaveBeenCalled();
    });

    it('con Bearer incorrecto (incluida otra longitud) responde 401 sin lanzar RangeError', async () => {
        for (const mal of ['x', `${SECRETO}x`, SECRETO.toUpperCase(), '', 'a'.repeat(500)]) {
            expect((await handleJob('cerrar-sesiones')(conBearer(mal))).status, mal).toBe(401);
        }
        expect(admin.rpc).not.toHaveBeenCalled();
    });

    it('un esquema distinto de Bearer no autoriza', async () => {
        const req = pedir('/api/jobs/x', { headers: { authorization: `Basic ${SECRETO}` } });
        expect((await handleJob('cerrar-sesiones')(req)).status).toBe(401);
    });

    it('sin CRON_SECRET configurado nunca se acepta (503), ni siquiera con Bearer vacío', async () => {
        vi.stubEnv('CRON_SECRET', '');
        const a = await handleJob('cerrar-sesiones')(conBearer(''));
        expect(a.status).toBe(503);
        expect((await a.json()).error.code).toBe('CONFIGURACION_FALTANTE');
        expect((await handleJob('cerrar-sesiones')(conBearer('lo-que-sea'))).status).toBe(503);
        expect(admin.rpc).not.toHaveBeenCalled();
    });

    it('con el secreto correcto ejecuta, no consulta cookies y acepta POST y GET', async () => {
        const post = await handleJob('cerrar-sesiones')(conBearer(SECRETO));
        expect(post.status).toBe(200);
        expect(await post.json()).toMatchObject({ job: 'cerrar-sesiones', cerradas: 2 });
        expect((await handleJob('resolver-pendientes')(conBearer(SECRETO, 'GET'))).status).toBe(200);
        expect(getServerBackend).not.toHaveBeenCalled();
    });

    it('compararSecreto es de tiempo constante: compara resúmenes de igual longitud', () => {
        expect(compararSecreto(SECRETO, SECRETO)).toBe(true);
        expect(compararSecreto(SECRETO, `${SECRETO}!`)).toBe(false);
        expect(compararSecreto('', SECRETO)).toBe(false);
        expect(compararSecreto(undefined, SECRETO)).toBe(false);
        expect(() => compararSecreto('a', 'bbbbbbbbbbbbbbbbbbbbbbbb')).not.toThrow();
    });
});

describe('ejecutores', () => {
    it('recalcular recibe el periodo y toma el bloqueo job:recalcular', async () => {
        const r = await handleJob('recalcular')(pedir('/api/jobs/recalcular', { json: { periodo: '2026-2' }, headers: { authorization: `Bearer ${SECRETO}` } }));
        expect(r.status).toBe(200);
        expect(admin.rpc.mock.calls.find(([n]) => n === 'svc_job_recalcular')[1]).toEqual({ p_periodo: '2026-2' });
        expect(admin.rpc.mock.calls[0]).toEqual(['svc_bloqueo_adquirir', expect.objectContaining({ p_clave: 'job:recalcular' })]);
        const malo = await handleJob('recalcular')(pedir('/api/jobs/recalcular', { json: { periodo: 'x' }, headers: { authorization: `Bearer ${SECRETO}` } }));
        expect(malo.status).toBe(422);
    });

    it('un job con bloqueo ocupado responde omitido sin ejecutar', async () => {
        admin = crearBackend({ rpcs: { svc_bloqueo_adquirir: () => false, svc_job_recalcular: vi.fn() } });
        getAdminBackend.mockResolvedValue(admin);
        const r = await ejecutarJob('recalcular', { admin });
        expect(r).toMatchObject({ estado: 'omitido', motivo: 'en_ejecucion' });
        expect(admin.llamadas).toEqual(['svc_bloqueo_adquirir']);
    });

    it('reconstruir-indice: sin necesidad no reconstruye; con necesidad delega; en curso se omite', async () => {
        expect(await ejecutarJob('reconstruir-indice', { admin })).toMatchObject({ estado: 'sin_cambios' });
        expect(reconstruirIndice).not.toHaveBeenCalled();

        admin = crearBackend({ rpcs: { svc_job_reconstruir_indice: () => ({ requiere: true, motivo: 'pendientes' }) } });
        reconstruirIndice.mockResolvedValueOnce({ estado: 'activada', version: 'v004' });
        expect(await ejecutarJob('reconstruir-indice', { admin })).toMatchObject({ estado: 'activada', diagnostico: { motivo: 'pendientes' } });
        reconstruirIndice.mockRejectedValueOnce(new ApiError({ code: 'RECONSTRUCCION_EN_CURSO', message: 'x', status: 409 }));
        expect(await ejecutarJob('reconstruir-indice', { admin })).toMatchObject({ estado: 'omitido', motivo: 'en_curso' });
        reconstruirIndice.mockRejectedValueOnce(new ApiError({ code: 'INDICE_CONSTRUCCION_FALLIDA', message: 'x', status: 422 }));
        await expect(ejecutarJob('reconstruir-indice', { admin })).rejects.toMatchObject({ code: 'INDICE_CONSTRUCCION_FALLIDA' });
    });

    it('un job desconocido es 404', async () => {
        await expect(ejecutarJob('borrar-todo', { admin })).rejects.toMatchObject({ status: 404 });
    });
});

describe('purgar-recortes (3 pasos en orden)', () => {
    const items = [
        { id_deteccion: 1, objeto_recorte: 'recortes/88/1204/1.jpg' },
        { id_deteccion: 2, objeto_recorte: 'recortes/88/3-1789000000000/2.jpg' },
    ];
    function purga(extra = {}) {
        const eventos = [];
        const a = crearBackend({
            rpcs: {
                svc_bloqueo_adquirir: () => true,
                svc_bloqueo_liberar: () => true,
                svc_job_purgar_recortes_listar: () => {
                    eventos.push('listar');
                    return eventos.filter((e) => e === 'listar').length === 1 ? { pendientes_total: 2, items } : { pendientes_total: 0, items: [] };
                },
                svc_job_purgar_recortes_marcar: ({ p_ids }) => { eventos.push(`marcar:${p_ids.join(',')}`); return { solicitadas: p_ids.length, marcadas: p_ids.length }; },
                ...extra,
            },
            storage: { remove: vi.fn(async (rutas) => { eventos.push(`borrar:${rutas.length}`); return { error: null }; }) },
        });
        return { a, eventos };
    }

    it('lista -> borra los objetos -> marca, y repite hasta vaciar', async () => {
        const { a, eventos } = purga();
        const r = await ejecutarJob('purgar-recortes', { admin: a });
        expect(eventos).toEqual(['listar', 'borrar:2', 'marcar:1,2']);
        expect(r).toMatchObject({ estado: 'ok', borrados: 2, marcados: 2, lotes: 1 });
        expect(a.bucket.remove).toHaveBeenCalledWith(items.map((i) => i.objeto_recorte));
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('si falla el borrado NO marca (las rutas siguen en BD para el siguiente intento) y libera el bloqueo', async () => {
        const { a, eventos } = purga({});
        a.bucket.remove.mockResolvedValue({ error: { message: 'x' } });
        const e = await ejecutarJob('purgar-recortes', { admin: a }).catch((x) => x);
        expect(e).toBeInstanceOf(ApiError);
        expect(e.details.fase).toBe('borrado');
        expect(eventos.some((x) => x.startsWith('marcar'))).toBe(false);
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('nunca borra rutas fuera de recortes/ (se marcan pero no se borran)', async () => {
        const raras = [{ id_deteccion: 5, objeto_recorte: 'registro/3/0f8e1c2a-aaaa-4bbb-8ccc-123456789abc.jpg' }, { id_deteccion: 6, objeto_recorte: 'recortes/../registro/x.jpg' }];
        const { a } = purga({ svc_job_purgar_recortes_listar: () => ({ pendientes_total: 2, items: raras }) });
        const r = await ejecutarJob('purgar-recortes', { admin: a });
        expect(a.bucket.remove).not.toHaveBeenCalled();
        expect(r.rutas_invalidas).toBe(2);
    });

    it('sin progreso (marcadas = 0) corta en lugar de ciclar', async () => {
        const llenos = Array.from({ length: 500 }, (_, i) => ({ id_deteccion: i + 1, objeto_recorte: `recortes/1/1/${i + 1}.jpg` }));
        const { a } = purga({
            svc_job_purgar_recortes_listar: () => ({ pendientes_total: 999, items: llenos }),
            svc_job_purgar_recortes_marcar: () => ({ solicitadas: 500, marcadas: 0 }),
        });
        const r = await ejecutarJob('purgar-recortes', { admin: a });
        expect(r.lotes).toBe(1);
    });

    it('el bloqueo job:purgar-recortes ocupado omite la corrida', async () => {
        const { a } = purga({ svc_bloqueo_adquirir: () => false });
        expect(await ejecutarJob('purgar-recortes', { admin: a })).toMatchObject({ estado: 'omitido' });
        expect(a.bucket.remove).not.toHaveBeenCalled();
    });
});

describe('purgar-fotos-registro (barrido; toma el bloqueo del índice)', () => {
    const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const items = [{ id_plantilla: 7, objetos: [`registro/3/${UUID(1)}.jpg`, `registro/3/${UUID(2)}.jpg`] }];
    function barrido(extra = {}) {
        const eventos = [];
        const a = crearBackend({
            rpcs: {
                svc_bloqueo_adquirir: () => true,
                svc_bloqueo_liberar: () => true,
                svc_fotos_registro_listar: () => {
                    eventos.push('listar');
                    return eventos.filter((e) => e === 'listar').length === 1 ? { pendientes_total: 1, items } : { pendientes_total: 0, items: [] };
                },
                svc_fotos_registro_marcar: ({ p_ids }) => { eventos.push(`marcar:${p_ids.join(',')}`); return { solicitadas: p_ids.length, marcadas: p_ids.length }; },
                ...extra,
            },
            storage: { remove: vi.fn(async (rutas) => { eventos.push(`borrar:${rutas.length}`); return { error: null }; }) },
        });
        return { a, eventos };
    }

    it('lista -> borra -> marca, y reporta lo purgado', async () => {
        const { a, eventos } = barrido();
        const r = await ejecutarJob('purgar-fotos-registro', { admin: a });
        expect(eventos).toEqual(['listar', 'borrar:2', 'marcar:7']);
        expect(r).toMatchObject({ job: 'purgar-fotos-registro', estado: 'ok', objetos_borrados: 2, marcadas: 1 });
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });

    it('toma el bloqueo del ÍNDICE (no uno propio): no corre mientras se reconstruye o revierte', async () => {
        const { a } = barrido();
        await ejecutarJob('purgar-fotos-registro', { admin: a });
        expect(a.rpc.mock.calls[0]).toEqual(['svc_bloqueo_adquirir', expect.objectContaining({ p_clave: 'indice' })]);
    });

    it('con el bloqueo ocupado omite la corrida sin borrar nada', async () => {
        const { a } = barrido({ svc_bloqueo_adquirir: () => false });
        expect(await ejecutarJob('purgar-fotos-registro', { admin: a })).toMatchObject({ estado: 'omitido', motivo: 'en_ejecucion' });
        expect(a.bucket.remove).not.toHaveBeenCalled();
        expect(a.llamadas).toEqual(['svc_bloqueo_adquirir']);
    });

    it('si falla el borrado no marca y libera el bloqueo', async () => {
        const { a, eventos } = barrido();
        a.bucket.remove.mockResolvedValue({ error: { message: 'x' } });
        const e = await ejecutarJob('purgar-fotos-registro', { admin: a }).catch((x) => x);
        expect(e).toBeInstanceOf(ApiError);
        expect(eventos.some((x) => x.startsWith('marcar'))).toBe(false);
        expect(a.llamadas.at(-1)).toBe('svc_bloqueo_liberar');
    });
});
