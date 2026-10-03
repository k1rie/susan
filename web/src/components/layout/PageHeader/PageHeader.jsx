import clsx from 'clsx';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Encabezado de página (único h1) en la grotesca de la interfaz (como «Settings» en Dash). Las acciones pasan debajo del título
// en pantallas angostas.
export default function PageHeader({ title, subtitle, actions, backHref, backLabel = 'Volver', className }) {
    return (
        <header className={clsx('mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
            <div className="min-w-0">
                {backHref && (
                    <Link href={backHref} className="mb-2 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
                        {backLabel}
                    </Link>
                )}
                <h1 className="text-2xl font-medium leading-tight tracking-tight sm:text-[26px]">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}
