'use client';

import { useEffect, useRef, useState } from 'react';

// Carga remota de opciones para el Combobox: espera `debounceMs` tras la última tecla, cancela la petición anterior con
// AbortController (la respuesta vieja nunca pisa a la nueva) y no pide nada con menos de `minChars` caracteres.
//
//   loadOptions(q, { signal }) => Promise<opciones[]>      (se guarda en un ref: pasar una función nueva en cada render no
//                                                           reinicia la búsqueda)
//   loadKey -> cualquier valor que, al cambiar, invalide lo cargado (p. ej. el periodo elegido en otro campo).
// Devuelve { opciones, cargando, error, reintentar }. «cargando» y «error» se DERIVAN de la consulta actual, así no quedan
// pegados si se cierra la lista a media petición.
export function useOpcionesRemotas({ loadOptions, consulta, activo, debounceMs = 250, minChars = 2, loadKey }) {
    const cargador = useRef(loadOptions);
    useEffect(() => {
        cargador.current = loadOptions;
    });
    const [estado, setEstado] = useState({ opciones: [], resuelta: null, fallo: null });
    const [intento, setIntento] = useState(0);

    const q = consulta.trim();
    const clave = JSON.stringify([loadKey ?? null, q]);
    const habilitado = typeof loadOptions === 'function' && activo && q.length >= minChars;

    useEffect(() => {
        if (!habilitado) return undefined;
        const controlador = new AbortController();
        const espera = setTimeout(async () => {
            try {
                const resultado = await cargador.current(q, { signal: controlador.signal });
                if (controlador.signal.aborted) return;
                setEstado({ opciones: Array.isArray(resultado) ? resultado : [], resuelta: clave, fallo: null });
            } catch (e) {
                if (controlador.signal.aborted || e?.name === 'AbortError') return;
                setEstado((previo) => ({ ...previo, fallo: clave }));
            }
        }, debounceMs);
        return () => {
            clearTimeout(espera);
            controlador.abort();
        };
    }, [habilitado, q, clave, debounceMs, intento]);

    return {
        opciones: habilitado ? estado.opciones : [],
        cargando: habilitado && estado.resuelta !== clave && estado.fallo !== clave,
        error: habilitado && estado.fallo === clave,
        reintentar: () => {
            setEstado((previo) => ({ ...previo, fallo: null }));
            setIntento((n) => n + 1);
        },
    };
}

export default useOpcionesRemotas;
