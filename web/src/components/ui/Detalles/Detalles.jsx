'use client';

import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

// Divulgación para plegar lo largo (tablas completas, procedimientos, explicaciones) y dejar la pantalla ligera. El contenido
// sigue en el DOM (se oculta con `hidden`), así que no se pierde estado ni se rompe la impresión: al imprimir siempre se muestra.
//   titulo = texto del botón · resumen = texto gris junto al título · abierto = estado inicial
export default function Detalles({ titulo, resumen, abierto = false, className, children }) {
    const [visible, setVisible] = useState(abierto);
    const id = useId();
    return (
        <div className={clsx('rounded-xl border border-border bg-card', className)}>
            <button
                type="button"
                aria-expanded={visible}
                aria-controls={id}
                onClick={() => setVisible((v) => !v)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-5 text-left transition-colors duration-150 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 print:hidden"
            >
                <span className="text-sm font-medium">{titulo}</span>
                {resumen && <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{resumen}</span>}
                <ChevronDown aria-hidden="true" className={clsx('ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200', visible && 'rotate-180')} strokeWidth={1.75} />
            </button>
            <div id={id} hidden={!visible} className="border-t border-border p-5 print:block">
                {children}
            </div>
        </div>
    );
}
