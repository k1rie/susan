'use client';

import clsx from 'clsx';
import { Ellipsis } from 'lucide-react';
import Link from 'next/link';
import { itemActivo } from '../Sidebar/navItems.js';

const MAX_DIRECTOS = 5;

// Barra inferior para teléfonos (< 1024 px). Con más de 5 destinos muestra 4 + «Más» (abre el cajón del riel).
// Con un solo destino no se muestra (no aporta). Respeta el área segura de iOS.
export default function BottomNav({ items, pathname, onMas }) {
    if (!items || items.length < 2) return null;
    const hayMas = items.length > MAX_DIRECTOS;
    const directos = hayMas ? items.slice(0, MAX_DIRECTOS - 1) : items;
    const activo = itemActivo(items, pathname || '');
    const activoOculto = hayMas && activo && !directos.some((i) => i.href === activo);

    return (
        <nav
            aria-label="Navegación inferior"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
            <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
                {directos.map(({ href, label, icon: Icono }) => {
                    const esActivo = href === activo;
                    return (
                        <li key={href} className="min-w-0 flex-1">
                            <Link href={href} aria-current={esActivo ? 'page' : undefined} className="group flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 focus-visible:outline-none">
                                <span className={clsx('flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200 group-focus-visible:ring-4 group-focus-visible:ring-ring/40', esActivo ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>
                                    {Icono && <Icono aria-hidden="true" className="size-5" strokeWidth={1.75} />}
                                </span>
                                <span className={clsx('max-w-full truncate text-[11px] leading-tight', esActivo ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</span>
                            </Link>
                        </li>
                    );
                })}
                {hayMas && (
                    <li className="min-w-0 flex-1">
                        <button type="button" onClick={onMas} className="group flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 focus-visible:outline-none">
                            <span className={clsx('flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200 group-focus-visible:ring-4 group-focus-visible:ring-ring/40', activoOculto ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>
                                <Ellipsis aria-hidden="true" className="size-5" strokeWidth={1.75} />
                            </span>
                            <span className={clsx('text-[11px] leading-tight', activoOculto ? 'font-semibold text-foreground' : 'text-muted-foreground')}>Más</span>
                        </button>
                    </li>
                )}
            </ul>
        </nav>
    );
}
