'use client';

import clsx from 'clsx';

// Píldoras de filtro (Dash: "My apps 4" / "All apps"). La activa va en tinta con texto blanco; las demás, en gris cálido.
// Es un grupo de botones con aria-pressed (no pestañas): filtran el contenido que ya está en la página.
//   items: [{ id, label, count? }]
//   multiple: la selección es un arreglo de ids (`value` y `onChange(nuevoArreglo)`); cada clic enciende o apaga su píldora.
//             Sin `multiple`, `value` es un id y `onChange(id)`.
export default function Pills({ items, value, onChange, label = 'Filtrar', multiple = false, className }) {
    const seleccion = multiple ? (Array.isArray(value) ? value : []) : null;
    const alElegir = (id) => {
        if (!multiple) {
            onChange(id);
            return;
        }
        onChange(seleccion.includes(id) ? seleccion.filter((v) => v !== id) : [...seleccion, id]);
    };
    return (
        <div role="group" aria-label={label} className={clsx('flex flex-wrap gap-2', className)}>
            {items.map((it) => {
                const activa = multiple ? seleccion.includes(it.id) : it.id === value;
                return (
                    <button
                        key={it.id}
                        type="button"
                        aria-pressed={activa}
                        onClick={() => alElegir(it.id)}
                        className={clsx(
                            'inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition-colors duration-150',
                            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
                            activa ? 'bg-foreground font-medium text-background' : 'bg-muted text-foreground hover:bg-accent',
                        )}
                    >
                        {it.label}
                        {it.count != null && (
                            <span className={clsx('inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs', activa ? 'bg-background/20 text-background' : 'bg-card text-muted-foreground')}>
                                {it.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
