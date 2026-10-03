'use client';

import { Menu, Search } from 'lucide-react';
import BrandMark from '../BrandMark/BrandMark.jsx';
import MenuCuenta from '../MenuCuenta/MenuCuenta.jsx';

// Barra superior SOLO en teléfono/tableta (< 1024 px): menú, marca, buscador (abre la paleta ⌘K) y cuenta. En escritorio no
// hay barra superior: la búsqueda y la cuenta viven en el riel lateral, como en Dropbox Dash.
export default function TopbarMovil({ me, onMenu, onBuscar, onSalir }) {
    return (
        <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-border/70 bg-background/95 px-2 backdrop-blur lg:hidden">
            <div className="flex items-center gap-1">
                <button type="button" onClick={onMenu} aria-label="Abrir menú" className="inline-flex size-11 items-center justify-center rounded-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                    <Menu aria-hidden="true" className="size-5" strokeWidth={1.5} />
                </button>
                <BrandMark variant="compact" />
            </div>
            <div className="flex items-center gap-1">
                <button type="button" onClick={onBuscar} aria-label="Buscar o ir a" className="inline-flex size-11 items-center justify-center rounded-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                    <Search aria-hidden="true" className="size-5" strokeWidth={1.5} />
                </button>
                <MenuCuenta me={me} onSalir={onSalir} variante="avatar" />
            </div>
        </header>
    );
}
