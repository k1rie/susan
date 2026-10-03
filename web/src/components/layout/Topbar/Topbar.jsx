'use client';

import { Menu, Search } from 'lucide-react';
import BrandMark from '../BrandMark/BrandMark.jsx';
import UserMenu from '../UserMenu/UserMenu.jsx';

// Barra superior fija de 56 px: marca a la izquierda, buscador en píldora al centro (abre la paleta ⌘K) y cuenta a la
// derecha. Presentacional: "Salir" delega en onSalir (lo cablea la página).
export default function Topbar({ me, onMenu, onBuscar, onSalir }) {
    return (
        <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 border-b border-border/60 bg-background/90 px-3 backdrop-blur-md">
            <div className="flex items-center gap-1 lg:w-60 lg:shrink-0">
                <button
                    type="button"
                    onClick={onMenu}
                    aria-label="Abrir menú"
                    className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 lg:hidden"
                >
                    <Menu aria-hidden="true" className="size-5" strokeWidth={1.75} />
                </button>
                <BrandMark variant="compact" />
            </div>
            <div className="flex flex-1 justify-center">
                <button
                    type="button"
                    onClick={onBuscar}
                    aria-label="Buscar o ir a"
                    aria-keyshortcuts="Control+K Meta+K"
                    className="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground shadow-xs transition-[border-color,box-shadow] hover:border-input focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 md:flex"
                >
                    <Search aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                    <span className="flex-1 text-left">Buscar o ir a…</span>
                    <kbd className="rounded-md border border-border px-1.5 py-0.5 text-xs">⌘K</kbd>
                </button>
            </div>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={onBuscar}
                    aria-label="Buscar o ir a"
                    className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 md:hidden"
                >
                    <Search aria-hidden="true" className="size-5" strokeWidth={1.75} />
                </button>
                <UserMenu me={me} onSalir={onSalir} />
            </div>
        </header>
    );
}
