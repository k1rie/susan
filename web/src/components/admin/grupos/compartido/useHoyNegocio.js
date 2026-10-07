'use client';

import { useApiQuery } from '@/hooks/data';
import { ahora } from '@/lib/api/plataforma.js';
import { esFechaISO, hoyLocal } from '@/lib/formularios/fechas.js';

// «Hoy» según el plantel (api_ahora: puede ser el reloj de demostración en desarrollo) y no según el navegador, para que los valores
// por defecto (periodo sugerido, inicio de las sesiones) coincidan con lo que verá el servidor. Si la consulta falla se usa la fecha del
// navegador: es solo una sugerencia editable. `listo` es false únicamente mientras se espera la primera respuesta.
export function useHoyNegocio() {
    const consulta = useApiQuery(ahora, {});
    const delServidor = consulta.data?.fecha;
    const listo = !consulta.loading || consulta.data != null;
    return { hoy: esFechaISO(delServidor) ? delServidor : hoyLocal(), listo };
}

export default useHoyNegocio;
