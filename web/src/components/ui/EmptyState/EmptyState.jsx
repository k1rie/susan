import clsx from 'clsx';

// Estado vacío: icono en círculo tintado, título, descripción y acción opcional.
export default function EmptyState({ title, description, action, icon, className, ...rest }) {
    return (
        <div className={clsx('flex flex-col items-center gap-2 px-4 py-10 text-center', className)} {...rest}>
            {icon && (
                <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
                    {icon}
                </div>
            )}
            <p className="font-medium">{title}</p>
            {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}
