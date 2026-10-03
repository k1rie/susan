'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { yo } from '@/lib/api/plataforma.js';
import { ApiError, fromRpcError } from '@/lib/api/errors.js';
import { suscribirCambioSesion } from '@/lib/api/sesionEventos.js';

// Caché a nivel de módulo: una sola consulta api_yo compartida por todos los componentes. Se descarta al
// iniciar o cerrar sesión (auth.js emite el evento) para no mostrar la identidad de otro usuario.
const IDLE = { me: null, error: null, loading: false, estado: 'idle' };
let snapshot = IDLE;
let promesa = null;
let version = 0;
const oyentes = new Set();

function publicar(nuevo) {
    snapshot = nuevo;
    oyentes.forEach((fn) => fn());
}

/** Descarta la identidad en caché (y cualquier consulta en vuelo). */
export function invalidarMe() {
    version += 1;
    promesa = null;
    publicar(IDLE);
}

suscribirCambioSesion(() => invalidarMe());

/** Carga api_yo una sola vez; las llamadas concurrentes comparten la promesa. */
export function cargarMe({ forzar = false } = {}) {
    if (promesa && !forzar) return promesa;
    const mia = ++version;
    publicar({ ...snapshot, loading: true, estado: 'cargando', error: null });
    const actual = Promise.resolve().then(() => yo()).then(
        (me) => {
            if (mia === version) publicar({ me, error: null, loading: false, estado: 'listo' });
            return me;
        },
        (e) => {
            const error = e instanceof ApiError ? e : fromRpcError(e);
            if (mia === version) publicar({ me: null, error, loading: false, estado: 'error' });
            return null;
        },
    );
    promesa = actual;
    return actual;
}

const suscribir = (fn) => {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
};

/**
 * Identidad del usuario actual (api_yo) con caché de módulo.
 * @returns {{ me: object|null, data: object|null, error: ApiError|null, loading: boolean, refetch: () => Promise<object|null> }}
 */
export function useMe() {
    const s = useSyncExternalStore(suscribir, () => snapshot, () => IDLE);
    useEffect(() => {
        // Solo se pide automáticamente desde el estado inicial; un error no se reintenta en bucle.
        if (snapshot.estado === 'idle') cargarMe();
    }, [s.estado]);
    const refetch = useCallback(() => cargarMe({ forzar: true }), []);
    return { me: s.me, data: s.me, error: s.error, loading: s.estado === 'idle' || s.loading, refetch };
}
