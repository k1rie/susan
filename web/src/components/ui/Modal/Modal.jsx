'use client';

import { useMemo } from 'react';
import { CierreContext } from '@/hooks/ui/useCierreContenedor.js';
import { useCierreConfirmado } from '@/hooks/ui/useCierreConfirmado.js';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx';
import ModalBase from './ModalBase.jsx';

// Diálogo modal accesible (role="dialog" + aria-modal): trampa de foco, Esc, foco devuelto al cerrar (ver ModalBase).
//
// Ampliaciones (todas opcionales; sin ellas el diálogo es el de siempre):
//   dirty         hay cambios sin guardar: Esc, clic en el fondo, la X y «Cancelar» piden confirmar con «¿Descartar los cambios?».
//   onDiscard     se llama al confirmar el descarte, antes de onClose (limpiar borradores, reiniciar el formulario). No hace falta que cierre.
//   closeDisabled ignora los intentos de cierre (p. ej. mientras se guarda).
//   showClose     botón X visible; fullMobile / size="full-mobile": pantalla completa < 640 px, con la X y el pie fijo.
//   footer        nodo o `({ cerrar }) => nodo`; `cerrar` es la ruta de cierre que respeta `dirty`.
// El contenido también puede llamar a `useCierreContenedor().cerrar` (hooks/ui) para cerrar por esa misma ruta.
export default function Modal({ onClose, dirty = false, onDiscard, closeDisabled = false, ...resto }) {
    const { solicitarCierre, dialogoDescarte } = useCierreConfirmado({ open: resto.open, dirty, onClose, onDiscard, closeDisabled });
    const contexto = useMemo(() => ({ cerrar: solicitarCierre }), [solicitarCierre]);

    return (
        <CierreContext.Provider value={contexto}>
            <ModalBase {...resto} onClose={solicitarCierre} />
            {dirty && <ConfirmDialog {...dialogoDescarte} />}
        </CierreContext.Provider>
    );
}
