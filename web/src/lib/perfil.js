'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Preferencias de perfil que la persona elige en el onboarding (color del avatar). No hay columna en la base para esto:
// son una conveniencia por navegador (localStorage), con un evento propio para refrescar el shell sin recargar.
// Nunca guardan datos personales sensibles.
const CLAVE = (me) => `susan.perfil.v1.${me?.id_usuario ?? me?.correo ?? 'anon'}`;
const EVENTO = 'susan:perfil';

function leer(clave) {
    try {
        return JSON.parse(window.localStorage.getItem(clave) || 'null') || {};
    } catch {
        return {};
    }
}

/** Lee la preferencia guardada (o {}) — apta para pruebas y para scripts del cliente. */
export function leerPerfil(me) {
    if (typeof window === 'undefined') return {};
    return leer(CLAVE(me));
}

export function guardarPerfil(me, parcial) {
    try {
        const nuevo = { ...leer(CLAVE(me)), ...parcial };
        window.localStorage.setItem(CLAVE(me), JSON.stringify(nuevo));
    } catch {
        // almacenamiento no disponible (modo privado): la elección vale solo para esta sesión de la página
    }
    window.dispatchEvent(new Event(EVENTO));
}

const suscribir = (aviso) => {
    window.addEventListener(EVENTO, aviso);
    window.addEventListener('storage', aviso);
    return () => {
        window.removeEventListener(EVENTO, aviso);
        window.removeEventListener('storage', aviso);
    };
};

/** { tinte, guardar } del usuario actual; `tinte` es null hasta que elija uno. Servidor: sin preferencia (sin desajuste). */
export function usePreferenciasPerfil(me) {
    const clave = CLAVE(me);
    const crudo = useSyncExternalStore(
        suscribir,
        () => {
            try {
                return window.localStorage.getItem(clave) || '';
            } catch {
                return '';
            }
        },
        () => '',
    );
    let valor = {};
    try {
        valor = crudo ? JSON.parse(crudo) || {} : {};
    } catch {
        valor = {};
    }
    const guardar = useCallback((parcial) => guardarPerfil(me, parcial), [me]);
    return { tinte: valor.tinte ?? null, guardar };
}
