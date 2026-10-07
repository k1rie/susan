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

// Cuántas líneas ocupan el título y el subtítulo. Por omisión una sola con «…» (las listas densas conservan su alto); con 2 o 3 se corta
// con `line-clamp` y se parte la palabra que no quepa (`break-words`); 'todas' no corta. Clases completas, no interpoladas, para el compilador
// de Tailwind. Con más de una línea el elemento NO lleva `block`: `line-clamp` ya lo hace bloque (-webkit-box) y dos `display` chocarían.
const LINEAS = {
    1: { titulo: 'block truncate', subtitulo: 'block truncate' },
    2: { titulo: 'line-clamp-2 break-words', subtitulo: 'line-clamp-2 break-words' },
    3: { titulo: 'line-clamp-3 break-words', subtitulo: 'line-clamp-3 break-words' },
    todas: { titulo: 'block break-words', subtitulo: 'block break-words' },
};

// Tarjeta de fila (componente firma, referencia: tarjetas de apps de Dropbox Dash): ficha con el icono a la izquierda, título +
// subtítulo al centro y una acción circular a la derecha (`accion`: p. ej. un botón de Lucide). Con href toda la fila es un enlace;
// si lleva `accion` interactiva, pasa `href` solo cuando la acción sea decorativa (no anides controles dentro de un enlace).
//   lineas  1 (por omisión, una línea con «…») | 2 | 3 | 'todas': líneas que pueden ocupar título y subtítulo (ver LINEAS).
export default function TarjetaFila({ icono: Icono, tono = 'azul', titulo, subtitulo, accion, href, as, lineas = 1, children, className, ...rest }) {
    const [fondo, trazo] = TONO[tono] || TONO.neutro;
    const clasesLineas = LINEAS[lineas] || LINEAS[1];
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
                <span className={clsx(clasesLineas.titulo, 'text-[14.5px] font-medium leading-tight')}>{titulo}</span>
                {subtitulo && <span className={clsx('mt-0.5', clasesLineas.subtitulo, 'text-[13px] text-muted-foreground')}>{subtitulo}</span>}
                {children}
            </span>
            {accion && <span className="shrink-0">{accion}</span>}
        </Etiqueta>
    );
}
