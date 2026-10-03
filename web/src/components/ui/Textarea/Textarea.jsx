import clsx from 'clsx';
import { CONTROL_BASE } from '../Input/Input.jsx';

// Área de texto; con showCount + maxLength muestra "n/max" (aria-live para lectores de pantalla).
export default function Textarea({ rows = 3, maxLength, showCount = false, invalid, value, className, ...rest }) {
    const borde = invalid || rest['aria-invalid'] ? 'border-danger' : 'border-border';
    const longitud = typeof value === 'string' ? value.length : 0;
    return (
        <div className="flex flex-col gap-1">
            <textarea
                rows={rows}
                maxLength={maxLength}
                value={value}
                className={clsx(CONTROL_BASE, 'py-2', borde, className)}
                {...rest}
            />
            {showCount && maxLength != null && (
                <p aria-live="polite" className="text-right text-xs text-muted">
                    {longitud}/{maxLength}
                </p>
            )}
        </div>
    );
}
