'use client';

import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

// Divulgación para plegar lo largo (tablas completas, procedimientos, explicaciones) y dejar la pantalla ligera. El contenido sigue
// en el DOM (se oculta con la clase `hidden`, NO con el atributo: el preflight de Tailwind 4 fuerza `[hidden]{display:none!important}`
// y entonces `print:block` no podría mostrarlo), así que no se pierde estado y al imprimir siempre se muestra.
//   titulo = texto del botón · resumen = texto gris junto al título · abierto = estado inicial
//   plano = sin borde ni radio (para usarlo dentro de otra tarjeta)
//   onAlternar(visible) = aviso al abrir/cerrar · montarAlAbrir = no monta los hijos hasta la primera apertura (carga diferida)
export default function Detalles({ titulo, resumen, abierto = false, plano = false, onAlternar, montarAlAbrir = false, className, children }) {
    const [visible, setVisible] = useState(abierto);
    const [yaAbierto, setYaAbierto] = useState(abierto);
    const id = useId();
    const alternar = () => {
        const siguiente = !visible;
        setVisible(siguiente);
        if (siguiente) setYaAbierto(true);
        onAlternar?.(siguiente);
    };
    return (
        <div className={clsx(!plano && 'rounded-xl border border-border bg-card', className)}>
            <button
                type="button"
                aria-expanded={visible}
                aria-controls={id}
                onClick={alternar}
                className={clsx(
                    'flex min-h-12 w-full items-center gap-3 text-left transition-colors duration-150 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 print:hidden',
                    plano ? 'rounded-md px-1' : 'rounded-xl px-5',
                )}
            >
                <span className="text-sm font-medium">{titulo}</span>
                {resumen && <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{resumen}</span>}
                <ChevronDown aria-hidden="true" className={clsx('ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200', visible && 'rotate-180')} strokeWidth={1.75} />
            </button>
            <div id={id} className={clsx(!visible && 'hidden print:block', !plano && 'border-t border-border p-5', plano && 'px-1 pb-1 pt-2')}>
                {(!montarAlAbrir || yaAbierto) && children}
            </div>
        </div>
    );
}
