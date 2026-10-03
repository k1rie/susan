'use client';

import { useEffect, useState } from 'react';

// true cuando el elemento de `ref` entra al viewport. Un solo IntersectionObserver por elemento; con `once` (por
// defecto) se desconecta tras el primer aviso, así no queda ningún observador vivo después de animar.
// Sin IntersectionObserver (entornos antiguos / pruebas) se considera visible para no dejar contenido oculto.
export default function useEnVista(ref, { once = true, threshold = 0.15, rootMargin = '0px 0px -8% 0px', desactivado = false } = {}) {
    const [visto, setVisto] = useState(false);

    useEffect(() => {
        const nodo = ref.current;
        if (desactivado || !nodo) return undefined;
        if (typeof IntersectionObserver === 'undefined') {
            const id = setTimeout(() => setVisto(true), 0);
            return () => clearTimeout(id);
        }
        const observador = new IntersectionObserver(
            ([entrada]) => {
                if (entrada.isIntersecting) {
                    setVisto(true);
                    if (once) observador.disconnect();
                } else if (!once) {
                    setVisto(false);
                }
            },
            { threshold, rootMargin },
        );
        observador.observe(nodo);
        return () => observador.disconnect();
    }, [ref, once, threshold, rootMargin, desactivado]);

    return visto;
}
