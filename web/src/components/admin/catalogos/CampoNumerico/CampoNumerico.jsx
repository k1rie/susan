'use client';

import { Minus, Plus } from 'lucide-react';
import Input from '@/components/ui/Input';
import { limpiarDigitos, pasarValor } from './campoNumerico.utils.js';

const BOTON =
    'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground ' +
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-40';

/**
 * Entero con «−» y «+» además de teclear (referencia: P9, capacidad del aula con control +/−). Es un campo de texto numérico y no
 * `type="number"` para que no cambie con la rueda del ratón ni muestre las flechas nativas; admite ↑ y ↓ con el teclado.
 *
 *   value / onChange(texto)  el valor es TEXTO de dígitos y `onChange` recibe el texto (como las piezas de elección), así que
 *                            `useFormulario().campo(...).props` se esparce tal cual.
 *   min / max / inicio       límites de los botones (la validación del formulario es aparte); `inicio` = valor del primer «+» en vacío.
 *   nombre                   sustantivo para el nombre accesible de los botones («Disminuir capacidad»).
 *   maxDigitos               4 por omisión. El resto de props (id, name, invalid, onBlur, aria-*) va al campo.
 */
export default function CampoNumerico({ value = '', onChange, min = 0, max = 9999, inicio, nombre = 'valor', maxDigitos = 4, disabled, ...rest }) {
    const mover = (paso) => onChange?.(pasarValor(value, paso, { min, max, inicio }));
    const texto = String(value ?? '');
    const actual = texto === '' ? null : Number(texto);

    return (
        <Input
            inputMode="numeric"
            autoComplete="off"
            maxLength={maxDigitos}
            value={texto}
            disabled={disabled}
            onChange={(e) => onChange?.(limpiarDigitos(e.target.value, maxDigitos))}
            onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    mover(e.key === 'ArrowUp' ? 1 : -1);
                }
            }}
            // Dos botones de 32 px + hueco: más que el relleno por omisión de un solo adorno.
            style={{ paddingRight: '5rem' }}
            endAdornment={
                <span className="-mr-1 flex items-center gap-0.5">
                    <button type="button" tabIndex={-1} className={BOTON} disabled={disabled || (actual !== null && actual <= min)} onClick={() => mover(-1)} aria-label={`Disminuir ${nombre}`}>
                        <Minus aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    </button>
                    <button type="button" tabIndex={-1} className={BOTON} disabled={disabled || (actual !== null && actual >= max)} onClick={() => mover(1)} aria-label={`Aumentar ${nombre}`}>
                        <Plus aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    </button>
                </span>
            }
            {...rest}
        />
    );
}
