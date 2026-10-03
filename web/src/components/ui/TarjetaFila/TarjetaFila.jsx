import clsx from 'clsx';
import Link from 'next/link';

const TONO = {
    azul: ['bg-tono-azul', 'var(--tono-azul-fg)'],
    dorado: ['bg-tono-dorado', 'var(--tono-dorado-fg)'],
    verde: ['bg-tono-verde', 'var(--tono-verde-fg)'],
    violeta: ['bg-tono-violeta', 'var(--tono-violeta-fg)'],
    rosa: ['bg-tono-rosa', 'var(--tono-rosa-fg)'],
    neutro: ['bg-muted', 'var(--muted-foreground)'],
};

// Tarjeta de fila (componente firma, referencia: tarjetas de apps de Dropbox Dash): ficha con el icono a la izquierda, título +
// subtítulo al centro y una acción circular a la derecha (`accion`: p. ej. un botón de Lucide). Con href toda la fila es un enlace;
// si lleva `accion` interactiva, pasa `href` solo cuando la acción sea decorativa (no anides controles dentro de un enlace).
export default function TarjetaFila({ icono: Icono, tono = 'azul', titulo, subtitulo, accion, href, as, children, className, ...rest }) {
    const [fondo, trazo] = TONO[tono] || TONO.neutro;
    const Etiqueta = as || (href ? Link : 'div');
    const props = href && !as ? { href } : {};
    return (
        <Etiqueta
            {...props}
            className={clsx(
                'flex min-h-[4.5rem] items-center gap-4 rounded-xl border border-border bg-card p-4 text-left',
                href && 'transition-colors duration-150 hover:border-input hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
                className,
            )}
            {...rest}
        >
            {Icono && (
                <span className={clsx('flex size-10 shrink-0 items-center justify-center rounded-lg', fondo)}>
                    <Icono aria-hidden="true" className="size-5" strokeWidth={1.75} style={{ color: trazo }} />
                </span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium leading-tight">{titulo}</span>
                {subtitulo && <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{subtitulo}</span>}
                {children}
            </span>
            {accion && <span className="shrink-0">{accion}</span>}
        </Etiqueta>
    );
}
