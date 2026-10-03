'use client';

import clsx from 'clsx';
import { useRef } from 'react';

// Tira de pestañas con teclado (flechas, Inicio, Fin). El panel lo pinta quien la usa con
// role="tabpanel" id="<prefix>-panel-<id>" aria-labelledby="<prefix>-<id>".
export default function Tabs({ tabs, value, onChange, idPrefix = 'tab', className }) {
    const refs = useRef({});

    const mover = (indice, paso) => {
        const habilitadas = tabs.filter((t) => !t.disabled);
        if (habilitadas.length === 0) return;
        const actual = tabs[indice];
        const pos = habilitadas.findIndex((t) => t.id === actual.id);
        const destino = habilitadas[(pos + paso + habilitadas.length) % habilitadas.length];
        onChange(destino.id);
        refs.current[destino.id]?.focus();
    };

    const alTeclear = (e, indice) => {
        const habilitadas = tabs.filter((t) => !t.disabled);
        if (e.key === 'ArrowRight') mover(indice, 1);
        else if (e.key === 'ArrowLeft') mover(indice, -1);
        else if (e.key === 'Home' || e.key === 'End') {
            const destino = e.key === 'Home' ? habilitadas[0] : habilitadas[habilitadas.length - 1];
            if (!destino) return;
            onChange(destino.id);
            refs.current[destino.id]?.focus();
        } else return;
        e.preventDefault();
    };

    return (
        <div role="tablist" className={clsx('flex max-w-full gap-6 overflow-x-auto border-b border-border', className)}>
            {tabs.map((t, i) => {
                const activa = t.id === value;
                return (
                    <button
                        key={t.id}
                        ref={(el) => {
                            refs.current[t.id] = el;
                        }}
                        type="button"
                        role="tab"
                        id={`${idPrefix}-${t.id}`}
                        aria-controls={`${idPrefix}-panel-${t.id}`}
                        aria-selected={activa}
                        tabIndex={activa ? 0 : -1}
                        disabled={t.disabled}
                        onClick={() => onChange(t.id)}
                        onKeyDown={(e) => alTeclear(e, i)}
                        className={clsx(
                            'relative min-h-11 shrink-0 whitespace-nowrap pb-0.5 text-sm font-medium transition-colors duration-150 disabled:opacity-50',
                            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:rounded-sm',
                            activa
                                ? 'text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {t.label}
                        {t.count != null && <span className="ml-1 text-xs text-muted-foreground">({t.count})</span>}
                    </button>
                );
            })}
        </div>
    );
}
