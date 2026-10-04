'use client';

import { useEffect, useState } from 'react';

// Ancho (px, entero) del elemento de `ref`, o null mientras no se ha medido (servidor, primera pintura o sin ResizeObserver: entornos
// antiguos y pruebas). Así el primer render es idéntico en servidor y cliente y las decisiones que dependen del ancho (reducir o
// abreviar cifras) solo se toman con una medida real. El estado se actualiza desde el callback del observador, nunca en el cuerpo del efecto.
export default function useAnchoElemento(ref, { desactivado = false } = {}) {
    const [ancho, setAncho] = useState(null);

    useEffect(() => {
        const nodo = ref.current;
        if (desactivado || !nodo || typeof ResizeObserver === 'undefined') return undefined;
        const observador = new ResizeObserver(([entrada]) => {
            const medido = Math.round(entrada.contentRect.width);
            setAncho((previo) => (previo === medido ? previo : medido));
        });
        observador.observe(nodo);
        return () => observador.disconnect();
    }, [ref, desactivado]);

    return ancho;
}
