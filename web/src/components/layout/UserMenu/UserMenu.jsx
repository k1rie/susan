'use client';

import { ChevronDown, KeyRound, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Avatar from '@/components/ui/Avatar';
import { rolEtiqueta } from '../Sidebar/navItems.js';

// Menú de cuenta (avatar + nombre). Esc o clic fuera lo cierran. "Salir" delega en onSalir.
export default function UserMenu({ me, onSalir }) {
    const [abierto, setAbierto] = useState(false);
    const raiz = useRef(null);

    useEffect(() => {
        if (!abierto) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setAbierto(false);
        };
        const onClick = (e) => {
            if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onClick);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onClick);
        };
    }, [abierto]);

    return (
        <div ref={raiz} className="relative min-w-0">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={abierto}
                aria-label={`Cuenta de ${me?.nombre ?? 'usuario'}`}
                onClick={() => setAbierto((v) => !v)}
                className="flex min-h-11 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 sm:pr-3"
            >
                <Avatar nombre={me?.nombre} size="sm" />
                <span className="hidden min-w-0 text-left leading-tight sm:block">
                    <span className="block max-w-[11rem] truncate text-sm font-medium">{me?.nombre}</span>
                    <span className="block text-xs text-muted-foreground">{rolEtiqueta(me?.rol)}</span>
                </span>
                <ChevronDown aria-hidden="true" className="hidden size-4 text-muted-foreground sm:block" strokeWidth={1.75} />
            </button>
            {abierto && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-60 animate-in rounded-2xl border border-border bg-popover p-1.5 shadow-lift duration-150 fade-in-0 zoom-in-95">
                    <div className="px-3 pb-2 pt-1.5 sm:hidden">
                        <p className="truncate text-sm font-medium">{me?.nombre}</p>
                        <p className="text-xs text-muted-foreground">{rolEtiqueta(me?.rol)}</p>
                    </div>
                    <Link role="menuitem" href="/cambiar-contrasena" onClick={() => setAbierto(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                        <KeyRound aria-hidden="true" className="size-4 text-muted-foreground" strokeWidth={1.75} />
                        Cambiar contraseña
                    </Link>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            setAbierto(false);
                            onSalir?.();
                        }}
                        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                        <LogOut aria-hidden="true" className="size-4 text-muted-foreground" strokeWidth={1.75} />
                        Salir
                    </button>
                </div>
            )}
        </div>
    );
}
