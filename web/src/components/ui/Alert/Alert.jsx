import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';

const TONOS = {
    info: { caja: 'border-info/25 text-info bg-justificado-bg', icono: Info },
    success: { caja: 'border-success/25 text-presente bg-presente-bg', icono: CheckCircle2 },
    warning: { caja: 'border-warning/30 text-retardo bg-retardo-bg', icono: AlertTriangle },
    danger: { caja: 'border-destructive/25 text-ausente bg-ausente-bg', icono: OctagonAlert },
};

// Aviso en línea. danger/warning usan role="alert" (se anuncian de inmediato); el resto role="status".
// El icono refuerza el tono (nunca solo color). `compact`: versión baja (menos relleno e icono más chico) para avisos dentro de
// formularios, diálogos y pies de asistente; por omisión el aviso es el de siempre.
export default function Alert({ tone = 'info', title, onClose, compact = false, children, className, ...rest }) {
    const urgente = tone === 'danger' || tone === 'warning';
    const { caja, icono: Icono } = TONOS[tone] || TONOS.info;
    return (
        <div
            role={urgente ? 'alert' : 'status'}
            className={clsx('flex items-start border text-sm', compact ? 'gap-2 rounded-lg p-2.5 text-[13px]' : 'gap-3 rounded-xl p-3.5', caja, className)}
            {...rest}
        >
            <Icono aria-hidden="true" className={clsx('shrink-0', compact ? 'mt-px size-4' : 'mt-0.5 size-[18px]')} strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
                {title && <p className="font-semibold">{title}</p>}
                {children && <div className={clsx(title && 'mt-0.5')}>{children}</div>}
            </div>
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    className={clsx(
                        'shrink-0 rounded-md font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
                        compact ? 'min-h-7 px-2' : 'min-h-9 px-3',
                    )}
                >
                    Cerrar
                </button>
            )}
        </div>
    );
}
