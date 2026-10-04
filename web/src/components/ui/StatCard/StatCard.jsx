import clsx from 'clsx';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import CountUp from '@/components/motion/CountUp';
import Sparkline from '@/components/ui/Sparkline';
import { limpiarSerie } from '@/components/ui/Sparkline/sparkline.utils.js';

// Pastilla del icono: gris en neutro y con el color del estado en los demás. El estado se dice con color + forma (cada tarjeta lleva su
// propio icono) y con el texto de apoyo, nunca solo con el color.
const PASTILLA = {
    neutral: 'bg-muted text-muted-foreground',
    success: 'bg-presente-bg text-presente',
    warning: 'bg-retardo-bg text-retardo',
    danger: 'bg-ausente-bg text-ausente',
};

// Texto de apoyo (`hint`): en tinta suave para lo neutro y con el color del estado cuando la tarjeta señala algo.
const APOYO = {
    neutral: 'text-muted-foreground',
    success: 'text-presente',
    warning: 'text-retardo',
    danger: 'text-ausente',
};

// Sin icono no hay pastilla que lleve el estado: la cifra toma el color (como antes de existir el icono).
const CIFRA_SIN_ICONO = {
    neutral: 'text-foreground',
    success: 'text-presente',
    warning: 'text-retardo',
    danger: 'text-ausente',
};

// Color de la línea de tendencia cuando no se indica `serieColor`: el mismo tono que el estado (neutral = azul de gráfica).
const COLOR_SERIE = {
    neutral: 'var(--chart-1)',
    success: 'var(--presente)',
    warning: 'var(--retardo)',
    danger: 'var(--ausente)',
};

// Tarjeta de cifra (referencia: las tarjetas de «Fitness» de Mobbin): arriba el icono en su pastilla y la etiqueta (hasta 2 líneas), abajo
// la cifra grande y, debajo, el texto de apoyo. Con href toda la tarjeta es un enlace y lleva una flecha arriba a la derecha.
//   label = qué mide · value = la cifra (número o texto ya formateado) · unit = sufijo pequeño pegado a la cifra («%», «/ 45»)
//   hint = una línea de apoyo (con tono, va en su color) · tone = neutral | success | warning | danger · icon = componente de Lucide
//   animated = una cifra numérica cuenta hasta su valor al entrar en vista (CountUp; sin animación con «reducir movimiento»)
//   serie = arreglo de números REALES (mínimo 2; nunca inventados) que dibuja una línea de tendencia a la derecha de la cifra; es
//           decorativa (aria-hidden): la tendencia debe decirse también en texto (`hint`). Sin serie válida, o con loading, no se dibuja.
//           serieColor = token (var(--ausente), var(--chart-5)…).
export default function StatCard({ label, value, unit, hint, href, tone = 'neutral', icon: Icono, loading = false, animated = false, serie, serieColor, className, ...rest }) {
    const estado = PASTILLA[tone] ? tone : 'neutral';
    const clases = clsx(
        'group/stat flex min-h-[7.5rem] flex-col rounded-xl border border-border bg-card p-4',
        href && 'transition-colors duration-150 hover:border-input hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
        className,
    );
    const conSerie = !loading && limpiarSerie(serie).length >= 2;
    const cuerpo = (
        <>
            <div className="flex items-center gap-2.5 text-[13px] font-medium leading-tight text-muted-foreground">
                {Icono && (
                    <span className={clsx('grid size-7 shrink-0 place-items-center rounded-md', PASTILLA[estado])}>
                        <Icono aria-hidden="true" strokeWidth={1.75} className="size-4" />
                    </span>
                )}
                <span className="line-clamp-2 min-w-0 flex-1" title={label}>{label}</span>
                {href && <ArrowUpRight aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 opacity-60 transition-opacity group-hover/stat:opacity-100" />}
            </div>
            <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                <div className="min-w-0">
                    <p className={clsx('text-[30px] font-semibold leading-none tracking-tight tabular-nums', Icono ? 'text-foreground' : CIFRA_SIN_ICONO[estado], conSerie && 'whitespace-nowrap')}>
                        {loading ? '-' : animated && typeof value === 'number' ? <CountUp to={value} duration={1.1} /> : value}
                        {unit && !loading && <span className="ml-1 text-sm font-medium tracking-normal text-muted-foreground">{unit}</span>}
                    </p>
                    {hint && <p className={clsx('mt-2 text-xs font-medium leading-snug', APOYO[estado])}>{hint}</p>}
                </div>
                {conSerie && (
                    // 80 x 28 px. En una tarjeta angosta la línea se encoge primero (shrink-[3]: cede 3 veces más que la cifra; el svg escala)
                    // y la cifra, que no se parte en dos líneas, solo cede cuando la línea ya está en su mínimo.
                    <div aria-hidden="true" className="w-20 min-w-8 max-w-[45%] shrink-[3]">
                        <Sparkline valores={serie} color={serieColor ?? COLOR_SERIE[estado]} ancho={80} alto={28} className="block h-auto w-full" />
                    </div>
                )}
            </div>
        </>
    );
    if (href) {
        return (
            <Link href={href} aria-busy={loading ? 'true' : undefined} className={clases} {...rest}>
                {cuerpo}
            </Link>
        );
    }
    return (
        <div aria-busy={loading ? 'true' : undefined} className={clases} {...rest}>
            {cuerpo}
        </div>
    );
}
