'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import BrandMark from '../BrandMark/BrandMark.jsx';
import { rolEtiqueta } from '../Sidebar/navItems.js';

// Barra superior fija de 56 px. Presentacional: "Salir" delega en onSalir (lo cablea la página).
export default function Topbar({ me, onMenu, onSalir }) {
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
        <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-border bg-card px-3">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onMenu}
                    aria-label="Abrir menú"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted lg:hidden"
                >
                    <Menu aria-hidden="true" className="h-5 w-5" />
                </button>
                <BrandMark variant="compact" />
            </div>
            <div ref={raiz} className="relative min-w-0">
                <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={abierto}
                    onClick={() => setAbierto((v) => !v)}
                    className="flex min-h-11 max-w-[14rem] flex-col items-end justify-center rounded-md px-2 text-right hover:bg-muted"
                >
                    <span className="max-w-full truncate text-sm font-medium">{me?.nombre}</span>
                    <span className="text-xs text-muted-foreground">{rolEtiqueta(me?.rol)}</span>
                </button>
                {abierto && (
                    <div role="menu" className="absolute right-0 top-full mt-1 w-52 rounded-md border border-border bg-card p-1 shadow-md">
                        <Link
                            role="menuitem"
                            href="/cambiar-contrasena"
                            onClick={() => setAbierto(false)}
                            className="flex min-h-11 items-center rounded px-3 text-sm hover:bg-muted"
                        >
                            Cambiar contraseña
                        </Link>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setAbierto(false);
                                onSalir?.();
                            }}
                            className="flex min-h-11 w-full items-center rounded px-3 text-left text-sm hover:bg-muted"
                        >
                            Salir
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
