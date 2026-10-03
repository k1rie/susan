import clsx from 'clsx';
import { useId } from 'react';

// Contenedor de una gráfica (tarjeta con borde, sin sombra, como el resto del sistema): título, descripción corta, acciones
// opcionales, la gráfica y un pie. `resumen` es el texto alternativo para lectores de pantalla (úsalo con `resumenTexto`):
// una gráfica sin él es un hueco para quien no la ve.
export default function TarjetaGrafica({ titulo, descripcion, acciones, resumen, pie, children, className }) {
    const id = useId();
    return (
        <figure
            role="group"
            aria-labelledby={`${id}-t`}
            aria-describedby={resumen ? `${id}-r` : undefined}
            className={clsx('m-0 flex flex-col rounded-xl border border-border bg-card p-5', className)}
        >
            <figcaption className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0">
                    <span id={`${id}-t`} className="block text-base font-semibold tracking-tight">{titulo}</span>
                    {descripcion && <span className="mt-0.5 block text-sm text-muted-foreground">{descripcion}</span>}
                </span>
                {acciones && <span className="flex shrink-0 items-center gap-2">{acciones}</span>}
            </figcaption>
            <div className="mt-4 flex-1">{children}</div>
            {resumen && <p id={`${id}-r`} className="sr-only">{resumen}</p>}
            {pie && <div className="mt-3 text-xs text-muted-foreground">{pie}</div>}
        </figure>
    );
}
