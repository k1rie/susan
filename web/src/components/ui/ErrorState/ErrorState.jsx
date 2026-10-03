import clsx from 'clsx';
import Link from 'next/link';
import Button from '../Button/Button.jsx';

// Error de carga con reintento. Con NO_AUTENTICADO se ofrece iniciar sesión en vez de reintentar.
export default function ErrorState({ error, title = 'No se pudo cargar', onRetry, compact = false, className, ...rest }) {
    const mensaje = typeof error === 'string' ? error : error?.message;
    const sinSesion = typeof error === 'object' && error?.code === 'NO_AUTENTICADO';
    return (
        <div
            role="alert"
            className={clsx('flex flex-col items-center gap-2 text-center', compact ? 'px-3 py-4' : 'px-4 py-10', className)}
            {...rest}
        >
            <p className="font-medium text-destructive">{title}</p>
            {mensaje && <p className="max-w-md text-sm text-muted-foreground">{mensaje}</p>}
            {sinSesion ? (
                <Link href="/login" className="mt-2 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                    Iniciar sesión
                </Link>
            ) : (
                onRetry && (
                    <Button variant="secondary" onClick={onRetry} className="mt-2">
                        Reintentar
                    </Button>
                )
            )}
        </div>
    );
}
