import clsx from 'clsx';
import Link from 'next/link';
import Spinner from '../Spinner/Spinner.jsx';

const VARIANTES = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary-hover border border-transparent',
    secondary: 'bg-card text-foreground border border-border hover:bg-muted',
    danger: 'bg-destructive text-primary-foreground border border-transparent hover:opacity-90',
    ghost: 'bg-transparent text-foreground border border-transparent hover:bg-muted',
};
const TAMANOS = { md: 'min-h-11 px-4 text-sm', sm: 'min-h-9 px-3 text-sm' };

// Botón base. Con href se renderiza como enlace de Next; loading deshabilita sin cambiar el ancho.
export default function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    icon,
    fullWidth = false,
    href,
    children,
    className,
    ...rest
}) {
    const clases = clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        VARIANTES[variant] || VARIANTES.primary,
        TAMANOS[size] || TAMANOS.md,
        fullWidth && 'w-full',
        className,
    );
    const inactivo = disabled || loading;
    const contenido = (
        <>
            {loading ? <Spinner size="sm" label="Procesando" /> : icon}
            {children}
        </>
    );

    if (href && !inactivo) {
        return (
            <Link href={href} className={clases} {...rest}>
                {contenido}
            </Link>
        );
    }
    return (
        <button type={type} disabled={inactivo} aria-busy={loading ? 'true' : undefined} className={clases} {...rest}>
            {contenido}
        </button>
    );
}
