'use client';

import { useRef, useState } from 'react';
import Button from '../Button/Button.jsx';
import Modal from '../Modal/Modal.jsx';

// Confirmación sobre Modal. Si onConfirm devuelve una promesa el botón queda en loading y el
// diálogo sigue abierto hasta resolverse; si rechaza, permanece abierto para que el llamador muestre el error.
export default function ConfirmDialog({
    open,
    title,
    message,
    children,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'primary',
    onConfirm,
    onCancel,
}) {
    const cancelRef = useRef(null);
    const [enCurso, setEnCurso] = useState(false);

    const confirmar = async () => {
        const r = onConfirm?.();
        if (r && typeof r.then === 'function') {
            setEnCurso(true);
            try {
                await r;
            } catch {
                // Se mantiene abierto; el error lo presenta quien llamó.
            } finally {
                setEnCurso(false);
            }
        }
    };

    return (
        <Modal
            open={open}
            onClose={() => {
                if (!enCurso) onCancel?.();
            }}
            title={title}
            size="sm"
            closeOnOverlay={false}
            initialFocusRef={variant === 'danger' ? cancelRef : undefined}
            footer={
                <>
                    <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={enCurso}>
                        {cancelLabel}
                    </Button>
                    <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={confirmar} loading={enCurso}>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            {message && <p className="text-sm">{message}</p>}
            {children}
        </Modal>
    );
}
