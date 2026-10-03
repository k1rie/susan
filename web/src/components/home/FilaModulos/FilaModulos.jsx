import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import { StaggerList } from '@/components/motion';
import ModuloCard from '../ModuloCard';

// Sección de tarjetas de módulo (como «Created by me» en Dash): título + subtítulo, enlace «Ver todo» y una cuadrícula de
// tarjetas de portada (2 columnas en teléfono hasta 5 en pantallas anchas). Se muestran hasta `max` y el resto va en /modulos.
//   verTodoHref  enlace de «Ver todo»; verTodoEtiqueta = texto del enlace
export default function FilaModulos({ titulo, subtitulo, modulos, max = 10, verTodoHref, verTodoEtiqueta = 'Ver todo', className }) {
    const tituloId = useId();
    if (!modulos?.length) return null;
    const visibles = modulos.slice(0, max);

    return (
        <section aria-labelledby={tituloId} className={className}>
            <div className="mb-4 flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <h2 id={tituloId} className="text-xl font-semibold tracking-tight">{titulo}</h2>
                    {subtitulo && <p className="mt-0.5 text-sm text-muted-foreground">{subtitulo}</p>}
                </div>
                {verTodoHref && (
                    <Link href={verTodoHref} className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                        {verTodoEtiqueta}
                        <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    </Link>
                )}
            </div>
            <StaggerList className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5" step={0.04} max={0.4}>
                {visibles.map((m) => (
                    <ModuloCard key={m.id} modulo={m} />
                ))}
            </StaggerList>
        </section>
    );
}
