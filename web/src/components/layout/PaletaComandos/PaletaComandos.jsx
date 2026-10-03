'use client';

import { CornerDownLeft, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useRef, useState } from 'react';
import Badge from '@/components/ui/Badge';
import { useDialog } from '@/hooks/ui/useDialog.js';
import clsx from 'clsx';
import { agruparComandos, filtrarComandos } from './paleta.utils.js';

// Paleta de comandos (⌘K / Ctrl+K): búsqueda sobre páginas y módulos del rol. Patrón combobox/listbox: el foco se
// queda en el campo y las flechas mueven la opción activa (aria-activedescendant). Esc cierra; Enter ejecuta.
export default function PaletaComandos({ open, onClose, comandos, onSalir }) {
    if (!open) return null;
    return <Paleta onClose={onClose} comandos={comandos} onSalir={onSalir} />;
}

function Paleta({ onClose, comandos, onSalir }) {
    const router = useRouter();
    const contenedor = useRef(null);
    const listaId = useId();
    const [consulta, setConsulta] = useState('');
    const [activo, setActivo] = useState(0);
    useDialog(contenedor, onClose, true);

    const visibles = useMemo(() => filtrarComandos(comandos, consulta), [comandos, consulta]);
    const grupos = useMemo(() => agruparComandos(visibles), [visibles]);
    const indiceActivo = Math.min(activo, Math.max(visibles.length - 1, 0));
    const idOpcion = (c) => `${listaId}-${c.id.replace(/[^a-z0-9]/gi, '_')}`;

    const ejecutar = (c) => {
        onClose();
        if (c.accion === 'salir') onSalir?.();
        else if (c.href) router.push(c.href);
    };

    const alTeclear = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (visibles.length === 0) return;
            setActivo((indiceActivo + (e.key === 'ArrowDown' ? 1 : -1) + visibles.length) % visibles.length);
        } else if (e.key === 'Enter' && visibles[indiceActivo]) {
            e.preventDefault();
            ejecutar(visibles[indiceActivo]);
        }
    };

    const alActivo = visibles[indiceActivo];

    return (
        <div
            className="fixed inset-0 z-[65] flex animate-in items-start justify-center bg-foreground/40 p-3 pt-[10dvh] duration-150 fade-in-0"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={contenedor}
                role="dialog"
                aria-modal="true"
                aria-label="Buscar o ir a"
                className="flex max-h-[70dvh] w-full max-w-xl animate-in flex-col overflow-hidden rounded-3xl border border-border bg-popover text-popover-foreground shadow-lift duration-200 fade-in-0 zoom-in-95"
            >
                <div className="flex items-center gap-3 border-b border-border px-4">
                    <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <input
                        type="text"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls={listaId}
                        aria-activedescendant={alActivo ? idOpcion(alActivo) : undefined}
                        aria-autocomplete="list"
                        aria-label="Buscar páginas y módulos"
                        placeholder="Buscar páginas y módulos…"
                        value={consulta}
                        onChange={(e) => {
                            setConsulta(e.target.value);
                            setActivo(0);
                        }}
                        onKeyDown={alTeclear}
                        className="min-h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
                    />
                    <kbd className="hidden shrink-0 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground sm:block">Esc</kbd>
                </div>
                <div id={listaId} role="listbox" aria-label="Resultados" className="overflow-y-auto p-2">
                    {visibles.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Sin resultados para «{consulta}».</p>}
                    {grupos.map(({ grupo, comandos: lista }) => (
                        <div key={grupo} role="group" aria-label={grupo} className="mb-1">
                            <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{grupo}</p>
                            {lista.map((c) => {
                                const esActivo = alActivo?.id === c.id;
                                const Icono = c.icono;
                                return (
                                    <div
                                        key={c.id}
                                        id={idOpcion(c)}
                                        role="option"
                                        aria-selected={esActivo}
                                        onMouseMove={() => setActivo(visibles.indexOf(c))}
                                        onClick={() => ejecutar(c)}
                                        className={clsx('flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 text-sm', esActivo ? 'bg-accent text-accent-foreground' : 'text-foreground')}
                                    >
                                        {Icono ? <Icono aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} /> : <span className="size-[18px] shrink-0" aria-hidden="true" />}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium">{c.titulo}</span>
                                            {c.descripcion && <span className="block truncate text-xs text-muted-foreground">{c.descripcion}</span>}
                                        </span>
                                        {c.pronto && <Badge tone="gold">Pronto</Badge>}
                                        {esActivo && <CornerDownLeft aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
