'use client';

import { useSyncExternalStore } from 'react';

const CONSULTA = '(prefers-reduced-motion: reduce)';

function soportado() {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function suscribir(avisar) {
    if (!soportado()) return () => {};
    const mq = window.matchMedia(CONSULTA);
    mq.addEventListener('change', avisar);
    return () => mq.removeEventListener('change', avisar);
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
