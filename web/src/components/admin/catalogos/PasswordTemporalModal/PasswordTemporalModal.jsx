'use client';

import { useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

/**
 * Muestra la contraseña temporal UNA sola vez: el servidor no la guarda. Quien lo usa debe poner
 * `contrasena` en null al cerrar; el modal no la conserva en ningún otro sitio. Si `open` es false o
 * no hay contraseña, no pinta nada (así no queda en el DOM).
 */
export default function PasswordTemporalModal({ open, correo, contrasena, titulo = 'Contraseña temporal', onClose }) {
    const [copiada, setCopiada] = useState(false);
    const [fallo, setFallo] = useState(false);
    const campo = useRef(null);

    if (!open || !contrasena) return null;

    const copiar = async () => {
        setFallo(false);
        try {
            await navigator.clipboard.writeText(contrasena);
            setCopiada(true);
        } catch {
            // Sin permiso de portapapeles: se selecciona el texto para copiarlo a mano.
            setCopiada(false);
            setFallo(true);
            campo.current?.focus();
            campo.current?.select();
        }
    };

    return (
        <Modal
            open
            title={titulo}
            onClose={onClose}
            closeOnOverlay={false}
            footer={<Button onClick={onClose}>Ya la copié, cerrar</Button>}
        >
            <div className="flex flex-col gap-3">
                <Alert tone="warning" title="Se muestra una sola vez">
                    Entregue esta contraseña de forma segura. Al cerrar esta ventana no se podrá volver a ver; si se
                    pierde, restablezca la contraseña de la cuenta.
                </Alert>
                {correo && (
                    <p className="text-sm">
                        Cuenta: <strong>{correo}</strong>
                    </p>
                )}
                <label className="flex flex-col gap-1 text-sm font-medium">
                    Contraseña temporal
                    <input
                        ref={campo}
                        readOnly
                        value={contrasena}
                        onFocus={(e) => e.target.select()}
                        autoComplete="off"
                        className="min-h-11 w-full rounded-full border border-border bg-muted px-4 font-mono text-base"
                    />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="secondary" onClick={copiar}>
                        Copiar
                    </Button>
                    <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
                        {copiada && 'Copiada al portapapeles.'}
                        {fallo && 'No se pudo copiar automáticamente; seleccione el texto y cópielo.'}
                    </span>
                </div>
            </div>
        </Modal>
    );
}
