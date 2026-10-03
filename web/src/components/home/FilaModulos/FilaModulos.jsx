'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useId, useRef } from 'react';
import ModuloCard from '../ModuloCard';
import { StaggerList } from '@/components/motion';

// Fila horizontal de tarjetas de módulo: título + subtítulo, "Ver todo (n) →" y flechas. El desplazamiento es el
// nativo del navegador (scroll-snap), sin librerías; las flechas solo llaman a scrollBy.
//   verTodoHref  enlace de "Ver todo"; total = n que se muestra (por defecto, los de la fila); verTodoEtiqueta = texto completo del enlace
export default function FilaModulos({ titulo, subtitulo, modulos, verTodoHref, total, verTodoEtiqueta, className }) {
    const pista = useRef(null);
    const tituloId = useId();
    if (!modulos?.length) return null;

    const mover = (sentido) => {
        const el = pista.current;
        if (!el) return;
        el.scrollBy({ left: sentido * Math.max(240, el.clientWidth * 0.8), behavior: 'smooth' });
    };

    return (
        <section aria-labelledby={tituloId} className={className}>
            <div className="mb-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <h2 id={tituloId} className="text-xl font-semibold tracking-tight">{titulo}</h2>
                    {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {verTodoHref && (
                        <Link href={verTodoHref} className="mr-1 rounded-full px-2 py-1 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
                            {verTodoEtiqueta ?? `Ver todo (${total ?? modulos.length}) →`}
                        </Link>
                    )}
                    <button type="button" aria-label="Anterior" onClick={() => mover(-1)} className="hidden size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 md:flex">
                        <ChevronLeft className="size-4" strokeWidth={1.75} />
                    </button>
                    <button type="button" aria-label="Siguiente" onClick={() => mover(1)} className="hidden size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 md:flex">
                        <ChevronRight className="size-4" strokeWidth={1.75} />
                    </button>
                </div>
            </div>
            <div ref={pista} className="-mx-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:-mx-6 md:px-6 [&::-webkit-scrollbar]:hidden">
                <StaggerList className="flex snap-x snap-mandatory gap-3" itemClassName="w-[15.5rem] shrink-0 snap-start sm:w-[16.5rem]">
                    {modulos.map((m) => (
                        <ModuloCard key={m.id} modulo={m} />
                    ))}
                </StaggerList>
            </div>
        </section>
    );
}
