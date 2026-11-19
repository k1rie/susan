'use client';

import { useCallback, useState } from 'react';

// Lógica común de cierre de `Modal` y `PanelLateral`. Esc, fondo, X y «Cancelar» llaman a `solicitarCierre`:
//   - sin cambios       -> onClose()
//   - con `dirty`       -> abre la confirmación «¿Descartar los cambios?»; al confirmar llama a onDiscard() (si existe, para limpiar
//                          borradores o reiniciar el estado) y luego a onClose().
//   - `closeDisabled`   -> no hace nada (p. ej. mientras se guarda).
// `dialogoDescarte` son las props de un `ConfirmDialog` ya armadas (con «Seguir editando» como opción segura y con el foco).
export function useCierreConfirmado({ open = true, dirty = false, onClose, onDiscard, closeDisabled = false }) {
    const [confirmando, setConfirmando] = useState(false);
    const [abiertoAntes, setAbiertoAntes] = useState(open);

    // Si el contenedor se cierra por otra vía, la confirmación pendiente no debe reaparecer al volver a abrirlo.
    if (open !== abiertoAntes) {
        setAbiertoAntes(open);
        if (!open) setConfirmando(false);
    }

    const solicitarCierre = useCallback(() => {
        if (closeDisabled) return;
        if (dirty) setConfirmando(true);
        else onClose?.();
    }, [closeDisabled, dirty, onClose]);

    const dialogoDescarte = {
        open: confirmando && open,
        title: '¿Descartar los cambios?',
        message: 'Hay cambios sin guardar. Si sales ahora, se perderán.',
        confirmLabel: 'Descartar cambios',
        cancelLabel: 'Seguir editando',
        variant: 'danger',
        onConfirm: () => {
            setConfirmando(false);
            onDiscard?.();
            onClose?.();
        },
        onCancel: () => setConfirmando(false),
    };

    return { solicitarCierre, dialogoDescarte, confirmando };
}

export default useCierreConfirmado;
