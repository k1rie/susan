'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { laboratorioResolver } from '@/lib/api/laboratorios.js';
import { cambioElEstado } from '../laboratoriosAdmin.utils.js';

// Resolución de una solicitud pendiente: qué diálogo está abierto ('aprobar' | 'rechazar' | null) y la llamada a la RPC.
//   onResuelta()   la solicitud se aprobó o rechazó: quien lo usa recarga la bandeja y los contadores.
//   onRecargar()   el servidor dijo que la solicitud ya no es como se veía (LAB_OCUPADO, SOLICITUD_VENCIDA...): recarga la bandeja.
export function useSolicitudPendiente({ solicitud, onResuelta, onRecargar }) {
    const { toast } = useToast();
    const { run } = useApiMutation(laboratorioResolver);
    const [dialogo, setDialogo] = useState(null);

    // Devuelve una promesa que el diálogo espera: si resuelve se cierra; si lanza, muestra el mensaje y sigue abierto con lo escrito.
    const resolver = async (aprobar, comentario) => {
        try {
            await run({ idSolicitud: solicitud.id_solicitud, aprobar, comentario: comentario || undefined });
        } catch (error) {
            if (!cambioElEstado(error)) throw error;
            // La solicitud cambió desde que se cargó la lista (otro administrador, el reloj, un conflicto nuevo): se dice por qué y se
            // recarga para que la tarjeta muestre lo real.
            setDialogo(null);
            toast({ tone: 'danger', title: aprobar ? 'No se pudo aprobar' : 'No se pudo rechazar', message: error.message });
            await onRecargar?.();
            return;
        }
        setDialogo(null);
        toast({ tone: 'success', title: aprobar ? 'Solicitud aprobada' : 'Solicitud rechazada' });
        await onResuelta?.();
    };

    return { dialogo, abrir: setDialogo, cerrar: () => setDialogo(null), resolver };
}

export default useSolicitudPendiente;
