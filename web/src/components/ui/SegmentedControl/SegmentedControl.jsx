'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useRef } from 'react';
import { destinoDeTecla, indiceTabulable, RELLENO, RELLENO_ANCHO_COMPLETO, TAMANOS, TONOS } from './segmentedControl.utils.js';

// Control segmentado: de 2 a 5 opciones excluyentes visibles a la vez (estatus, tipo, rol, estado de asistencia).
// Es un grupo de radios (role="radiogroup"): una sola parada de tabulador y flechas para cambiar, y la flecha también elige.
// No es un filtro de lista (eso es ui/Pills, con aria-pressed) ni navegación (ui/Tabs).
//
//   items     -> [{ value, label, icon?, tone?, disabled? }]; tone = 'presente'|'retardo'|'ausente'|'justificado'|'pendiente'.
//                Con tono, la opción muestra siempre su texto, un punto del color y, elegida, fondo + palomita.
//   value / onChange(value)  -> controlado; onChange recibe el valor de la opción.
//   label     -> nombre accesible del grupo (aria-label). Dentro de <Field as="fieldset"> basta con la leyenda.
//   size      -> 'sm' (36 px) | 'md' (44 px, por omisión).
//   fullWidth -> ocupa todo el ancho: cada opción parte de lo que mide su texto y se reparten el sobrante (`flex-auto`), con menos relleno
//                y `min-w-0`; el texto largo se parte en vez de salirse de su segmento (a 360 px «Mantenimiento» cabe sin ajustes).
//   name      -> agrega un <input type="hidden"> con el valor para formularios nativos y marca el grupo con `data-campo-nombre`
//                (así `useFormulario` encuentra el control para llevarle el foco al primer error).
export default function SegmentedControl({
    items,
    value,
    onChange,
    label,
    size = 'md',
    fullWidth = false,
    disabled = false,
    name,
    id,
    className,
    'aria-labelledby': labelledby,
    'aria-describedby': describedby,
    'aria-invalid': ariaInvalid,
}) {
    const refs = useRef([]);
    const tabulable = indiceTabulable(items, value, disabled);

    const elegir = (indice) => {
        const item = items[indice];
        if (!item || item.disabled || disabled) return;
        if (String(item.value) !== String(value)) onChange?.(item.value);
    };

    const alTeclear = (e, indice) => {
        const destino = destinoDeTecla(items, indice, e.key, disabled);
        if (destino < 0) return;
        e.preventDefault();
        refs.current[destino]?.focus();
        elegir(destino);
    };

    return (
        <div
            role="radiogroup"
            id={id}
            aria-label={label}
            aria-labelledby={labelledby}
            aria-describedby={describedby}
            aria-invalid={ariaInvalid}
            aria-disabled={disabled ? true : undefined}
            data-campo-nombre={name || undefined}
            className={clsx(
                'gap-1 rounded-lg bg-muted p-1',
                fullWidth ? 'flex w-full' : 'inline-flex max-w-full overflow-x-auto',
                ariaInvalid && 'outline outline-1 outline-destructive',
                className,
            )}
        >
            {items.map((item, i) => {
                const elegida = String(item.value) === String(value);
                const tono = TONOS[item.tone];
                const Icono = item.icon;
                const inactiva = disabled || item.disabled;
                return (
                    <button
                        key={item.value}
                        ref={(el) => {
                            refs.current[i] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={elegida}
                        tabIndex={i === tabulable ? 0 : -1}
                        disabled={inactiva}
                        onClick={() => elegir(i)}
                        onKeyDown={(e) => alTeclear(e, i)}
                        className={clsx(
                            'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md border transition-colors duration-150 motion-reduce:transition-none',
                            // A ancho completo el texto largo se parte en dos líneas (el alto de 44 px alcanza) en vez de cortarse con «…»;
                            // `break-words` + `min-w-0` evitan que una palabra más larga que el segmento lo desborde.
                            fullWidth ? 'whitespace-normal break-words py-1 text-center leading-tight' : 'whitespace-nowrap',
                            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
                            TAMANOS[size] || TAMANOS.md,
                            (fullWidth ? RELLENO_ANCHO_COMPLETO : RELLENO)[size] || (fullWidth ? RELLENO_ANCHO_COMPLETO : RELLENO).md,
                            // `flex-auto` (no `flex-1`): cada segmento parte del ancho de su texto, así una etiqueta larga recibe más espacio
                            // que una corta en vez de que todos midan lo mismo y la larga se salga.
                            fullWidth && 'flex-auto',
                            elegida
                                ? clsx('font-medium', tono ? tono.activo : 'border-transparent bg-foreground text-background')
                                : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                    >
                        {tono && !elegida && <span aria-hidden="true" className={clsx('size-1.5 shrink-0 rounded-full', tono.punto)} />}
                        {tono && elegida && <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.25} />}
                        {Icono && <Icono aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />}
                        <span>{item.label}</span>
                    </button>
                );
            })}
            {name && <input type="hidden" name={name} value={value ?? ''} />}
        </div>
    );
}
