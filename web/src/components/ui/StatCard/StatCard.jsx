import clsx from 'clsx';
import Link from 'next/link';
import CountUp from '@/components/motion/CountUp';

const TONOS = {
    neutral: 'text-foreground',
    success: 'text-presente',
    warning: 'text-retardo',
    danger: 'text-ausente',
};

// Contador resumido; con href toda la tarjeta es un enlace. `animated` hace que una cifra numérica cuente hasta su
// valor al entrar en vista (CountUp; sin animación con "reducir movimiento"); para cualquier otro valor se muestra tal cual.
export default function StatCard({ label, value, hint, href, tone = 'neutral', loading = false, animated = false, className, ...rest }) {
    const clases = clsx(
        'block rounded-xl border border-border bg-card p-4',
        href && 'transition-colors duration-150 hover:border-input hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
        className,
    );
    const cuerpo = (
        <>
            <p className={clsx('text-[28px] font-semibold leading-none tracking-tight tabular-nums', TONOS[tone] || TONOS.neutral)}>
                {loading ? '-' : animated && typeof value === 'number' ? <CountUp to={value} duration={1.1} /> : value}
            </p>
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
