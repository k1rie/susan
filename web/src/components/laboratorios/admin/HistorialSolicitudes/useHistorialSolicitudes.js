'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation, useApiQuery } from '@/hooks/data';
import { laboratorioCancelar, laboratorioSolicitudesListar } from '@/lib/api/laboratorios.js';
import { cambioElEstado } from '../laboratoriosAdmin.utils.js';
import { ESTATUS_INICIAL, pastillasHistorial } from './historialSolicitudes.utils.js';

const PAGINA_INICIAL = { limit: 10, offset: 0 };

// Estado del historial: filtros (estatus y laboratorio), paginación y la cancelación de una aprobada.
//   onCambio()   algo cambió en el servidor (se canceló una aprobada): la pestaña de pendientes debe recargar, porque un conflicto pudo
//                quedar libre.
export function useHistorialSolicitudes({ onCambio }) {
    const { toast } = useToast();
    const { run: cancelarSolicitud } = useApiMutation(laboratorioCancelar);
    const [estatus, setEstatus] = useState(ESTATUS_INICIAL);
    const [idAula, setIdAula] = useState('');
    const [pagina, setPagina] = useState(PAGINA_INICIAL);
    const [aCancelar, setACancelar] = useState(null);

    const consulta = useApiQuery(laboratorioSolicitudesListar, {
        estatus,
        idAula: idAula ? Number(idAula) : undefined,
        limit: pagina.limit,
        offset: pagina.offset,
    });

    // Los contadores de las píldoras no deben parpadear al cambiar de filtro (mientras llega la respuesta `data` vale null): se conservan
    // los últimos. Se ajusta durante el render (patrón de React para estado derivado de una prop) en lugar de en un efecto.
    const [conteos, setConteos] = useState(null);
    if (consulta.data?.conteos && consulta.data.conteos !== conteos) setConteos(consulta.data.conteos);

    const cambiarEstatus = (valor) => {
        setEstatus(valor);
        setPagina((p) => ({ ...p, offset: 0 }));
    };
    const cambiarLaboratorio = (valor) => {
        setIdAula(valor);
        setPagina((p) => ({ ...p, offset: 0 }));
    };

    const recargar = async () => {
        const r = await consulta.refetch();
        onCambio?.();
        // Si se canceló la única de la última página, se vuelve a la anterior en lugar de quedarse en una página vacía.
        if (r?.ok && (r.data?.items?.length ?? 0) === 0 && pagina.offset > 0) {
            setPagina((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }));
        }
    };

    // La promesa que espera el diálogo: si resuelve se cierra; si lanza, muestra el mensaje y sigue abierto con el motivo escrito.
    const cancelar = async (comentario) => {
        const solicitud = aCancelar;
        try {
            await cancelarSolicitud({ idSolicitud: solicitud.id_solicitud, comentario });
        } catch (error) {
            if (!cambioElEstado(error)) throw error;
            // Ya empezó, otra persona la canceló o dejó de existir: se explica y se recarga para que la lista diga la verdad.
            setACancelar(null);
            toast({ tone: 'danger', title: 'No se pudo cancelar', message: error.message });
            await recargar();
            return;
        }
        setACancelar(null);
        toast({ tone: 'success', title: 'Solicitud cancelada' });
        await recargar();
    };

    return {
        consulta,
        estatus,
        idAula,
        pagina,
        pastillas: pastillasHistorial(conteos),
        cambiarEstatus,
        cambiarLaboratorio,
        cambiarPagina: ({ offset }) => setPagina((p) => ({ ...p, offset })),
        cambiarTamano: (limit) => setPagina({ limit, offset: 0 }),
        aCancelar,
        pedirCancelar: setACancelar,
        cerrarCancelar: () => setACancelar(null),
        cancelar,
    };
}

export default useHistorialSolicitudes;
