import clsx from 'clsx';
import { useId } from 'react';

// Contenedor con título opcional; el título se asocia con aria-labelledby. Tarjeta de 24 px con sombra suave.
export default function Card({ title, actions, as: Tag = 'section', padded = true, children, className, ...rest }) {
    const titleId = useId();
    const conCabecera = Boolean(title || actions);
    return (
        <Tag
            aria-labelledby={title ? titleId : undefined}
            className={clsx('rounded-3xl border border-border bg-card text-card-foreground shadow-soft', className)}
            {...rest}
        >
            {conCabecera && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6 sm:pt-6">
                    {title && (
                        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                            {title}
                        </h2>
                    )}
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className={clsx(padded && (conCabecera ? 'px-5 pb-5 pt-4 sm:px-6 sm:pb-6' : 'p-5 sm:p-6'))}>{children}</div>
        </Tag>
    );
}
