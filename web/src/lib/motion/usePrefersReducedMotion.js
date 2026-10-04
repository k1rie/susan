'use client';

import { useSyncExternalStore } from 'react';

const CONSULTA = '(prefers-reduced-motion: reduce)';

function soportado() {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function suscribir(avisar) {
    if (!soportado()) return () => {};
    const mq = window.matchMedia(CONSULTA);
    // Safari anterior a 14 solo trae addListener/removeListener; sin ninguno de los dos se lee el valor al renderizar y no se avisa.
    if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', avisar);
        return () => mq.removeEventListener('change', avisar);
    }
    if (typeof mq.addListener === 'function') {
        mq.addListener(avisar);
        return () => mq.removeListener?.(avisar);
    }
    return () => {};
}

// true si la persona pidió "reducir movimiento". En el servidor devuelve false (se corrige al hidratar).
// Toda animación de JS debe consultarla; las de CSS ya quedan cubiertas por la regla global de globals.css.
export default function usePrefersReducedMotion() {
    return useSyncExternalStore(
        suscribir,
        () => (soportado() ? window.matchMedia(CONSULTA).matches : false),
        () => false,
    );
}
