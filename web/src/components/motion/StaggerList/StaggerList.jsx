'use client';

import { Children, useRef } from 'react';
import { cn } from '@/lib/utils';
import { EASE, useEnVista, usePrefersReducedMotion } from '@/lib/motion';

// Lista cuyos elementos aparecen en cascada al entrar al viewport. Equivale al AnimatedList de ReactBits sin su
// navegación global por teclado (que secuestraba Tab) ni un observador por elemento: UN solo observador en el
// contenedor y el escalonado se hace con transition-delay (tope `max` para listas largas).
//   step = segundos entre elementos     max = retraso máximo acumulado
export default function StaggerList({ as: Etiqueta = 'ul', itemAs: Item = 'li', step = 0.06, max = 0.6, distance = 14, className, itemClassName, children, ...rest }) {
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const visible = useEnVista(ref, { desactivado: reducido, threshold: 0.05 }) || reducido;

    return (
        <Etiqueta ref={ref} className={className} {...rest}>
            {Children.toArray(children).map((hijo, i) => (
                <Item
                    key={hijo.key ?? i}
                    className={cn(itemClassName)}
                    style={{
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'none' : `translate3d(0, ${distance}px, 0)`,
                        transition: reducido ? undefined : `opacity 0.5s ${EASE.salida} ${Math.min(i * step, max)}s, transform 0.5s ${EASE.salida} ${Math.min(i * step, max)}s`,
                    }}
                >
                    {hijo}
                </Item>
            ))}
        </Etiqueta>
    );
}
