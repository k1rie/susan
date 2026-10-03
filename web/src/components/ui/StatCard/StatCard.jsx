import clsx from 'clsx';
import Link from 'next/link';

const TONOS = {
    neutral: 'text-foreground',
    success: 'text-presente',
    warning: 'text-retardo',
    danger: 'text-ausente',
};

// Contador resumido; con href toda la tarjeta es un enlace.
export default function StatCard({ label, value, hint, href, tone = 'neutral', loading = false, className, ...rest }) {
    const clases = clsx('block rounded-lg border border-border bg-surface p-4', href && 'hover:bg-surface-muted', className);
    const cuerpo = (
        <>
            <p className={clsx('text-3xl font-semibold', TONOS[tone] || TONOS.neutral)}>{loading ? '-' : value}</p>
            <p className="mt-1 text-sm text-muted">{label}</p>
            {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
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
