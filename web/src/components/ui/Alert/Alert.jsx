import clsx from 'clsx';

const TONOS = {
    info: 'border-info text-info bg-justificado-bg',
    success: 'border-success text-presente bg-presente-bg',
    warning: 'border-warning text-retardo bg-retardo-bg',
    danger: 'border-danger text-ausente bg-ausente-bg',
};

// Aviso en línea. danger/warning usan role="alert" (se anuncian de inmediato); el resto role="status".
export default function Alert({ tone = 'info', title, onClose, children, className, ...rest }) {
    const urgente = tone === 'danger' || tone === 'warning';
    return (
        <div
            role={urgente ? 'alert' : 'status'}
            className={clsx('flex items-start gap-3 rounded-md border-l-4 p-3 text-sm', TONOS[tone] || TONOS.info, className)}
            {...rest}
        >
            <div className="min-w-0 flex-1">
                {title && <p className="font-semibold">{title}</p>}
                {children && <div className={clsx(title && 'mt-0.5')}>{children}</div>}
            </div>
            {onClose && (
                <button type="button" onClick={onClose} className="min-h-9 shrink-0 rounded px-2 font-medium underline">
                    Cerrar
                </button>
            )}
        </div>
    );
}
