'use client';

import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import Badge from '@/components/ui/Badge';
import { itemActivo } from './navItems.js';

// Navegación principal (riel sin borde, mismo lienzo que la página; ver docs/design/REFERENCIAS.md). >= 1024 px es
// columna fija; debajo es un cajón controlado por `open`. `proximos` = módulos de la hoja de ruta (/modulos/[id]).
export default function Sidebar({ items, pathname, open, onClose, proximos = [] }) {
    const activo = itemActivo(items, pathname || '');

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const clasesItem = (esActivo) =>
        clsx(
            'flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-sm transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
            esActivo ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent/60',
        );

    return (
        <>
            {open && (
                <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={onClose}
                    className="fixed inset-0 top-14 z-[44] animate-in bg-foreground/40 duration-200 fade-in-0 lg:hidden"
                />
            )}
            <aside
                className={clsx(
                    'fixed bottom-0 left-0 top-14 z-[45] w-64 flex-col overflow-y-auto bg-sidebar p-3 lg:z-40',
                    open ? 'flex animate-in shadow-lift duration-200 slide-in-from-left max-lg:shadow-lift' : 'hidden lg:flex',
                    'lg:shadow-none',
                )}
            >
                <nav aria-label="Principal">
                    <ul className="flex flex-col gap-1">
                        {items.map(({ href, label, icon: Icono }) => {
                            const esActivo = href === activo;
                            return (
                                <li key={href}>
                                    <Link href={href} onClick={onClose} aria-current={esActivo ? 'page' : undefined} className={clasesItem(esActivo)}>
                                        {Icono && <Icono aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />}
                                        <span>{label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {proximos.length > 0 && (
                    <nav aria-label="Próximamente" className="mt-6">
                        <p className="px-3.5 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Próximamente</p>
                        <ul className="flex flex-col gap-1">
                            {proximos.map(({ id, titulo, icono: Icono }) => {
                                const href = `/modulos/${id}`;
                                const esActivo = pathname === href;
                                return (
                                    <li key={id}>
                                        <Link href={href} onClick={onClose} aria-current={esActivo ? 'page' : undefined} className={clasesItem(esActivo)}>
                                            {Icono && <Icono aria-hidden="true" className="size-5 shrink-0 opacity-70" strokeWidth={1.75} />}
                                            <span className="min-w-0 flex-1 truncate">{titulo}</span>
                                            <Badge tone="gold" className="shrink-0">Pronto</Badge>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                )}

                <div className="mt-auto flex items-center gap-3 px-3.5 pt-6 text-xs text-muted-foreground">
                    <Image src="/brand/fca-escudo.png" alt="" width={32} height={32} className="size-8 shrink-0 object-contain opacity-80" />
                    <p className="leading-snug">Facultad de Contaduría y Administración C-I · UNACH</p>
                </div>
            </aside>
        </>
    );
}
