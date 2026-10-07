import clsx from 'clsx';
import { Check } from 'lucide-react';

// Número del paso dentro de la etiqueta de un campo; se vuelve palomita cuando el campo ya está resuelto (checklist de Deputy/Etsy).
// Es decoración (aria-hidden): el nombre accesible del campo sigue siendo solo su texto.
export default function EtiquetaPaso({ n, hecho = false, children }) {
    return (
        <span className="inline-flex items-center gap-2">
            <span
                aria-hidden="true"
                className={clsx(
                    'grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums transition-colors duration-150 motion-reduce:transition-none',
                    hecho ? 'bg-presente-bg text-presente' : 'bg-muted text-muted-foreground',
                )}
            >
                {hecho ? <Check className="size-3.5" strokeWidth={2.25} /> : n}
            </span>
            {children}
        </span>
    );
}
