'use client';

import clsx from 'clsx';
import { useId, useRef, useState } from 'react';
import Button from '../Button/Button.jsx';
import { formatearBytes, validarArchivo } from './fileInput.utils.js';

// Selector de archivo con validación inmediata de tipo y tamaño; el control nativo queda oculto.
export default function FileInput({
    value = null,
    onSelect,
    accept,
    maxBytes,
    capture,
    label = 'Seleccionar archivo',
    error,
    disabled = false,
    className,
}) {
    const inputRef = useRef(null);
    const errorId = useId();
    const [errorLocal, setErrorLocal] = useState(null);
    const mensaje = error || errorLocal;

    const alElegir = (e) => {
        const file = e.target.files?.[0] || null;
        // Permite volver a elegir el mismo archivo después de quitarlo o rechazarlo.
        e.target.value = '';
        if (!file) return;
        const motivo = validarArchivo(file, { accept, maxBytes });
        if (motivo) {
            setErrorLocal(motivo);
            onSelect(null);
            return;
        }
        setErrorLocal(null);
        onSelect(file);
    };

    const quitar = () => {
        setErrorLocal(null);
        onSelect(null);
    };

    return (
        <div className={clsx('flex flex-col gap-2', className)}>
            <input
                ref={inputRef}
                type="file"
                hidden
                accept={accept}
                capture={capture}
                disabled={disabled}
                onChange={alElegir}
                data-testid="file-input"
            />
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => inputRef.current?.click()}
                    aria-describedby={mensaje ? errorId : undefined}
                >
                    {label}
                </Button>
                {value && (
                    <>
                        <span className="min-w-0 truncate text-sm">
                            {value.name} ({formatearBytes(value.size)})
                        </span>
                        <Button variant="ghost" size="sm" onClick={quitar} disabled={disabled}>
                            Quitar
                        </Button>
                    </>
                )}
            </div>
            {mensaje && (
                <p id={errorId} role="alert" className="text-sm text-destructive">
                    {mensaje}
                </p>
            )}
        </div>
    );
}
