'use client';

import { useRef } from 'react';
import { EASE, useEnVista, usePrefersReducedMotion } from '@/lib/motion';

// Titular que entra palabra por palabra (o letra por letra) desde desenfoque. Basado en BlurText de ReactBits,
// reescrito con transiciones CSS (sin `motion`): una sola transición por palabra sobre opacity/transform/filter,
// escalonada con transition-delay. El texto completo se expone a lectores de pantalla como texto `sr-only` y los
// segmentos animados van en un contenedor aria-hidden (aria-label sobre un span genérico no se anuncia de forma fiable).
//   animateBy  words | letters      direction  top | bottom     delay = ms entre segmentos
export default function BlurText({
    text = '',
    as: Etiqueta = 'span',
    animateBy = 'words',
    direction = 'top',
    delay = 90,
    duration = 0.7,
    className,
    ...rest
}) {
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const visible = useEnVista(ref, { desactivado: reducido }) || reducido;
    const segmentos = animateBy === 'letters' ? Array.from(text) : text.split(' ');
    const desplazamiento = direction === 'bottom' ? '0.5em' : '-0.5em';

    return (
        <Etiqueta ref={ref} className={className} {...rest}>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true" className="inline-flex flex-wrap">
            {segmentos.map((segmento, i) => (
                <span
                    key={`${segmento}-${i}`}
                    className="inline-block"
                    style={{
                        opacity: visible ? 1 : 0,
                        filter: visible ? 'blur(0px)' : 'blur(10px)',
                        transform: visible ? 'none' : `translate3d(0, ${desplazamiento}, 0)`,
                        transition: reducido ? undefined : `opacity ${duration}s ${EASE.salida} ${(i * delay) / 1000}s, filter ${duration}s ${EASE.salida} ${(i * delay) / 1000}s, transform ${duration}s ${EASE.salida} ${(i * delay) / 1000}s`,
                    }}
                >
                    {segmento === ' ' ? ' ' : segmento}
                    {animateBy === 'words' && i < segmentos.length - 1 ? ' ' : null}
                </span>
            ))}
            </span>
        </Etiqueta>
    );
}
