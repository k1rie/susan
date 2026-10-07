'use client';

import clsx from 'clsx';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { CONTROL_BASE, CONTROL_INVALIDO } from '../Input/Input.jsx';

// Área de texto; con showCount + maxLength muestra "n/max" (aria-live para lectores de pantalla).
//   autoGrow -> el alto sigue al contenido (desde `rows` hasta `maxRows`, si se indica; después aparece el scroll).
export default function Textarea({ rows = 3, maxRows, autoGrow = false, maxLength, showCount = false, invalid, value, className, ref, ...rest }) {
    const borde = invalid || rest['aria-invalid'] ? CONTROL_INVALIDO : 'border-input';
    const longitud = typeof value === 'string' ? value.length : 0;
    const interno = useRef(null);

    // El ref del consumidor y el propio conviven: React 19 pasa `ref` como una prop más.
    const asignar = useCallback(
        (el) => {
            interno.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
        },
        [ref],
    );

    useLayoutEffect(() => {
        const el = interno.current;
        if (!autoGrow || !el) return;
        el.style.height = 'auto';
        // jsdom no mide: sin scrollHeight real se deja el alto por `rows`.
        if (!el.scrollHeight) return;
        const estilo = window.getComputedStyle(el);
        const marcos = (parseFloat(estilo.borderTopWidth) || 0) + (parseFloat(estilo.borderBottomWidth) || 0);
        const relleno = (parseFloat(estilo.paddingTop) || 0) + (parseFloat(estilo.paddingBottom) || 0);
        const linea = parseFloat(estilo.lineHeight) || 20;
        const tope = maxRows ? linea * maxRows + relleno + marcos : Infinity;
        const alto = el.scrollHeight + marcos;
        el.style.height = `${Math.min(alto, tope)}px`;
        el.style.overflowY = alto > tope ? 'auto' : 'hidden';
    }, [autoGrow, maxRows, value]);

    return (
        <div className="flex flex-col gap-1">
            <textarea
                ref={asignar}
                rows={rows}
                maxLength={maxLength}
                value={value}
                className={clsx(CONTROL_BASE, 'py-2', autoGrow && 'resize-none', borde, className)}
                aria-invalid={invalid ? true : undefined}
                {...rest}
            />
            {showCount && maxLength != null && (
                <p aria-live="polite" className="text-right text-xs text-muted-foreground">
                    {longitud}/{maxLength}
                </p>
            )}
        </div>
    );
}
