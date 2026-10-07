import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Spinner from '../Spinner/Spinner.jsx';

// Botones de 8 px de radio (referencia: Dropbox Dash). Primario = tinta casi negra; secundario = blanco con borde.
const VARIANTES = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary-hover border border-transparent',
    secondary: 'bg-card text-foreground border border-input hover:bg-accent',
    danger: 'bg-destructive text-primary-foreground border border-transparent hover:opacity-90',
    ghost: 'bg-transparent text-foreground border border-transparent hover:bg-accent',
};
const TAMANOS = { lg: 'min-h-12 px-5 text-[15px]', md: 'min-h-10 px-4 text-sm', sm: 'min-h-8 px-3 text-[13px]' };

// Botón base. Con href se renderiza como enlace de Next; loading deshabilita sin cambiar el ancho.
// `arrow` añade una flecha (Lucide) al final.
export default function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    icon,
    arrow = false,
    fullWidth = false,
    href,
    children,
    className,
    ...rest
}) {
    const clases = clsx(
        'group/btn inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap',
        'transition-[background-color,border-color,opacity] duration-150',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
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
            {arrow && !loading && <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-150 group-hover/btn:translate-x-0.5" strokeWidth={1.75} />}
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
