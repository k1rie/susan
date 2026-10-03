'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fromRpcError } from '@/lib/api/errors.js';

const INTERVALO_MINIMO_MS = 500;

/** Clave estable de los argumentos: dos objetos con el mismo contenido no disparan otra consulta. */
function claveDe(args) {
    return JSON.stringify(args ?? {});
}

/**
 * Consulta de datos con descarte de respuestas obsoletas y sondeo opcional.
 * `fn` debe tener referencia estable (función de módulo de lib/api).
 * @param {(args: object) => Promise<any>} fn
 * @param {object} [args] argumentos camelCase
 * @param {{ enabled?: boolean, refetchInterval?: number, initialData?: any }} [opciones]
 * @returns {{ data: any, error: ApiError | null, loading: boolean, refetching: boolean,
 *             refetch: () => Promise<{ ok: boolean, data?: any, error?: ApiError }> }}
 */
export function useApiQuery(fn, args, { enabled = true, refetchInterval, initialData } = {}) {
    const key = claveDe(args);
    const [estado, setEstado] = useState(() => ({
        key, fn, data: initialData ?? null, error: null, listo: initialData !== undefined,
    }));
    const [refetching, setRefetching] = useState(false);
    const secuencia = useRef(0);
    const enVuelo = useRef(null);
    const cargarRef = useRef(null);

    useEffect(() => {
        if (!enabled) {
            cargarRef.current = null;
            return undefined;
        }
        let activo = true;
        let temporizador = null;
        let pausado = false;

        const programar = () => {
            if (!activo || !refetchInterval) return;
            temporizador = setTimeout(() => {
                if (typeof document !== 'undefined' && document.hidden) {
                    pausado = true;
                    return;
                }
                cargar(true);
            }, Math.max(refetchInterval, INTERVALO_MINIMO_MS));
        };

        const cargar = (forzar) => {
            // En StrictMode el efecto corre dos veces: se reutiliza el pedido aún pendiente de la misma clave.
            let pedido = enVuelo.current;
            let id;
            if (!forzar && pedido && !pedido.listo && pedido.key === key && pedido.fn === fn) {
                id = secuencia.current;
            } else {
                id = ++secuencia.current;
                const nuevo = { key, fn, listo: false, promesa: null };
                nuevo.promesa = new Promise((resolver) => resolver(fn(JSON.parse(key))))
                    .then((data) => ({ ok: true, data }), (e) => ({ ok: false, error: e instanceof ApiError ? e : fromRpcError(e) }));
                nuevo.promesa.then(() => { nuevo.listo = true; });
                enVuelo.current = nuevo;
                pedido = nuevo;
                if (forzar) setRefetching(true);
            }
            return pedido.promesa.then((res) => {
                if (activo && id === secuencia.current) {
                    setEstado((previo) => ({
                        key, fn, listo: true,
                        data: res.ok ? res.data : (previo.key === key && previo.fn === fn ? previo.data : null),
                        error: res.ok ? null : res.error,
                    }));
                    setRefetching(false);
                    programar();
                }
                return res;
            });
        };

        const alVolver = () => {
            if (pausado && !document.hidden) {
                pausado = false;
                cargar(true);
            }
        };
        if (refetchInterval && typeof document !== 'undefined') document.addEventListener('visibilitychange', alVolver);

        cargarRef.current = cargar;
        cargar(false);
        return () => {
            activo = false;
            clearTimeout(temporizador);
            if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', alVolver);
            cargarRef.current = null;
        };
    }, [fn, key, enabled, refetchInterval]);

    const refetch = useCallback(async () => {
        if (!cargarRef.current) return { ok: false, error: null };
        return cargarRef.current(true);
    }, []);

    const vigente = estado.key === key && estado.fn === fn;
    return {
        data: vigente ? estado.data : null,
        error: vigente ? estado.error : null,
        loading: enabled && !(vigente && estado.listo),
        refetching,
        refetch,
    };
}
