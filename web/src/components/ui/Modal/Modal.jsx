'use client';

import clsx from 'clsx';
import { useId, useRef } from 'react';
import { useDialog } from '@/hooks/ui/useDialog.js';

const ANCHOS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' };

// Diálogo modal accesible (role="dialog" + aria-modal). Se usa un contenedor propio con useDialog
// (trampa de foco, Esc, devolución de foco) en vez de <dialog>.showModal() para que sea
// determinista tanto en navegador como en pruebas jsdom.
export default function Modal({
    open,
    onClose,
    title,
    children,
    footer,
    size = 'md',
    closeOnOverlay = true,
    initialFocusRef,
    className,
}) {
    const ref = useRef(null);
    const titleId = useId();
    useDialog(ref, onClose, open, { initialFocusRef });

    if (!open) return null;
    return (
        <div
            className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-foreground/40 p-3 duration-200 fade-in-0"
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
                    'flex max-h-[90dvh] w-full animate-in flex-col rounded-2xl bg-card text-foreground shadow-lift duration-200 fade-in-0 zoom-in-95',
                    ANCHOS[size] || ANCHOS.md,
                    className,
                )}
            >
                <div className="px-6 pt-6 pb-2">
                    <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                        {title}
                    </h2>
                </div>
                <div className="overflow-y-auto px-6 py-3">{children}</div>
                {footer && <div className="flex flex-wrap justify-end gap-2 px-6 pt-3 pb-6">{footer}</div>}
            </div>
        </div>
    );
}
