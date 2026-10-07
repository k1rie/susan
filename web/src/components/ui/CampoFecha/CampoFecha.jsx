'use client';

import clsx from 'clsx';
import { useRef } from 'react';
import { emitirCambio } from '@/lib/formularios/dom.js';
import { formatearFechaLarga } from '@/lib/formularios/fechas.js';
import Input from '../Input/Input.jsx';
import { ATAJO_HOY, resolverAtajos } from './campoFecha.utils.js';
import { useHoy } from './useHoy.js';

// Fecha de captura: <input type="date"> con límites, atajos y la fecha escrita en palabras («lunes, 5 de octubre de 2026»),
// porque el selector nativo cambia de formato con el sistema operativo. No hay calendario propio (decisión de la auditoría).
//
//   value / onChange(e)  -> como cualquier Input: e.target.value es 'AAAA-MM-DD' o ''. Los atajos disparan ese mismo evento.
//   min / max            -> 'AAAA-MM-DD'. Los atajos que caen fuera se ocultan.
//   atajos               -> [{ label, valor: 'AAAA-MM-DD' | ({ actual, hoy }) => 'AAAA-MM-DD' }]. Por omisión solo «Hoy»;
//                           atajos={[]} los quita. «+1 año» respecto a otro campo: valor: () => sumarAnios(firma, 1).
//   hoy                  -> fecha que usa «Hoy» (por omisión la del navegador; pasa la del servidor si importa).
//   mostrarTexto         -> escribe la fecha en palabras bajo el campo (por omisión sí).
// Para validar usa `validarFecha` de ./campoFecha.utils.js y muestra el mensaje con ui/Field.
export default function CampoFecha({
    value,
    onChange,
    min,
    max,
    atajos = [ATAJO_HOY],
    hoy,
    mostrarTexto = true,
    disabled = false,
    invalid,
    className,
    ...rest
}) {
    const inputRef = useRef(null);
    const referencia = useHoy(hoy);
    const visibles = resolverAtajos(atajos, { actual: value ?? '', hoy: referencia, min, max });
    const texto = mostrarTexto ? formatearFechaLarga(value) : '';

    const aplicar = (fecha) => {
        // Se escribe en el <input> nativo y se avisa como si la persona lo hubiera tecleado: onChange recibe un evento real.
        emitirCambio(inputRef.current, fecha);
        inputRef.current?.focus();
    };

    return (
        <div className={clsx('flex flex-col gap-1.5', className)}>
            <Input ref={inputRef} type="date" value={value} onChange={onChange} min={min} max={max} disabled={disabled} invalid={invalid} {...rest} />
            {mostrarTexto && (
                <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
                    {texto}
                </p>
            )}
            {visibles.length > 0 && (
                <div role="group" aria-label="Atajos de fecha" className="flex flex-wrap gap-2">
                    {visibles.map((a) => (
                        <button
                            key={`${a.label}-${a.fecha}`}
                            type="button"
                            disabled={disabled}
                            onClick={() => aplicar(a.fecha)}
                            className="inline-flex min-h-9 items-center rounded-full bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {a.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
