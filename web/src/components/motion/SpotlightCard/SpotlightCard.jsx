'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

// Tarjeta con foco de luz que sigue al puntero (basada en SpotlightCard de ReactBits). La posición se escribe en
// variables CSS (--x/--y) desde el manejador del puntero: sin estado de React ni re-render por movimiento. El foco
// solo aparece con ratón (hover) o por teclado (focus-within); en pantallas táctiles no hace nada. El color usa
// tokens, así sigue el tema claro/oscuro.
export default function SpotlightCard({ as: Etiqueta = 'div', className, children, ...rest }) {
    const ref = useRef(null);

    const alMover = (evento) => {
        if (evento.pointerType !== 'mouse' || !ref.current) return;
        const caja = ref.current.getBoundingClientRect();
        ref.current.style.setProperty('--x', `${evento.clientX - caja.left}px`);
        ref.current.style.setProperty('--y', `${evento.clientY - caja.top}px`);
    };

    return (
        <Etiqueta
            ref={ref}
            onPointerMove={alMover}
            className={cn(
                'group/spot relative isolate overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-soft',
                'transition-shadow duration-300 hover:shadow-lift',
                className,
            )}
            {...rest}
        >
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100 group-focus-within/spot:opacity-100"
                style={{ background: 'radial-gradient(420px circle at var(--x, 50%) var(--y, 0%), color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%)' }}
            />
            {children}
        </Etiqueta>
    );
}
