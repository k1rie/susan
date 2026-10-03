'use client';

import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/motion';
import { ESCENAS } from './escenas.jsx';

const INTERVALO_MS = 6500;

// Panel derecho de las pantallas de acceso (patrón de SchoolAI: el producto se demuestra, no se describe): una tarjeta
// con una escena animada de SUSAN que rota cada ~6,5 s con su titular. Es decoración pura: aria-hidden, sin elementos
// enfocables. Con "reducir movimiento" muestra solo la primera escena, estática. Se pausa con la pestaña oculta.
export default function PanelProducto() {
    const reducido = usePrefersReducedMotion();
    const [indice, setIndice] = useState(0);

    useEffect(() => {
        if (reducido) return undefined;
        let id = null;
        const arrancar = () => {
            id = setInterval(() => setIndice((i) => (i + 1) % ESCENAS.length), INTERVALO_MS);
        };
        const alCambiarVisibilidad = () => {
            clearInterval(id);
            if (!document.hidden) arrancar();
        };
        arrancar();
        document.addEventListener('visibilitychange', alCambiarVisibilidad);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', alCambiarVisibilidad);
        };
    }, [reducido]);

    const { id, titulo, texto, Vista } = ESCENAS[reducido ? 0 : indice];

    return (
        <div aria-hidden="true" className="relative hidden min-h-0 flex-1 flex-col justify-between gap-8 overflow-hidden rounded-2xl border border-border/70 bg-muted/60 p-8 lg:flex xl:p-12">
            <div className="flex gap-1.5">
                {ESCENAS.map((e, i) => (
                    <span key={e.id} className={`h-1.5 rounded-full transition-all duration-500 ${i === (reducido ? 0 : indice) ? 'w-8 bg-foreground' : 'w-1.5 bg-foreground/20'}`} />
                ))}
            </div>
            <div key={id} className="mx-auto w-full max-w-md">
                <Vista />
            </div>
            <div key={`${id}-t`} className="escena-entra max-w-md" style={{ '--d': '0.1s' }}>
                <p className="font-display text-4xl leading-tight tracking-tight xl:text-5xl">{titulo}</p>
                <p className="mt-2 text-base text-muted-foreground">{texto}</p>
            </div>
        </div>
    );
}
