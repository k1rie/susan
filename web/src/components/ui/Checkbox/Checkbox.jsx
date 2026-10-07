import clsx from 'clsx';
import { useId } from 'react';

// Casilla nativa con texto asociado; toda la fila es zona táctil. indeterminate se aplica por ref.
//   error / invalid -> marca la casilla como inválida (aria-invalid) y, con `error`, escribe el motivo debajo (role="alert"):
//                      útil en acuses obligatorios («He leído el aviso de privacidad»).
export default function Checkbox({ label, children, checked, onChange, indeterminate = false, hint, error, invalid, disabled, className, id, 'aria-describedby': describedbyExterno, ...rest }) {
    const generado = useId();
    const inputId = id || generado;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedby = [describedbyExterno, hintId, errorId].filter(Boolean).join(' ') || undefined;
    const esInvalido = Boolean(error || invalid || rest['aria-invalid']);
    return (
        <div className={clsx('flex flex-col', className)}>
            <label htmlFor={inputId} className={clsx('flex min-h-11 items-center gap-3 text-sm', disabled && 'opacity-60')}>
                <input
                    id={inputId}
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    aria-describedby={describedby}
                    aria-invalid={esInvalido ? true : undefined}
                    ref={(el) => {
                        if (el) el.indeterminate = indeterminate;
                    }}
                    className={clsx(
                        'h-5 w-5 shrink-0 rounded-md accent-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
                        esInvalido && 'outline outline-2 outline-offset-2 outline-destructive',
                    )}
                    {...rest}
                />
                <span>{label ?? children}</span>
            </label>
            {hint && (
                <p id={hintId} className="pl-8 text-xs text-muted-foreground">
                    {hint}
                </p>
            )}
            {error && (
                <p id={errorId} role="alert" className="pl-8 text-sm text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
