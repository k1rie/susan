import clsx from 'clsx';
import Link from 'next/link';

const TONOS = {
    neutral: 'text-foreground',
    success: 'text-presente',
    warning: 'text-retardo',
    danger: 'text-ausente',
};

// Contador resumido; con href toda la tarjeta es un enlace (se eleva al pasar el cursor).
// La cifra va en la serif de marca (font-display). Para animarla, pasar <CountUp/> como `value`.
export default function StatCard({ label, value, hint, href, tone = 'neutral', loading = false, className, ...rest }) {
    const clases = clsx(
        'block rounded-3xl border border-border bg-card p-5 shadow-soft',
        href && 'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
        className,
    );
    const cuerpo = (
        <>
            <p className={clsx('font-display text-4xl leading-none tracking-tight tabular-nums', TONOS[tone] || TONOS.neutral)}>{loading ? '-' : value}</p>
            <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
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
