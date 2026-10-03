import clsx from 'clsx';
import { useId } from 'react';

// Contenedor con título opcional; el título se asocia con aria-labelledby.
export default function Card({ title, actions, as: Tag = 'section', padded = true, children, className, ...rest }) {
    const titleId = useId();
    return (
        <Tag
            aria-labelledby={title ? titleId : undefined}
            className={clsx('rounded-lg border border-border bg-card', className)}
            {...rest}
        >
            {(title || actions) && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                    {title && (
                        <h2 id={titleId} className="text-base font-semibold">
                            {title}
                        </h2>
                    )}
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className={clsx(padded && 'p-4')}>{children}</div>
        </Tag>
    );
}
