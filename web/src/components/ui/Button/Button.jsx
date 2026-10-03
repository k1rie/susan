import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Spinner from '../Spinner/Spinner.jsx';

// Píldora con foco visible en anillo. Primario = azul UNACH con sombra suave; secundario = blanco con borde.
const VARIANTES = {
    primary: 'bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover border border-transparent',
    secondary: 'bg-card text-foreground border border-border shadow-xs hover:bg-muted',
    danger: 'bg-destructive text-primary-foreground border border-transparent hover:opacity-90',
    ghost: 'bg-transparent text-foreground border border-transparent hover:bg-accent hover:text-accent-foreground',
};
// Círculo de la flecha: contraste contra el fondo de cada variante.
const CIRCULO = {
    primary: 'bg-primary-foreground/20 text-primary-foreground',
    secondary: 'bg-foreground text-background',
    danger: 'bg-primary-foreground/20 text-primary-foreground',
    ghost: 'bg-foreground text-background',
};
const TAMANOS = { md: 'min-h-11 px-5 text-sm', sm: 'min-h-9 px-4 text-sm' };

// Botón base. Con href se renderiza como enlace de Next; loading deshabilita sin cambiar el ancho.
// `arrow` añade el círculo con flecha de la identidad de SUSAN (componente firma): se desliza al pasar el cursor.
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
        'group/btn inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap',
        'transition-[background-color,box-shadow,transform,opacity] duration-200 active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        VARIANTES[variant] || VARIANTES.primary,
        TAMANOS[size] || TAMANOS.md,
        arrow && (size === 'sm' ? 'pr-1.5' : 'pr-1.5'),
        fullWidth && 'w-full',
        className,
    );
    const inactivo = disabled || loading;
    const contenido = (
        <>
            {loading ? <Spinner size="sm" label="Procesando" /> : icon}
            {children}
            {arrow && !loading && (
                <span
                    aria-hidden="true"
                    className={clsx(
                        'ml-1 inline-flex shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover/btn:translate-x-0.5',
                        size === 'sm' ? 'size-6' : 'size-8',
                        CIRCULO[variant] || CIRCULO.primary,
                    )}
                >
                    <ArrowRight className="size-4" strokeWidth={1.75} />
                </span>
            )}
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
