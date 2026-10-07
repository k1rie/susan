'use client';

import clsx from 'clsx';
import { useId } from 'react';

// Interruptor de efecto inmediato (role="switch"): para ajustes que se aplican al cambiar, como «Reconstrucción completa» o
// activo/inactivo. Para algo que solo cuenta al enviar el formulario usa ui/Checkbox.
//   checked / onChange(checked: boolean)   -> controlado; onChange recibe el valor NUEVO, no un evento.
//   label / hint                           -> texto y ayuda; pulsar el texto también alterna.
//   showState                              -> escribe «Activado» / «Desactivado» junto al control (el estado no es solo color).
//   onLabel / offLabel                     -> textos de ese estado.
//   name                                   -> agrega un <input type="hidden"> con "true"/"false" para formularios nativos.
export default function Switch({
    checked = false,
    onChange,
    label,
    hint,
    disabled = false,
    showState = true,
    onLabel = 'Activado',
    offLabel = 'Desactivado',
    id,
    name,
    className,
    'aria-describedby': describedbyExterno,
    ...rest
}) {
    const generado = useId();
    const switchId = id || generado;
    const hintId = hint ? `${switchId}-hint` : undefined;
    const describedby = [describedbyExterno, hintId].filter(Boolean).join(' ') || undefined;
    const activo = Boolean(checked);

    return (
        <div className={clsx('flex flex-col', className)}>
            <div className={clsx('flex min-h-11 items-center gap-3', disabled && 'opacity-60')}>
                <button
                    type="button"
                    role="switch"
                    id={switchId}
                    aria-checked={activo}
                    aria-describedby={describedby}
                    disabled={disabled}
                    onClick={() => onChange?.(!activo)}
                    className={clsx(
                        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 motion-reduce:transition-none',
                        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:cursor-not-allowed',
                        activo ? 'border-primary bg-primary' : 'border-input bg-muted',
                    )}
                    {...rest}
                >
                    <span
                        aria-hidden="true"
                        className={clsx(
                            'pointer-events-none inline-block size-5 rounded-full border transition-transform duration-150 motion-reduce:transition-none',
                            activo ? 'translate-x-5 border-transparent bg-primary-foreground' : 'translate-x-0.5 border-input bg-card',
                        )}
                    />
                </button>
                {label && (
                    <label htmlFor={switchId} className={clsx('min-w-0 flex-1 text-sm', !disabled && 'cursor-pointer')}>
                        {label}
                    </label>
                )}
                {showState && (
                    <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground">
                        {activo ? onLabel : offLabel}
                    </span>
                )}
            </div>
            {hint && (
                <p id={hintId} className="pl-14 text-xs text-muted-foreground">
                    {hint}
                </p>
            )}
            {name && <input type="hidden" name={name} value={activo ? 'true' : 'false'} />}
        </div>
    );
}
