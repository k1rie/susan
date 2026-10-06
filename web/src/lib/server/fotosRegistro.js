// Purga de fotos de registro (extensión 18 de docs/DECISIONS.md). Solo servidor.
// Una foto de registro solo sirve para calcular el vector del alumno; cuando ese vector ya vive en el JSON de un índice
// activado, la foto se borra del bucket y su ruta pasa a NULL. Así el bucket guarda el JSON y no el rostro (RNF-03).
import { ApiError } from '@/lib/api/errors';
import { eliminarObjetos, validarRutaObjeto } from './storage.js';

const LOTE_PLANTILLAS = 200; // plantillas por vuelta (svc_fotos_registro_listar admite hasta 1000)
const MAX_LOTES = 10; // tope por ejecución; lo restante lo toma la siguiente corrida
const LOTE_BORRADO = 100; // rutas por llamada a Storage

/**
 * Purga en 3 pasos y en este orden: listar -> borrar objetos -> marcar NULL.
 * Con el orden inverso quedarían objetos huérfanos para siempre; si el proceso muere entre 2 y 3, la siguiente
 * corrida vuelve a listar las mismas rutas y borrar un objeto ausente no es error.
 * La SQL solo lista plantillas con el vector ya en un índice activado (o archivadas): jamás la foto que el build aún necesita.
 * @param {{ svc: (nombre: string, args?: object) => Promise<any>, admin: object, ids?: number[] }} p
 *   `ids` restringe a esas plantillas (la reconstrucción pasa las que acaba de indexar); sin él se barre todo lo purgable.
 * @returns {Promise<{ lotes: number, plantillas: number, objetos_borrados: number, marcadas: number, rutas_invalidas: number, pendientes_total: number }>}
 */
export async function purgarFotosRegistro({ svc, admin, ids }) {
    const total = { lotes: 0, plantillas: 0, objetos_borrados: 0, marcadas: 0, rutas_invalidas: 0, pendientes_total: 0 };
    if (Array.isArray(ids) && ids.length === 0) return total;

    for (let i = 0; i < MAX_LOTES; i += 1) {
        const lote = await svc('svc_fotos_registro_listar', { ids: ids ?? null, limit: LOTE_PLANTILLAS });
        const items = Array.isArray(lote?.items) ? lote.items : [];
        total.pendientes_total = Number(lote?.pendientes_total ?? 0);
        if (items.length === 0) break;
        total.lotes += 1;
        total.plantillas += items.length;

        // Solo se borran rutas con la forma esperada de una foto de registro: jamás se borra algo fuera de registro/.
        const rutas = [];
        for (const item of items) {
            for (const objeto of Array.isArray(item.objetos) ? item.objetos : []) {
                try {
                    rutas.push(validarRutaObjeto(objeto, ['registro']));
                } catch {
                    total.rutas_invalidas += 1; // no hay objeto que borrar; se marca igual para no re-listarla siempre
                }
            }
        }
        try {
            for (let k = 0; k < rutas.length; k += LOTE_BORRADO) {
                await eliminarObjetos(rutas.slice(k, k + LOTE_BORRADO), { admin });
                total.objetos_borrados += Math.min(LOTE_BORRADO, rutas.length - k);
            }
        } catch (e) {
            // No se marca nada de este lote: las rutas siguen en la BD y la siguiente corrida reintenta.
            throw new ApiError({
                code: e instanceof ApiError ? e.code : 'ERROR_INTERNO',
                message: 'La purga de fotos de registro se detuvo: falló el borrado en el almacenamiento.',
                status: e instanceof ApiError ? e.status : 500,
                details: { fase: 'borrado', ...total },
            });
        }
        const marca = await svc('svc_fotos_registro_marcar', { ids: items.map((x) => x.id_plantilla) });
        const marcadas = Number(marca?.marcadas ?? 0);
        total.marcadas += marcadas;
        if (items.length < LOTE_PLANTILLAS || marcadas === 0) break; // sin progreso: evita un ciclo infinito
    }
    return total;
}
