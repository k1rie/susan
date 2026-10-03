import clsx from 'clsx';
import Link from 'next/link';

// Fondos de la portada por tono (pastel plano, como "Get Started with Dash") y el trazo del icono.
const TONO = {
    azul: ['bg-tono-azul', 'var(--tono-azul-fg)'],
    dorado: ['bg-tono-dorado', 'var(--tono-dorado-fg)'],
    verde: ['bg-tono-verde', 'var(--tono-verde-fg)'],
    violeta: ['bg-tono-violeta', 'var(--tono-violeta-fg)'],
    rosa: ['bg-tono-rosa', 'var(--tono-rosa-fg)'],
};
// Portada en degradado (como "SLMobbin Knowledge Base"): para el módulo que se quiere destacar.
const DEGRADADO = 'linear-gradient(105deg, #ff6aa9 0%, #ffb36b 28%, #8be3b5 58%, #6bb8ff 100%)';

// Tarjeta de portada (componente firma, referencia: Stacks de Dropbox Dash): franja superior de color con el icono en una
// ficha blanca, título en dos líneas, línea de meta y pie. Todo el cuerpo es un enlace (o un botón con onClick).
//   icono    componente de Lucide · tono azul|dorado|verde|violeta|rosa · portada 'plana'|'degradado'
//   meta     texto gris bajo el título · pie  contenido de la fila inferior (p. ej. candado + «Próximamente»)
export default function TarjetaPortada({ icono: Icono, tono = 'azul', portada = 'plana', titulo, meta, pie, href, onClick, className, ...rest }) {
    const [fondo, trazo] = TONO[tono] || TONO.azul;
    const Etiqueta = href ? Link : 'button';
    const propsEtiqueta = href ? { href } : { type: 'button', onClick };
    return (
        <Etiqueta
            {...propsEtiqueta}
            className={clsx(
                'group/tarjeta flex h-full min-h-[12.25rem] w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left',
                'transition-[border-color,background-color] duration-150 hover:border-input hover:bg-accent/30',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
                className,
            )}
            {...rest}
        >
            <div
                className={clsx('relative h-[4.5rem] shrink-0', portada === 'plana' && fondo)}
                style={portada === 'degradado' ? { background: DEGRADADO } : undefined}
            >
                {Icono && (
                    <span className="absolute left-4 top-4 flex size-9 items-center justify-center rounded-lg border border-black/5 bg-card shadow-[0_1px_2px_rgba(30,25,25,0.08)] transition-transform duration-200 group-hover/tarjeta:-translate-y-0.5">
                        <Icono aria-hidden="true" className="size-[18px]" strokeWidth={1.75} style={{ color: trazo }} />
                    </span>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-1 px-4 pb-4 pt-3.5">
                <p className="line-clamp-2 text-[14.5px] font-medium leading-snug">{titulo}</p>
                {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
                {pie && <div className="mt-auto flex items-center gap-1.5 pt-3 text-[13px] text-muted-foreground">{pie}</div>}
            </div>
        </Etiqueta>
    );
}
