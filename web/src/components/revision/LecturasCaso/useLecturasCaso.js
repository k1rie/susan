'use client';

import { useCallback, useEffect, useState } from 'react';
import { obtenerDeteccionesCaso } from '@/lib/http/revision.js';
import { ApiError, fromRpcError } from '@/lib/api/errors.js';

// Carga bajo demanda de lecturas y recortes firmados de un caso. Cada carga queda en la bitácora de consulta
// (RF-19), por eso solo se llama al abrir el caso o al renovar manualmente. Estado derivado de `clave`
// para no actualizar estado de forma síncrona en el efecto.
export function useLecturasCaso(idAsistencia) {
    const [version, setVersion] = useState(0);
    const clave = `${idAsistencia}:${version}`;
    const [resultado, setResultado] = useState({ clave: null, data: null, error: null });

    useEffect(() => {
        const controlador = new AbortController();
        obtenerDeteccionesCaso(idAsistencia, { signal: controlador.signal }).then(
            (data) => setResultado({ clave, data, error: null }),
            (e) => {
                if (controlador.signal.aborted) return;
                setResultado({ clave, data: null, error: e instanceof ApiError ? e : fromRpcError(e) });
            },
        );
        return () => controlador.abort();
    }, [idAsistencia, clave]);

    const recargar = useCallback(() => setVersion((v) => v + 1), []);
    const vigente = resultado.clave === clave;
    const estado = !vigente ? 'cargando' : resultado.error ? 'error' : 'listo';
    return { estado, data: vigente ? resultado.data : null, error: vigente ? resultado.error : null, recargar };
}
