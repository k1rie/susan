'use client';

import { ArrowRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// Campo de comando del Home (componente firma): se ve como un campo de texto grande en píldora con botón circular,
// pero es un botón que abre la paleta de comandos (⌘K) — ahí se escribe y se busca. Un solo lugar para "ir a".
export default function CampoComando({ placeholder = '¿Qué quieres hacer hoy?', onAbrir, className }) {
    return (
        <button
            type="button"
            onClick={onAbrir}
            aria-label="Buscar o ir a"
            aria-keyshortcuts="Control+K Meta+K"
            className={cn(
                'group flex h-16 w-full max-w-2xl items-center gap-3 rounded-full border border-border bg-card pl-6 pr-2 text-left shadow-soft',
                'transition-[box-shadow,border-color] duration-200 hover:border-input hover:shadow-lift',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
                className,
            )}
        >
            <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate text-base text-muted-foreground">{placeholder}</span>
            <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground sm:block">⌘K</kbd>
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 group-hover:translate-x-0.5">
                <ArrowRight className="size-5" strokeWidth={1.75} />
            </span>
        </button>
    );
}
