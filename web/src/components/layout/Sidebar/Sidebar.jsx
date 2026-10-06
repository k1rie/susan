'use client';

import clsx from 'clsx';
import { LayoutGrid, Lock, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import BrandMark from '../BrandMark/BrandMark.jsx';
import MenuCuenta from '../MenuCuenta/MenuCuenta.jsx';
import { agruparNav, itemActivo } from './navItems.js';

// Riel de navegación al estilo Dropbox Dash: marca arriba, «Inicio» y «Buscar ⌘K», secciones con título gris (grupos de la
// navegación y «Próximamente»), y al pie «Módulos» y la cuenta. Sin borde ni fondo propio: vive sobre el lienzo crema.
// >= 1024 px es columna fija; debajo es un cajón controlado por `open`.
//   items      navegación del rol (navItems.js) · proximos  módulos de la hoja de ruta · onBuscar  abre la paleta ⌘K
export default function Sidebar({ items, pathname, open, onClose, proximos = [], me = null, onSalir, onBuscar }) {
    const activo = itemActivo(items, pathname || '');
    const { inicio, grupos } = agruparNav(items);
    const enModulos = (pathname || '') === '/modulos';

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const fila = (esActivo) =>
        clsx(
            'flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
            esActivo ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
        );
    const icono = 'size-5 shrink-0';
    const titulo = 'px-3 pb-1 pt-5 text-sm font-medium text-muted-foreground';

    const enlace = ({ href, label, icon: Icono }) => {
        const esActivo = href === activo;
        return (
            <li key={href}>
                <Link href={href} onClick={onClose} aria-current={esActivo ? 'page' : undefined} className={fila(esActivo)}>
                    {Icono && <Icono aria-hidden="true" className={icono} strokeWidth={1.5} />}
                    <span className="truncate">{label}</span>
                </Link>
            </li>
        );
    };

    return (
        <>
            {open && (
                <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={onClose}
                    className="fixed inset-0 top-14 z-[44] animate-in bg-foreground/30 duration-200 fade-in-0 lg:hidden"
                />
            )}
            <aside
                className={clsx(
                    'bg-sidebar',
                    // móvil: cajón bajo la barra superior; escritorio: columna fija de 232 px a pantalla completa
                    'fixed bottom-0 left-0 top-14 z-[45] w-[17rem] flex-col lg:static lg:top-auto lg:z-auto lg:flex lg:h-dvh lg:w-[14.5rem] lg:shrink-0',
                    open ? 'flex animate-in shadow-lift duration-200 slide-in-from-left max-lg:shadow-lift' : 'hidden lg:flex',
                )}
            >
                <div className="hidden px-5 pb-3 pt-5 lg:block">
                    <BrandMark variant="compact" />
                </div>

                <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-3 pt-2 lg:pt-0">
                    <nav aria-label="Principal">
                        <ul className="flex flex-col gap-0.5">
                            {inicio && enlace(inicio)}
                            <li>
                                <button type="button" onClick={() => { onClose?.(); onBuscar?.(); }} aria-keyshortcuts="Control+K Meta+K" className={fila(false)}>
                                    <Search aria-hidden="true" className={icono} strokeWidth={1.5} />
                                    <span className="flex-1 text-left">Buscar</span>
                                    <kbd className="hidden text-xs font-normal text-muted-foreground lg:block">⌘ K</kbd>
                                </button>
                            </li>
                        </ul>
                        {grupos.map(({ grupo, items: lista }) => (
                            <div key={grupo || 'general'}>
                                {grupo && <p className={titulo}>{grupo}</p>}
                                <ul className="flex flex-col gap-0.5">{lista.map(enlace)}</ul>
                            </div>
                        ))}
                    </nav>

                    {proximos.length > 0 && (
                        <nav aria-label="Próximamente">
                            <p className={titulo}>Próximamente</p>
                            <ul className="flex flex-col gap-0.5">
                                {proximos.map(({ id, titulo: nombre, icono: Icono, tono }) => {
                                    const href = `/modulos/${id}`;
                                    const esActivo = pathname === href;
                                    return (
                                        <li key={id}>
                                            <Link href={href} onClick={onClose} aria-current={esActivo ? 'page' : undefined} className={fila(esActivo)}>
                                                <span className="flex size-6 shrink-0 items-center justify-center rounded-md" style={{ background: `var(--tono-${tono})` }}>
                                                    <Icono aria-hidden="true" className="size-3.5" strokeWidth={1.75} style={{ color: `var(--tono-${tono}-fg)` }} />
                                                </span>
                                                <span className="min-w-0 flex-1 truncate">{nombre}</span>
                                                <Lock aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                                                <span className="sr-only">(próximamente)</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                                <li>
                                    <Link href="/modulos?filtro=pronto" onClick={onClose} className="flex min-h-9 items-center px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 rounded-lg">
                                        Ver todo
                                    </Link>
                                </li>
                            </ul>
                        </nav>
                    )}
                </div>

                <nav aria-label="Cuenta y módulos" className="flex flex-col gap-0.5 px-3 pb-3 pt-2">
                    <Link href="/modulos" onClick={onClose} aria-current={enModulos ? 'page' : undefined} className={fila(enModulos)}>
                        <LayoutGrid aria-hidden="true" className={icono} strokeWidth={1.5} />
                        <span>Módulos</span>
                    </Link>
                    {me && (
                        <div className="hidden lg:block">
                            <MenuCuenta me={me} onSalir={onSalir} variante="fila" />
                        </div>
                    )}
                </nav>
            </aside>
        </>
    );
}
