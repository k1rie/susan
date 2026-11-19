'use client';

import { useEffect, useRef } from 'react';

// Avisa al contenedor (GrupoDetalle) si el formulario tiene cambios sin guardar. Las pestañas desmontan su contenido al cambiar, así que el
// contenedor necesita saberlo para preguntar antes de dejarlas (Tabs.confirmLeave). Al desmontarse el formulario avisa que ya no hay nada
// pendiente: lo que se descartó o se guardó no debe seguir bloqueando la navegación.
export function useAvisarSucio(sucio, alCambiar) {
    const callback = useRef(alCambiar);
    useEffect(() => {
        callback.current = alCambiar;
    });
    useEffect(() => {
        callback.current?.(Boolean(sucio));
    }, [sucio]);
    useEffect(
        () => () => {
            callback.current?.(false);
        },
        [],
    );
}

export default useAvisarSucio;
