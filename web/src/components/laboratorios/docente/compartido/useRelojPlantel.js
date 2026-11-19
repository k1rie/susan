'use client';

import { useApiQuery } from '@/hooks/data';
import { ahora } from '@/lib/api/plataforma.js';
import { relojDeRespuesta } from './reloj.utils.js';

/**
 * Hora de negocio del plantel (api_ahora): { hoy, hora, delPlantel, listo }.
 * `sondeoMs` repite la consulta (la lista de solicitudes lo usa para que «Cancelar» desaparezca cuando una aprobada ya inició aunque
 * la pestaña siga abierta); sin él se consulta una sola vez. `listo` es false solo mientras llega la primera respuesta.
 */
export function useRelojPlantel({ sondeoMs } = {}) {
    const consulta = useApiQuery(ahora, {}, { refetchInterval: sondeoMs });
    return { ...relojDeRespuesta(consulta.data), listo: !consulta.loading };
}

export default useRelojPlantel;
