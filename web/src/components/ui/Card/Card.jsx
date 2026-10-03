import clsx from 'clsx';
import { useId } from 'react';

// Contenedor con título opcional; el título se asocia con aria-labelledby. Borde fino y fondo blanco, sin sombra.
export default function Card({ title, actions, as: Tag = 'section', padded = true, children, className, ...rest }) {
    const titleId = useId();
    const conCabecera = Boolean(title || actions);
    return (
        <Tag
            aria-labelledby={title ? titleId : undefined}
            className={clsx('rounded-xl border border-border bg-card text-card-foreground', className)}
            {...rest}
        >
            {conCabecera && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
                    {title && (
                        <h2 id={titleId} className="text-base font-semibold tracking-tight">
                            {title}
                        </h2>
                    )}
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className={clsx(padded && (conCabecera ? 'px-5 pb-5 pt-3' : 'p-5'))}>{children}</div>
        </Tag>
    );
}
