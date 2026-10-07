'use client';

import clsx from 'clsx';
import { Check, X } from 'lucide-react';
import { emitirCambio } from '@/lib/formularios/dom.js';
import { mayusculas, minusculas, recortar } from '@/lib/formularios/texto.js';

// Base compartida por Input/Select/Textarea: 8 px de radio, borde de entrada, 40 px de alto y anillo de foco suave.
export const CONTROL_BASE =
    'w-full min-h-10 rounded-md border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground ' +
    'transition-[border-color,box-shadow] duration-150 ' +
    'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 ' +
    'disabled:bg-muted disabled:opacity-70';

// Borde de un campo inválido. Se repite en foco con `!`: sin eso, `focus-visible:border-ring` de CONTROL_BASE (misma especificidad que una
// variante de foco propia) pintaba el campo de azul justo cuando la persona vuelve a él a corregirlo, y el rojo solo se veía fuera de foco.
export const CONTROL_INVALIDO = 'border-destructive focus-visible:border-destructive! focus-visible:ring-destructive/20!';

const TRANSFORMACIONES = { upper: mayusculas, lower: minusculas, trim: recortar };

// Relleno derecho (rem) que reserva cada elemento del borde derecho para que el texto no quede debajo de ellos.
const ANCHO_FIN = 2.5;
const ANCHO_LIMPIAR = 2.25;
const ANCHO_VALIDO = 1.75;
const ANCHO_CONTADOR = 3.5;

// Campo de texto nativo con extras opcionales que no cambian el DOM cuando no se usan:
//   endAdornment    -> nodo a la derecha dentro del borde (p. ej. el botón de mostrar contraseña).
//   startAdornment  -> nodo a la izquierda dentro del borde (icono Lucide de búsqueda, prefijo, etc.).
//   onClear         -> muestra una X (Lucide) cuando hay texto; al pulsarla se llama a onClear() y el foco vuelve al campo.
//   showCount       -> con maxLength, muestra «n/max» dentro del campo (no desplaza el diseño: no ocupa otra línea).
//   transform       -> 'upper' | 'lower' | 'trim' o una función (valor) => valor; se aplica AL SALIR del campo y llega a
//                      onChange como un evento real (e.target.value ya transformado), nunca mientras se escribe.
//   valid           -> palomita (Lucide) a la derecha; el texto «Válido» va en sr-only. Si hay invalid, no se muestra.
export default function Input({
    type = 'text',
    invalid,
    valid = false,
    endAdornment,
    startAdornment,
    onClear,
    clearLabel = 'Limpiar campo',
    showCount = false,
    transform,
    onBlur,
    style,
    className,
    ...rest
}) {
    const esInvalido = Boolean(invalid || rest['aria-invalid']);
    const borde = esInvalido ? CONTROL_INVALIDO : 'border-input';
    const texto = rest.value !== undefined && rest.value !== null ? String(rest.value) : null;
    const conLimpiar = Boolean(onClear) && texto !== null && texto.length > 0 && !rest.disabled && !rest.readOnly;
    // Sin `value` (no controlado) no se sabe cuánto se escribió: el contador solo existe en campos controlados.
    const conContador = showCount && rest.maxLength != null && texto !== null;
    const alLimite = conContador && texto.length >= rest.maxLength;
    const conValido = valid && !esInvalido;
    const hayDerecha = Boolean(endAdornment) || conLimpiar || conContador || conValido;
    const hayExtras = hayDerecha || Boolean(startAdornment);

    const alSalir = (e) => {
        const aplicar = typeof transform === 'function' ? transform : TRANSFORMACIONES[transform];
        if (aplicar) {
            const actual = e.target.value;
            const nuevo = aplicar(actual);
            if (nuevo !== actual) emitirCambio(e.target, nuevo);
        }
        onBlur?.(e);
    };

    const relleno = hayDerecha
        ? (endAdornment ? ANCHO_FIN : 0) + (conLimpiar ? ANCHO_LIMPIAR : 0) + (conValido ? ANCHO_VALIDO : 0) + (conContador ? ANCHO_CONTADOR : 0)
        : null;

    const input = (
        <input
            type={type}
            className={clsx(CONTROL_BASE, borde, startAdornment && 'pl-10', !hayExtras && className)}
            style={relleno ? { paddingRight: `${relleno}rem`, ...style } : style}
            onBlur={transform || onBlur ? alSalir : undefined}
            aria-invalid={invalid ? true : undefined}
            {...rest}
        />
    );
    if (!hayExtras) return input;

    const limpiar = (e) => {
        onClear();
        // Devuelve el foco al campo: quien limpia suele seguir escribiendo.
        e.currentTarget.closest('[data-campo]')?.querySelector('input')?.focus();
    };

    return (
        <div data-campo="" className={clsx('relative', className)}>
            {startAdornment && (
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">{startAdornment}</span>
            )}
            {input}
            {hayDerecha && (
                <span className="absolute inset-y-0 right-2 flex items-center gap-0.5 text-muted-foreground">
                    {conContador && (
                        <>
                            <span className="pr-1 text-xs tabular-nums" aria-hidden="true">
                                {texto.length}/{rest.maxLength}
                            </span>
                            <span role="status" className="sr-only">
                                {alLimite ? `Límite de ${rest.maxLength} caracteres alcanzado.` : ''}
                            </span>
                        </>
                    )}
                    {conValido && (
                        <span className="inline-flex items-center text-presente">
                            <Check aria-hidden="true" className="size-4" strokeWidth={2} />
                            <span className="sr-only">Válido</span>
                        </span>
                    )}
                    {conLimpiar && (
                        <button
                            type="button"
                            onClick={limpiar}
                            aria-label={clearLabel}
                            className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                        >
                            <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
                        </button>
                    )}
                    {endAdornment}
                </span>
            )}
        </div>
    );
}
