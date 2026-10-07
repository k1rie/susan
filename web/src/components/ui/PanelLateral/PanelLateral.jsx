'use client';

import clsx from 'clsx';
import { X } from 'lucide-react';
import { useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CierreContext } from '@/hooks/ui/useCierreContenedor.js';
import { useCierreConfirmado } from '@/hooks/ui/useCierreConfirmado.js';
import { useDialog } from '@/hooks/ui/useDialog.js';
import { useMontadoEnCliente } from '@/hooks/ui/useMontadoEnCliente.js';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx';

// Ancho del panel en escritorio (en teléfono siempre es pantalla completa). md deja ~29 rem de contenido: una sección de 2 columnas cabe.
const ANCHOS = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

// Panel que entra por la derecha (escritorio) o es pantalla completa (teléfono). Referencias de Mobbin: el drawer de «nuevo personaje» de fal,
// el panel de repetición de Sweatpals y el de configuración de Mintlify: cabecera con título y X, cuerpo con scroll y pie fijo con las
// acciones. Es el contenedor recomendado para altas de catálogo de UN paso (aula, materia, docente, usuario, cámara), porque la lista de
// detrás no se pierde de vista; si el alta tiene dependencias o más de ~6 campos, usa `Asistente`.
//
//   open, onClose, title      como Modal. `description`: una línea de ayuda bajo el título.
//   footer                    nodo o `({ cerrar }) => nodo` (el pie es fijo; normalmente un `<FormActions flat>`).
//   dirty, onDiscard          cambios sin guardar: Esc, fondo, X y `cerrar()` piden «¿Descartar los cambios?» (ver Modal).
//   closeDisabled             ignora los intentos de cierre (mientras se guarda).
//   size                      'sm' | 'md' (por omisión) | 'lg'
//   showClose                 X visible (true por omisión).
// Accesibilidad: role="dialog" aria-modal, foco atrapado y devuelto (useDialog, el mismo de Modal), Esc, y el foco inicial va al primer campo
// (la X va al final del DOM y se coloca arriba por posición, para no ser lo primero que se enfoca).
// Se dibuja en un portal a `document.body` (como Modal): abierto desde una celda de tabla no hereda su `text-align` ni queda recortado; en el
// servidor y durante la hidratación no se dibuja.
export default function PanelLateral({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
    dirty = false,
    onDiscard,
    closeDisabled = false,
    closeOnOverlay = true,
    showClose = true,
    closeLabel = 'Cerrar',
    initialFocusRef,
    className,
}) {
    const ref = useRef(null);
    const titleId = useId();
    const descId = useId();
    const { solicitarCierre, dialogoDescarte } = useCierreConfirmado({ open, dirty, onClose, onDiscard, closeDisabled });
    const contexto = useMemo(() => ({ cerrar: solicitarCierre }), [solicitarCierre]);
    const montado = useMontadoEnCliente();
    useDialog(ref, solicitarCierre, open && montado, { initialFocusRef });

    const pie = typeof footer === 'function' ? footer({ cerrar: solicitarCierre }) : footer;

    const panel = open && (
        <div
            className="fixed inset-0 z-50 flex animate-in justify-end bg-foreground/40 duration-200 fade-in-0"
            onMouseDown={(e) => {
                if (closeOnOverlay && e.target === e.currentTarget) solicitarCierre();
            }}
        >
            <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descId : undefined}
                tabIndex={-1}
                className={clsx(
                    'relative flex h-dvh w-full animate-in flex-col bg-card text-foreground shadow-lift outline-none duration-300 slide-in-from-right sm:rounded-l-2xl',
                    ANCHOS[size] || ANCHOS.md,
                    className,
                )}
            >
                <header className={clsx('shrink-0 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-6 sm:pt-5', showClose && 'pr-16 sm:pr-16')}>
                    <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                        {title}
                    </h2>
                    {description && (
                        <p id={descId} className="mt-0.5 text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 sm:px-6">{children}</div>
                {pie && (
                    <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                        {pie}
                    </footer>
                )}
                {showClose && (
                    <button
                        type="button"
                        onClick={solicitarCierre}
                        aria-label={closeLabel}
                        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 sm:top-3"
                    >
                        <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <CierreContext.Provider value={contexto}>
            {panel && montado && createPortal(panel, document.body)}
            {dirty && <ConfirmDialog {...dialogoDescarte} />}
        </CierreContext.Provider>
    );
}
