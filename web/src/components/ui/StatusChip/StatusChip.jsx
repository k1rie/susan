import clsx from 'clsx';
import { etiqueta, tokens } from './statusChip.utils.js';

// Etiqueta de estado del dominio: texto + color (nunca solo color); el punto es solo refuerzo visual.
export default function StatusChip({ kind, value, size = 'md', title, className, ...rest }) {
    return (
        <span
            title={title}
            className={clsx(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium',
                size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
                tokens(kind, value),
                className,
            )}
            {...rest}
        >
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
            {etiqueta(kind, value)}
        </span>
    );
}
