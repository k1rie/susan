'use client';

import { useApiQuery } from '@/hooks/data';
import { ahora } from '@/lib/api/plataforma.js';
import { hoyLocal } from '@/lib/formularios/fechas.js';
import { normalizarAhora } from '../laboratoriosAdmin.utils.js';

const dos = (n) => String(n).padStart(2, '0');

// La fecha y la hora «de hoy» según el plantel (api_ahora: en desarrollo puede ser el reloj de demostración) y no según el navegador,
// para que «¿ya empezó?» y la semana de la agenda coincidan con lo que decide el servidor.
// Mientras llega la primera respuesta vale null (así no hay diferencias entre servidor y navegador al hidratar); si la consulta falla se usa el
// reloj del navegador: la RPC sigue siendo quien decide.
//   -> { ahora: { fecha: 'AAAA-MM-DD', hora: 'HH:MM' } | null, hoy: 'AAAA-MM-DD' | null, listo }
export function useAhoraNegocio() {
    const consulta = useApiQuery(ahora, {});
    let actual = normalizarAhora(consulta.data);
    if (!actual && consulta.error) {
        const navegador = new Date();
        actual = { fecha: hoyLocal(navegador), hora: `${dos(navegador.getHours())}:${dos(navegador.getMinutes())}` };
    }
    return { ahora: actual, hoy: actual?.fecha ?? null, listo: actual != null };
}

export default useAhoraNegocio;
