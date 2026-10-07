'use client';

import { X } from 'lucide-react';
import Button from '@/components/ui/Button';

// Filtros que están aplicando ahora, cada uno con su «Quitar», y «Limpiar» para todos. Sin filtros activos no pinta nada.
//   filtros = [{ id, nombre, texto }]  ·  onQuitar(id)  ·  onLimpiar()
export default function FiltrosActivos({ filtros, onQuitar, onLimpiar, disabled = false }) {
    if (!filtros.length) return null;
    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ul aria-label="Filtros activos" className="flex min-w-0 flex-wrap gap-2">
                {filtros.map((f) => (
                    <li key={f.id} className="inline-flex min-h-8 min-w-0 max-w-full items-center gap-1 rounded-full bg-muted py-0.5 pl-3 pr-1 text-[13px]">
                        <span className="shrink-0 text-muted-foreground">{f.nombre}:</span>
                        <span className="min-w-0 truncate font-medium">{f.texto}</span>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onQuitar(f.id)}
                            aria-label={`Quitar filtro ${f.nombre}: ${f.texto}`}
                            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:opacity-50"
                        >
                            <X aria-hidden="true" className="size-3.5" strokeWidth={2} />
                        </button>
                    </li>
                ))}
            </ul>
            <Button variant="ghost" size="sm" onClick={onLimpiar} disabled={disabled}>
                Limpiar
            </Button>
        </div>
    );
}
