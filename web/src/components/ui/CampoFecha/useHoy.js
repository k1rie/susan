'use client';

import { useSyncExternalStore } from 'react';
import { hoyLocal } from '@/lib/formularios/fechas.js';

const sinSuscripcion = () => () => {};

// «Hoy» sin romper la hidratación: el servidor no conoce la zona horaria de quien mira, así que en el primer render (servidor
// e hidratación) vale null y el valor del navegador entra justo después. Los atajos que dependen de hoy aparecen entonces.
// Si la pantalla pasa su propio `hoy` (el del servidor, el del reloj de demostración) se usa ese y no hay salto.
export function useHoy(hoy) {
    const delNavegador = useSyncExternalStore(sinSuscripcion, hoyLocal, () => null);
    return hoy ?? delNavegador;
}

export default useHoy;
