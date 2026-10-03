import clsx from 'clsx';
import { useId } from 'react';

// Casilla nativa con texto asociado; toda la fila es zona táctil. indeterminate se aplica por ref.
export default function Checkbox({ label, children, checked, onChange, indeterminate = false, hint, disabled, className, id, ...rest }) {
    const generado = useId();
    const inputId = id || generado;
    const hintId = hint ? `${inputId}-hint` : undefined;
    return (
        <div className={clsx('flex flex-col', className)}>
            <label htmlFor={inputId} className={clsx('flex min-h-11 items-center gap-3 text-sm', disabled && 'opacity-60')}>
                <input
                    id={inputId}
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    aria-describedby={hintId}
                    ref={(el) => {
                        if (el) el.indeterminate = indeterminate;
                    }}
                    className="h-5 w-5 shrink-0 accent-primary"
                    {...rest}
                />
                <span>{label ?? children}</span>
            </label>
            {hint && (
                <p id={hintId} className="pl-8 text-xs text-muted">
                    {hint}
                </p>
            )}
        </div>
    );
}
