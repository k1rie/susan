'use client';

import clsx from 'clsx';
import { ChevronsUpDown, KeyRound, LogOut, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Avatar from '@/components/ui/Avatar';
import { usePreferenciasPerfil } from '@/lib/perfil';
import { rolEtiqueta } from '../Sidebar/navItems.js';

// Menú de cuenta. `variante="fila"`: fila completa al pie del riel (avatar + nombre + rol; el menú se abre hacia arriba, como
// «Account» en Dash). `variante="avatar"`: solo el avatar (barra superior móvil; el menú se abre hacia abajo). Esc o clic fuera cierran.
export default function MenuCuenta({ me, onSalir, variante = 'fila', onNavegar }) {
    const [abierto, setAbierto] = useState(false);
    const raiz = useRef(null);
    const { tinte } = usePreferenciasPerfil(me);

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

    const cerrar = () => {
        setAbierto(false);
        onNavegar?.();
    };
    const fila = variante === 'fila';

    return (
        <div ref={raiz} className="relative min-w-0">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={abierto}
                aria-label={`Cuenta de ${me?.nombre ?? 'usuario'}`}
                onClick={() => setAbierto((v) => !v)}
                className={clsx(
                    'flex items-center gap-3 rounded-lg text-left transition-colors duration-150 hover:bg-sidebar-accent/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
                    fila ? 'min-h-10 w-full px-3' : 'size-10 justify-center',
                )}
            >
                <Avatar nombre={me?.nombre} size="sm" tinte={tinte} />
                {fila && (
                    <>
                        <span className="min-w-0 flex-1 leading-tight">
                            <span className="block truncate text-sm">{me?.nombre}</span>
                            <span className="block text-xs text-muted-foreground">{rolEtiqueta(me?.rol)}</span>
                        </span>
                        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    </>
                )}
            </button>
            {abierto && (
                <div
                    role="menu"
                    className={clsx(
                        'absolute z-50 w-60 animate-in rounded-xl border border-border bg-popover p-1.5 shadow-lift duration-150 fade-in-0 zoom-in-95',
                        fila ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2',
                    )}
                >
                    {!fila && (
                        <div className="px-3 pb-2 pt-1.5">
                            <p className="truncate text-sm font-medium">{me?.nombre}</p>
                            <p className="text-xs text-muted-foreground">{rolEtiqueta(me?.rol)}</p>
                        </div>
                    )}
                    <Link role="menuitem" href="/bienvenida" onClick={cerrar} className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                        <PartyPopper aria-hidden="true" className="size-4 text-muted-foreground" strokeWidth={1.5} />
                        Ver bienvenida
                    </Link>
                    <Link role="menuitem" href="/cambiar-contrasena" onClick={cerrar} className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                        <KeyRound aria-hidden="true" className="size-4 text-muted-foreground" strokeWidth={1.5} />
                        Cambiar contraseña
                    </Link>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            cerrar();
                            onSalir?.();
                        }}
                        className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                        <LogOut aria-hidden="true" className="size-4 text-muted-foreground" strokeWidth={1.5} />
                        Salir
                    </button>
                </div>
            )}
        </div>
    );
}
