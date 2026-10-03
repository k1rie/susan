import clsx from 'clsx';

const TONOS = {
    neutral: 'bg-surface-muted text-muted',
    info: 'text-justificado bg-justificado-bg',
    success: 'text-presente bg-presente-bg',
    warning: 'text-retardo bg-retardo-bg',
    danger: 'text-ausente bg-ausente-bg',
};

// Etiqueta genérica sin significado de dominio.
export default function Badge({ tone = 'neutral', children, className, ...rest }) {
    return (
        <span
            className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', TONOS[tone] || TONOS.neutral, className)}
            {...rest}
        >
            {children}
        </span>
    );
}
