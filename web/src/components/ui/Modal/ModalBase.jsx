'use client';

import clsx from 'clsx';
import { X } from 'lucide-react';
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '@/hooks/ui/useDialog.js';
import { useMontadoEnCliente } from '@/hooks/ui/useMontadoEnCliente.js';

const ANCHOS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' };
// En pantalla completa el tope de ancho solo aplica desde 640 px; por debajo el diálogo ocupa todo el ancho.
const ANCHOS_PANTALLA_COMPLETA = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-3xl' };

// Cascarón del diálogo (sin lógica de «cambios sin guardar»). Lo usan `Modal` (que le agrega `dirty`) y `ConfirmDialog` (que `Modal` necesita
// para preguntar «¿Descartar los cambios?»: por eso vive aparte, para no crear una importación circular).
//
// Se usa un contenedor propio con useDialog (trampa de foco, Esc, devolución de foco) en vez de <dialog>.showModal() para que sea
// determinista tanto en navegador como en pruebas jsdom.
//
// Se dibuja en un PORTAL a `document.body`: un diálogo abierto desde una celda de tabla, una tarjeta con `overflow` o un ancestro con
// `text-align`/`transform` ya no hereda esos estilos ni queda recortado. En el servidor y durante la hidratación no se dibuja (el portal
// aparece en el primer render del navegador); para el árbol de React sigue siendo hijo de quien lo declara (contextos y eventos burbujean).
//
//   size        sm | md | lg; 'full-mobile' = md en pantallas ≥ 640 px y pantalla completa por debajo.
//   fullMobile  true = pantalla completa < 640 px con cualquier `size` (en escritorio conserva ese tamaño). Pie fijo con área segura.
//   showClose   botón X visible. Se omite por omisión (los diálogos de hoy no la tienen); en pantalla completa siempre aparece.
//   footer      nodo, o función `({ cerrar }) => nodo` para que «Cancelar» use la misma ruta de cierre que Esc y la X.
export default function ModalBase({
    open,
    onClose,
    title,
    children,
    footer,
    size = 'md',
    fullMobile = false,
    closeOnOverlay = true,
    showClose = false,
    closeLabel = 'Cerrar',
    initialFocusRef,
    className,
}) {
    const ref = useRef(null);
    const titleId = useId();
    const montado = useMontadoEnCliente();
    useDialog(ref, onClose, open && montado, { initialFocusRef });

    if (!open || !montado) return null;
    const pantallaCompleta = fullMobile || size === 'full-mobile';
    const ancho = pantallaCompleta ? ANCHOS_PANTALLA_COMPLETA[size] || ANCHOS_PANTALLA_COMPLETA.md : ANCHOS[size] || ANCHOS.md;
    const conX = showClose || pantallaCompleta;
    const pie = typeof footer === 'function' ? footer({ cerrar: onClose }) : footer;

    return createPortal(
        <div
            className={clsx(
                'fixed inset-0 z-50 flex animate-in justify-center bg-foreground/40 duration-200 fade-in-0',
                pantallaCompleta ? 'items-stretch p-0 sm:items-center sm:p-3' : 'items-center p-3',
            )}
            onMouseDown={(e) => {
                if (closeOnOverlay && e.target === e.currentTarget) onClose?.();
            }}
        >
            <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={clsx(
                    'flex w-full animate-in flex-col bg-card text-foreground shadow-lift duration-200 fade-in-0',
                    pantallaCompleta
                        ? 'relative h-dvh slide-in-from-bottom-4 sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:zoom-in-95 sm:slide-in-from-bottom-0'
                        : 'max-h-[90dvh] rounded-2xl zoom-in-95',
                    conX && !pantallaCompleta && 'relative',
                    ancho,
                    className,
                )}
            >
                <div className={clsx('px-6 pt-6 pb-2', pantallaCompleta && 'pt-[max(1.5rem,env(safe-area-inset-top))] sm:pt-6', conX && 'pr-16')}>
                    <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                        {title}
                    </h2>
                </div>
                <div className={clsx('overflow-y-auto px-6 py-3', pantallaCompleta && 'min-h-0 flex-1 overscroll-contain')}>{children}</div>
                {pie && (
                    <div
                        className={clsx(
                            'flex flex-wrap justify-end gap-2 px-6 pt-3 pb-6',
                            pantallaCompleta && 'border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))] sm:border-t-0 sm:pb-6 [&>*]:flex-1 sm:[&>*]:flex-none',
                        )}
                    >
                        {pie}
                    </div>
                )}
                {conX && (
                    // Va al final del DOM (y se coloca arriba con position absolute) para que el foco inicial caiga en el primer campo
                    // y no en la X.
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={closeLabel}
                        className={clsx(
                            'absolute right-3 flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground',
                            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
                            pantallaCompleta ? 'top-[max(0.75rem,env(safe-area-inset-top))] sm:top-3' : 'top-3',
                        )}
                    >
                        <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
                    </button>
                )}
            </div>
        </div>,
        document.body,
    );
}
