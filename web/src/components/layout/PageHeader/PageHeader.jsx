import clsx from 'clsx';
import Link from 'next/link';

// Encabezado de página (único h1). Las acciones pasan debajo del título en pantallas angostas.
export default function PageHeader({ title, subtitle, actions, backHref, backLabel = 'Volver', className }) {
    return (
        <header className={clsx('mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between', className)}>
            <div className="min-w-0">
                {backHref && (
                    <Link href={backHref} className="mb-1 inline-block text-sm text-primary underline">
                        {backLabel}
                    </Link>
                )}
                <h1 className="text-2xl font-semibold">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}
