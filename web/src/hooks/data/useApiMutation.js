'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fromRpcError } from '@/lib/api/errors.js';

/**
 * Mutación (escritura). `run(args)` devuelve el resultado o lanza ApiError; mientras hay una en curso, una
 * segunda llamada devuelve la misma promesa (evita doble envío).
 * @param {(args: object) => Promise<any>} fn
 * @returns {{ run: (args?: object) => Promise<any>, loading: boolean, error: ApiError | null, data: any, reset: () => void }}
 */
export function useApiMutation(fn) {
    const [estado, setEstado] = useState({ loading: false, error: null, data: null });
    const montado = useRef(true);
    const enCurso = useRef(null);

    useEffect(() => {
        montado.current = true;
        return () => { montado.current = false; };
    }, []);

    const run = useCallback((args = {}) => {
        if (enCurso.current) return enCurso.current;
        setEstado((p) => ({ ...p, loading: true, error: null }));
        const promesa = new Promise((resolver) => resolver(fn(args))).then(
            (data) => {
                if (montado.current) setEstado({ loading: false, error: null, data });
                return data;
            },
            (e) => {
                const error = e instanceof ApiError ? e : fromRpcError(e);
                if (montado.current) setEstado((p) => ({ ...p, loading: false, error }));
                throw error;
            },
        ).finally(() => { enCurso.current = null; });
        enCurso.current = promesa;
        return promesa;
    }, [fn]);

    const reset = useCallback(() => setEstado({ loading: false, error: null, data: null }), []);

    return { run, loading: estado.loading, error: estado.error, data: estado.data, reset };
}
