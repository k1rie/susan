'use client';

import { useApiQuery } from '@/hooks/data';
import { ahora } from '@/lib/api/plataforma.js';
import { esFechaISO, hoyLocal } from '@/lib/formularios/fechas.js';

// «Hoy» según el plantel (api_ahora, que en desarrollo puede ser el reloj de demostración) y no según el navegador: el servidor rechaza
// una firma «futura» comparando con su propio reloj, así que las fechas máximas y mínimas del formulario deben salir del mismo reloj.
// Si la consulta falla se usa la fecha del navegador. `listo` es false solo mientras llega la primera respuesta: el formulario espera
// ese instante para que «Hoy» y el máximo de la fecha de firma nunca salgan del reloj equivocado.
export default function useHoyNegocio() {
    const consulta = useApiQuery(ahora, {});
    const delServidor = consulta.data?.fecha;
    return { hoy: esFechaISO(delServidor) ? delServidor : hoyLocal(), listo: !consulta.loading };
}
