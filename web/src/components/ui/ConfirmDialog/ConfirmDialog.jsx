'use client';

import { useRef, useState } from 'react';
import Button from '../Button/Button.jsx';
import Field from '../Field/Field.jsx';
import ModalBase from '../Modal/ModalBase.jsx';
import Textarea from '../Textarea/Textarea.jsx';

// Confirmación sobre el cascarón del Modal (ModalBase: `Modal` usa este componente para «¿Descartar los cambios?»). Si onConfirm devuelve
// una promesa el botón queda en loading y el diálogo sigue abierto hasta resolverse; si rechaza, permanece abierto para que el llamador
// muestre el error.
//   reason  { label = 'Motivo', required = false, maxLength } agrega un campo de motivo o comentario; `onConfirm(texto)` lo recibe ya
//           sin espacios en los extremos. Con `required`, confirmar sin texto no llama a onConfirm: marca el campo (borde rojo,
//           `aria-invalid` y el mensaje enlazado con `aria-describedby`, vía `Field` + `invalid`) y le da el foco.
//           Sin `reason`, onConfirm se llama sin argumentos, como siempre.
export default function ConfirmDialog({
    open,
    title,
    message,
    children,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'primary',
    reason,
    onConfirm,
    onCancel,
}) {
    const cancelRef = useRef(null);
    const motivoRef = useRef(null);
    const [enCurso, setEnCurso] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [faltaMotivo, setFaltaMotivo] = useState(false);
    const [abiertoAntes, setAbiertoAntes] = useState(open);

    // Cada vez que el diálogo se abre empieza con el campo de motivo vacío y sin error.
    if (open !== abiertoAntes) {
        setAbiertoAntes(open);
        if (open) {
            setMotivo('');
            setFaltaMotivo(false);
        }
    }

    const confirmar = async () => {
        const texto = motivo.trim();
        if (reason?.required && !texto) {
            setFaltaMotivo(true);
            motivoRef.current?.focus();
            return;
        }
        const r = reason ? onConfirm?.(texto) : onConfirm?.();
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
        <ModalBase
            open={open}
            onClose={() => {
                if (!enCurso) onCancel?.();
            }}
            title={title}
            size="sm"
            closeOnOverlay={false}
            initialFocusRef={reason ? motivoRef : variant === 'danger' ? cancelRef : undefined}
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
            {reason && (
                <Field
                    label={reason.label ?? 'Motivo'}
                    required={reason.required}
                    error={faltaMotivo ? 'Escribe el motivo para continuar.' : undefined}
                    className={message || children ? 'mt-3' : undefined}
                >
                    <Textarea
                        ref={motivoRef}
                        rows={3}
                        value={motivo}
                        maxLength={reason.maxLength}
                        showCount={reason.maxLength != null}
                        invalid={faltaMotivo}
                        disabled={enCurso}
                        onChange={(e) => {
                            setMotivo(e.target.value);
                            if (faltaMotivo) setFaltaMotivo(false);
                        }}
                    />
                </Field>
            )}
        </ModalBase>
    );
}
