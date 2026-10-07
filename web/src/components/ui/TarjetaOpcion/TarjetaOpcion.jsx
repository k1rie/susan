'use client';

import clsx from 'clsx';
import { Circle, CircleCheck } from 'lucide-react';
import { useId } from 'react';

// Columnas por ancho: siempre una columna en teléfono, y el número pedido desde `sm`.
const COLUMNAS = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

// Opciones con consecuencias que conviene explicar (rol de usuario, tipo de cámara, motivo del justificante): tarjetas
// seleccionables con icono, título y descripción. Cada tarjeta es un radio NATIVO oculto a la vista (flechas, Tab y lector
// de pantalla funcionan solos); la elegida puede desplegar dentro de sí un campo propio (`extra`), que queda FUERA de la
// etiqueta para que sus controles no sean parte del radio. Máximo 4 por fila.
//
//   opciones      -> [{ value, titulo, descripcion?, icono? (componente Lucide), disabled?, extra? (nodo) }]
//   value / onChange(value)  -> controlado; onChange recibe el valor de la opción elegida.
//   renderExtra   -> (value, opcion) => nodo; alternativa a `extra` por opción (solo se llama para la elegida).
//   columnas      -> 1 a 4 (por omisión 2).
//   label         -> nombre del grupo (aria-label). Dentro de <Field as="fieldset"> basta con la leyenda.
//   invalid       -> borde destructivo en las no elegidas y aria-invalid.
//   name          -> nombre del grupo de radios (se genera uno si falta).
export default function TarjetaOpcion({
    opciones,
    value,
    onChange,
    renderExtra,
    columnas = 2,
    label,
    invalid = false,
    disabled = false,
    required = false,
    name,
    id,
    className,
    'aria-labelledby': labelledby,
    'aria-describedby': describedby,
}) {
    const generado = useId();
    const grupo = name || `opcion-${generado}`;

    return (
        <div
            role="radiogroup"
            id={id}
            aria-label={label}
            aria-labelledby={labelledby}
            aria-describedby={describedby}
            aria-required={required ? true : undefined}
            aria-invalid={invalid ? true : undefined}
            className={clsx('grid gap-3', COLUMNAS[columnas] || COLUMNAS[2], className)}
        >
            {opciones.map((op) => {
                const elegida = String(op.value) === String(value);
                const inactiva = disabled || op.disabled;
                const Icono = op.icono;
                const base = `${grupo}-${String(op.value)}`;
                const extra = elegida ? (renderExtra ? renderExtra(op.value, op) : op.extra) : null;
                return (
                    <div
                        key={op.value}
                        className={clsx(
                            'rounded-xl border p-4 transition-colors duration-150 motion-reduce:transition-none',
                            'has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-ring/30',
                            elegida ? 'border-primary bg-accent/40' : clsx('bg-card', invalid ? 'border-destructive' : 'border-border', !inactiva && 'hover:bg-accent/30'),
                            inactiva && 'opacity-60',
                        )}
                    >
                        <label className={clsx('flex items-start gap-3', inactiva ? 'cursor-not-allowed' : 'cursor-pointer')}>
                            <input
                                type="radio"
                                className="sr-only"
                                name={grupo}
                                value={String(op.value)}
                                checked={elegida}
                                disabled={inactiva}
                                onChange={() => onChange?.(op.value)}
                                aria-labelledby={`${base}-titulo`}
                                aria-describedby={op.descripcion ? `${base}-descripcion` : undefined}
                            />
                            {Icono && (
                                <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                                    <Icono className="size-[18px]" strokeWidth={1.75} />
                                </span>
                            )}
                            <span className="min-w-0 flex-1">
                                <span id={`${base}-titulo`} className="block text-sm font-medium">
                                    {op.titulo}
                                </span>
                                {op.descripcion && (
                                    <span id={`${base}-descripcion`} className="mt-0.5 block text-xs text-muted-foreground">
                                        {op.descripcion}
                                    </span>
                                )}
                            </span>
                            {elegida ? (
                                <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
                            ) : (
                                <Circle aria-hidden="true" className="size-5 shrink-0 text-muted-foreground/60" strokeWidth={1.5} />
                            )}
                        </label>
                        {extra && <div className="mt-3">{extra}</div>}
                    </div>
                );
            })}
        </div>
    );
}
