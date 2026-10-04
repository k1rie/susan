'use client';

import { useEffect, useState } from 'react';

// Ancho (px, entero) del elemento de `ref`, medido con ResizeObserver. Vale 0 mientras no se ha medido: servidor y primer render del
// cliente coinciden (sin desajuste de hidratación) y la gráfica reserva su alto sin dibujar. Sin ResizeObserver se queda en 0.
export default function useAnchoMedido(ref) {
    const [ancho, setAncho] = useState(0);

    useEffect(() => {
        const nodo = ref.current;
        if (!nodo || typeof ResizeObserver === 'undefined') return undefined;
        // El observador avisa al observar, así que no hace falta una medición síncrona aparte (evita un setState directo en el efecto).
        const observador = new ResizeObserver((entradas) => {
            const entrada = entradas[entradas.length - 1];
            const medido = entrada?.contentRect?.width ?? nodo.clientWidth;
            setAncho(Math.max(0, Math.round(medido)));
        });
        observador.observe(nodo);
        return () => observador.disconnect();
    }, [ref]);

    return ancho;
}
