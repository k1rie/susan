import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';

const TONOS = {
    info: { caja: 'border-info/25 text-info bg-justificado-bg', icono: Info },
    success: { caja: 'border-success/25 text-presente bg-presente-bg', icono: CheckCircle2 },
    warning: { caja: 'border-warning/30 text-retardo bg-retardo-bg', icono: AlertTriangle },
    danger: { caja: 'border-destructive/25 text-ausente bg-ausente-bg', icono: OctagonAlert },
};

// Aviso en línea. danger/warning usan role="alert" (se anuncian de inmediato); el resto role="status".
// El icono refuerza el tono (nunca solo color).
export default function Alert({ tone = 'info', title, onClose, children, className, ...rest }) {
    const urgente = tone === 'danger' || tone === 'warning';
    const { caja, icono: Icono } = TONOS[tone] || TONOS.info;
    return (
        <div
            role={urgente ? 'alert' : 'status'}
            className={clsx('flex items-start gap-3 rounded-xl border p-3.5 text-sm', caja, className)}
            {...rest}
        >
            <Icono aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
                {title && <p className="font-semibold">{title}</p>}
                {children && <div className={clsx(title && 'mt-0.5')}>{children}</div>}
            </div>
            {onClose && (
                <button type="button" onClick={onClose} className="min-h-9 shrink-0 rounded-md px-3 font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
                    Cerrar
                </button>
            )}
        </div>
    );
}
