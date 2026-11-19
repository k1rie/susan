'use client';

import clsx from 'clsx';
import { EllipsisVertical } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { indicePorLetra, moverIndice, posicionMenu } from './menuAcciones.utils.js';

const ALTO_ITEM = 40;

// Menú «⋯» para las acciones de una fila (reemplaza 3 botones apiñados en 360 px). Patrón «menu button» de WAI-ARIA.
//   items   [{ label, onClick, danger?, disabled?, icon?: ComponenteLucide }]
//   label   nombre accesible del botón («Acciones de Ana Pérez»); por omisión «Más acciones».
//   align   'end' (por omisión) | 'start'
// Teclado: Enter, Espacio o ↓ abren (↑ abre en el último); ↑ ↓ Inicio Fin mueven; una letra salta al elemento que empieza con ella;
// Esc cierra y devuelve el foco al botón; Tab cierra. El menú se dibuja en un portal con position: fixed para que no lo recorte el
// scroll horizontal de las tablas ni el transform de un diálogo; se cierra al hacer scroll o cambiar el tamaño de la ventana.
export default function MenuAcciones({ items, label = 'Más acciones', align = 'end', className }) {
    const menuId = useId();
    const botonRef = useRef(null);
    const menuRef = useRef(null);
    const itemRefs = useRef([]);
    const [abierto, setAbierto] = useState(false);
    const [posicion, setPosicion] = useState(null);
    const [inicio, setInicio] = useState('primero');
    const rectAlAbrir = useRef(null);

    const cerrar = useCallback((devolverFoco = false) => {
        setAbierto(false);
        if (devolverFoco) botonRef.current?.focus();
    }, []);

    const abrir = (donde) => {
        const rect = botonRef.current?.getBoundingClientRect();
        rectAlAbrir.current = rect ?? null;
        if (rect) {
            setPosicion(posicionMenu(rect, { viewport: { ancho: window.innerWidth, alto: window.innerHeight }, altoMenu: items.length * ALTO_ITEM + 8, alinear: align }));
        }
        setInicio(donde);
        setAbierto(true);
    };

    // Al abrir, el foco pasa al primer (o último) elemento habilitado.
    useEffect(() => {
        if (!abierto) return;
        const destino = inicio === 'ultimo' ? moverIndice(items, -1, -1) : moverIndice(items, -1, 1);
        itemRefs.current[destino]?.focus();
        // Solo al abrir: reordenar `items` con el menú abierto no debe mover el foco.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [abierto]);

    // Cerrar al hacer clic fuera y cuando el botón se mueve de su sitio (desplazamiento de la página o cambio de tamaño). Un `scroll`
    // que no movió el botón (el navegador a veces lo dispara al enfocar) no debe cerrar el menú.
    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => {
            if (menuRef.current?.contains(e.target) || botonRef.current?.contains(e.target)) return;
            setAbierto(false);
        };
        // El target de `resize` y de un scroll de ventana es window (no un Node): contains() lanzaría un TypeError.
        const alDesplazar = (e) => {
            if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
            const antes = rectAlAbrir.current;
            const ahora = botonRef.current?.getBoundingClientRect();
            if (antes && ahora && Math.abs(ahora.top - antes.top) < 1 && Math.abs(ahora.left - antes.left) < 1) return;
            setAbierto(false);
        };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('touchstart', fuera);
        window.addEventListener('scroll', alDesplazar, true);
        window.addEventListener('resize', alDesplazar);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('touchstart', fuera);
            window.removeEventListener('scroll', alDesplazar, true);
            window.removeEventListener('resize', alDesplazar);
        };
    }, [abierto]);

    const alTeclearBoton = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            abrir('primero');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            abrir('ultimo');
        }
    };

    const alTeclearMenu = (e) => {
        const actual = itemRefs.current.findIndex((el) => el === document.activeElement);
        let destino = null;
        if (e.key === 'ArrowDown') destino = moverIndice(items, actual, 1);
        else if (e.key === 'ArrowUp') destino = moverIndice(items, actual, -1);
        else if (e.key === 'Home') destino = moverIndice(items, -1, 1);
        else if (e.key === 'End') destino = moverIndice(items, -1, -1);
        else if (e.key === 'Escape') {
            // stopPropagation: si el menú está dentro de un diálogo, Esc cierra solo el menú.
            e.preventDefault();
            e.stopPropagation();
            cerrar(true);
            return;
        } else if (e.key === 'Tab') {
            // El foco vuelve al botón y el Tab sigue su curso natural desde ahí.
            cerrar(true);
            return;
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
            const i = indicePorLetra(items, actual, e.key);
            if (i !== -1) destino = i;
            else return;
        } else return;
        e.preventDefault();
        if (destino != null && destino !== -1) itemRefs.current[destino]?.focus();
    };

    const elegir = (item) => {
        if (item.disabled) return;
        // El foco se devuelve ANTES de ejecutar la acción: si abre un diálogo, éste lo restaura a este botón al cerrarse.
        cerrar(true);
        item.onClick?.();
    };

    return (
        <>
            <button
                ref={botonRef}
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={abierto}
                aria-controls={abierto ? menuId : undefined}
                onClick={() => (abierto ? cerrar() : abrir('primero'))}
                onKeyDown={alTeclearBoton}
                className={clsx(
                    'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
                    abierto && 'bg-accent text-foreground',
                    className,
                )}
            >
                <EllipsisVertical aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </button>
            {abierto &&
                createPortal(
                    <div
                        ref={menuRef}
                        id={menuId}
                        role="menu"
                        aria-label={label}
                        onKeyDown={alTeclearMenu}
                        style={posicion ?? undefined}
                        className="fixed z-[65] min-w-44 animate-in rounded-xl border border-border bg-card p-1 text-foreground shadow-lift duration-150 fade-in-0 zoom-in-95"
                    >
                        {items.map((item, i) => {
                            const Icono = item.icon;
                            return (
                                <button
                                    key={`${item.label}-${i}`}
                                    ref={(el) => {
                                        itemRefs.current[i] = el;
                                    }}
                                    type="button"
                                    role="menuitem"
                                    tabIndex={-1}
                                    disabled={item.disabled}
                                    onClick={() => elegir(item)}
                                    className={clsx(
                                        'flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors duration-150',
                                        'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
                                        item.danger && 'text-destructive',
                                    )}
                                >
                                    {Icono && <Icono aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />}
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>,
                    document.body,
                )}
        </>
    );
}
