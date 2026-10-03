'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { EASE, useEnVista, usePrefersReducedMotion } from '@/lib/motion';

const DESPLAZAMIENTO = {
    up: (d) => `translate3d(0, ${d}px, 0)`,
    down: (d) => `translate3d(0, ${-d}px, 0)`,
    left: (d) => `translate3d(${d}px, 0, 0)`,
    right: (d) => `translate3d(${-d}px, 0, 0)`,
    none: () => 'none',
};

// Aparición al entrar al viewport: fundido + desplazamiento corto (+ desenfoque opcional). Sustituye a
// FadeContent/AnimatedContent de ReactBits, que dependen de gsap (~70 KB): aquí es una transición CSS disparada por
// un IntersectionObserver (0 KB extra, sin JS por fotograma). Con "reducir movimiento" no oculta ni anima nada.
//   direction  up | down | left | right | none     delay/duration en segundos
//   immediate  anima al montar (para contenido sobre el pliegue) en vez de esperar al viewport. La primera pasada
//              se pinta oculta igual que en el servidor (si no, la hidratación no coincide); se muestra en el
//              siguiente fotograma.
export default function Reveal({
    as: Etiqueta = 'div',
    direction = 'up',
    distance = 16,
    delay = 0,
    duration = 0.6,
    blur = false,
    once = true,
    immediate = false,
    className,
    style,
    children,
    ...rest
}) {
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const enVista = useEnVista(ref, { once, desactivado: reducido || immediate });
    const [montado, setMontado] = useState(false);
    useEffect(() => {
        if (!immediate) return undefined;
        const cuadro = requestAnimationFrame(() => setMontado(true));
        return () => cancelAnimationFrame(cuadro);
    }, [immediate]);
    const visible = reducido || enVista || montado;
    const desde = (DESPLAZAMIENTO[direction] || DESPLAZAMIENTO.up)(distance);

    return (
        <Etiqueta
            ref={ref}
            data-reveal={visible ? 'visible' : 'oculto'}
            className={cn(className)}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : desde,
                filter: blur && !visible ? 'blur(8px)' : undefined,
                transition: reducido ? undefined : `opacity ${duration}s ${EASE.salida} ${delay}s, transform ${duration}s ${EASE.salida} ${delay}s${blur ? `, filter ${duration}s ${EASE.salida} ${delay}s` : ''}`,
                ...style,
            }}
            {...rest}
        >
            {children}
        </Etiqueta>
    );
}
