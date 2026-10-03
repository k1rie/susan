'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useEffect } from 'react';
import { itemActivo } from './navItems.js';

// Navegación principal. >= 1024 px es columna fija; debajo es un cajón controlado por `open`.
export default function Sidebar({ items, pathname, open, onClose }) {
    const activo = itemActivo(items, pathname || '');

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    return (
        <>
            {open && (
                <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={onClose}
                    className="fixed inset-0 top-14 z-30 bg-foreground/40 lg:hidden"
                />
            )}
            <aside
                className={clsx(
                    'fixed bottom-0 left-0 top-14 z-40 w-60 overflow-y-auto border-r border-border bg-surface p-2',
                    open ? 'block' : 'hidden lg:block',
                )}
            >
                <nav aria-label="Principal">
                    <ul className="flex flex-col gap-1">
                        {items.map(({ href, label, icon: Icono }) => {
                            const esActivo = href === activo;
                            return (
                                <li key={href}>
                                    <Link
                                        href={href}
                                        onClick={onClose}
                                        aria-current={esActivo ? 'page' : undefined}
                                        className={clsx(
                                            'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium',
                                            esActivo ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-surface-muted',
                                        )}
                                    >
                                        {Icono && <Icono aria-hidden="true" className="h-5 w-5 shrink-0" />}
                                        <span>{label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </aside>
        </>
    );
}
