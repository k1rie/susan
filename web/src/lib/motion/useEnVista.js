'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

// Espera (ms) antes de revelar un elemento que quedó bajo el margen inferior pero ya se ve entero en el viewport.
const ESPERA_RESPALDO = 600;

// true si el elemento se ve ENTERO dentro del viewport real (sin el margen de `rootMargin`). Un elemento sin caja (display:none, o
// sin layout como en jsdom) no cuenta como visible.
function seVeEntero(nodo) {
    const caja = nodo.getBoundingClientRect();
    if (caja.width === 0 && caja.height === 0) return false;
    return caja.top >= 0 && caja.bottom <= window.innerHeight;
}

// true cuando el elemento de `ref` entra al viewport. Un solo IntersectionObserver por elemento; con `once` (por
// defecto) se desconecta tras el primer aviso, así no queda ningún observador vivo después de animar.
// Sin IntersectionObserver (entornos antiguos / pruebas) se considera visible para no dejar contenido oculto.
// Respaldo del margen inferior (-8 %): el margen hace que la animación espere a que el elemento entre un poco, pero si la página ya
// no puede desplazarse más, un elemento que quede en ese 8 % no lo cruzaría nunca y se quedaría oculto. Por eso, si el observador
// lo da por fuera pero tras un instante sigue entero en el viewport real, se revela igual (solo con `once`: sin él `visto` sigue a la
// presencia y el respaldo la contradiría).
// Al imprimir / guardar PDF el observador no avisa de nada: lo que quedó bajo el pliegue (o dentro de un <Detalles> plegado, que sí
// se imprime) seguiría oculto en el papel. Por eso `beforeprint` lo revela.
export default function useEnVista(ref, { once = true, threshold = 0.15, rootMargin = '0px 0px -8% 0px', desactivado = false } = {}) {
    const [visto, setVisto] = useState(false);

    useEffect(() => {
        const nodo = ref.current;
        if (desactivado || !nodo) return undefined;
        let respaldo;
        let observador;
        // Al imprimir / guardar PDF se revela todo y se deja de observar (con `once`): el observador ya no tiene nada que avisar.
        // flushSync es obligatorio: con un setState normal React no confirma el render antes de que el navegador maquete el papel y la
        // hoja saldría con el estado cerrado.
        const alImprimir = () => {
            clearTimeout(respaldo);
            flushSync(() => setVisto(true));
            if (once) observador?.disconnect();
        };
        window.addEventListener('beforeprint', alImprimir);
        const quitarImpresion = () => window.removeEventListener('beforeprint', alImprimir);
        if (typeof IntersectionObserver === 'undefined') {
            const id = setTimeout(() => setVisto(true), 0);
            return () => {
                clearTimeout(id);
                quitarImpresion();
            };
        }
        observador = new IntersectionObserver(
            (entradas) => {
                // El aviso puede traer varias entradas juntas (si la tarea de notificación se retrasó): la última es el estado actual.
                const entrada = entradas[entradas.length - 1];
                clearTimeout(respaldo);
                if (entrada.isIntersecting) {
                    setVisto(true);
                    if (once) observador.disconnect();
                    return;
                }
                if (!once) {
                    setVisto(false);
                    return;
                }
                respaldo = setTimeout(() => {
                    if (!seVeEntero(nodo)) return;
                    setVisto(true);
                    observador.disconnect();
                }, ESPERA_RESPALDO);
            },
            { threshold, rootMargin },
        );
        observador.observe(nodo);
        return () => {
            clearTimeout(respaldo);
            observador.disconnect();
            quitarImpresion();
        };
    }, [ref, once, threshold, rootMargin, desactivado]);

    return visto;
}
