'use client';

import { Search } from 'lucide-react';
import clsx from 'clsx';

// Campo de búsqueda del Home (como «Search apps» en Dash): se ve como un campo de texto con lupa y atajo, pero es un botón
// que abre la paleta de comandos (⌘K), donde se escribe y se busca. Un solo lugar para «ir a».
export default function CampoComando({ placeholder = '¿Qué quieres hacer hoy?', onAbrir, className }) {
    return (
        <button
            type="button"
            onClick={onAbrir}
            aria-label="Buscar o ir a"
            aria-keyshortcuts="Control+K Meta+K"
            className={clsx(
                'flex h-11 w-full max-w-md items-center gap-2.5 rounded-md border border-input bg-card px-3 text-left transition-[border-color,box-shadow] duration-150',
                'hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
                className,
            )}
        >
            <Search aria-hidden="true" className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{placeholder}</span>
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground sm:block">⌘ K</kbd>
        </button>
    );
}
