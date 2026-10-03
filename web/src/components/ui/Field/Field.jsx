import clsx from 'clsx';
import { cloneElement, useId } from 'react';

// Envuelve un único control: genera el id, enlaza hint/error con aria-describedby y marca aria-invalid.
export default function Field({ label, hint, error, required = false, htmlFor, children, className }) {
    const generado = useId();
    const id = htmlFor || children.props.id || generado;
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedby = [children.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={clsx('flex flex-col gap-1', className)}>
            <label htmlFor={id} className="text-sm font-medium">
                {label}
                {required && <span aria-hidden="true" className="text-destructive"> *</span>}
            </label>
            {cloneElement(children, {
                id,
                'aria-describedby': describedby,
                'aria-invalid': error ? true : undefined,
                required: required || children.props.required,
            })}
            {hint && (
                <p id={hintId} className="text-xs text-muted-foreground">
                    {hint}
                </p>
            )}
            {error && (
                <p id={errorId} role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
