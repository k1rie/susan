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
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-2"
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
                    'flex max-h-[90dvh] w-full flex-col rounded-lg bg-surface text-foreground shadow-lg',
                    ANCHOS[size] || ANCHOS.md,
                    className,
                )}
            >
                <div className="border-b border-border px-4 py-3">
                    <h2 id={titleId} className="text-lg font-semibold">
                        {title}
                    </h2>
                </div>
                <div className="overflow-y-auto px-4 py-4">{children}</div>
                {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>}
            </div>
        </div>
    );
}
