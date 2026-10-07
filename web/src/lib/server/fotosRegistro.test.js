import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { purgarFotosRegistro } from './fotosRegistro.js';
import { crearBackend } from './testing.js';

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ruta = (alumno, n) => `registro/${alumno}/${UUID(n)}.jpg`;

/** svc simulado: `lotes` es la secuencia de respuestas de listar; anota el orden de los pasos. */
function entorno({ lotes, marcar = ({ ids }) => ({ solicitadas: ids.length, marcadas: ids.length }), borrado = { error: null } }) {
    const eventos = [];
    const admin = crearBackend({ storage: { remove: vi.fn(async (rutas) => { eventos.push(`borrar:${rutas.length}`); return borrado; }) } });
    let i = 0;
    const svc = vi.fn(async (nombre, args) => {
        if (nombre === 'svc_fotos_registro_listar') {
            eventos.push('listar');
            return lotes[Math.min(i++, lotes.length - 1)];
        }
        eventos.push(`marcar:${args.ids.join(',')}`);
        return marcar(args);
    });
    return { admin, svc, eventos };
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

describe('purgarFotosRegistro', () => {
    it('lista -> borra TODOS los objetos de cada plantilla -> marca, en ese orden', async () => {
        const items = [
            { id_plantilla: 7, objetos: [ruta(3, 1), ruta(3, 2), ruta(3, 3)] },
            { id_plantilla: 9, objetos: [ruta(4, 4)] },
        ];
        const { admin, svc, eventos } = entorno({ lotes: [{ pendientes_total: 2, items }] });
        const r = await purgarFotosRegistro({ svc, admin });
        expect(eventos).toEqual(['listar', 'borrar:4', 'marcar:7,9']);
        expect(admin.bucket.remove).toHaveBeenCalledWith([ruta(3, 1), ruta(3, 2), ruta(3, 3), ruta(4, 4)]);
        expect(r).toMatchObject({ lotes: 1, plantillas: 2, objetos_borrados: 4, marcadas: 2, rutas_invalidas: 0 });
    });

    it('con ids los pasa a la SQL (solo las plantillas que se acaban de indexar)', async () => {
        const { admin, svc } = entorno({ lotes: [{ pendientes_total: 0, items: [] }] });
        await purgarFotosRegistro({ svc, admin, ids: [41, 42] });
        expect(svc).toHaveBeenCalledWith('svc_fotos_registro_listar', { ids: [41, 42], limit: 200 });
    });

    it('sin ids barre todo lo purgable (ids: null)', async () => {
        const { admin, svc } = entorno({ lotes: [{ pendientes_total: 0, items: [] }] });
        await purgarFotosRegistro({ svc, admin });
        expect(svc).toHaveBeenCalledWith('svc_fotos_registro_listar', { ids: null, limit: 200 });
    });

    it('con una lista de ids vacía no consulta nada (no hay qué purgar; null/undefined sí significaría «todo»)', async () => {
        const { admin, svc } = entorno({ lotes: [] });
        const r = await purgarFotosRegistro({ svc, admin, ids: [] });
        expect(svc).not.toHaveBeenCalled();
        expect(r).toMatchObject({ lotes: 0, plantillas: 0, objetos_borrados: 0 });
    });

    it('si falla el borrado NO marca (las rutas siguen en BD para el siguiente intento)', async () => {
        const { admin, svc, eventos } = entorno({
            lotes: [{ pendientes_total: 1, items: [{ id_plantilla: 7, objetos: [ruta(3, 1)] }] }],
            borrado: { error: { message: 'x' } },
        });
        const e = await purgarFotosRegistro({ svc, admin }).catch((x) => x);
        expect(e).toBeInstanceOf(ApiError);
        expect(e.details.fase).toBe('borrado');
        expect(eventos.some((x) => x.startsWith('marcar'))).toBe(false);
    });

    it('nunca borra rutas fuera de registro/ (se marcan pero no se borran)', async () => {
        const items = [
            { id_plantilla: 5, objetos: ['recortes/1/1/1.jpg', 'registro/../recortes/1/1/2.jpg', 'indice/v001.json', 'registro/3/no-es-uuid.jpg'] },
        ];
        const { admin, svc, eventos } = entorno({ lotes: [{ pendientes_total: 1, items }] });
        const r = await purgarFotosRegistro({ svc, admin });
        expect(admin.bucket.remove).not.toHaveBeenCalled();
        expect(r.rutas_invalidas).toBe(4);
        expect(eventos).toEqual(['listar', 'marcar:5']);
    });

    it('sin progreso (marcadas = 0) corta en lugar de ciclar', async () => {
        const llenos = Array.from({ length: 200 }, (_, i) => ({ id_plantilla: i + 1, objetos: [ruta(i + 1, i + 1)] }));
        const { admin, svc } = entorno({
            lotes: [{ pendientes_total: 999, items: llenos }],
            marcar: () => ({ solicitadas: 200, marcadas: 0 }),
        });
        const r = await purgarFotosRegistro({ svc, admin });
        expect(r.lotes).toBe(1);
    });

    it('un objeto ausente en el bucket no es error (el borrado es idempotente)', async () => {
        const { admin, svc } = entorno({ lotes: [{ pendientes_total: 1, items: [{ id_plantilla: 7, objetos: [ruta(3, 1)] }] }, { pendientes_total: 0, items: [] }] });
        await expect(purgarFotosRegistro({ svc, admin })).resolves.toMatchObject({ marcadas: 1 });
    });
});
