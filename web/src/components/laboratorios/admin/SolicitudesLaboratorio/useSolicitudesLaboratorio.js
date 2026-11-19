'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useApiQuery } from '@/hooks/data';
import { laboratoriosListar, laboratorioSolicitudesListar } from '@/lib/api/laboratorios.js';
import { unirPaginas } from '../laboratoriosAdmin.utils.js';
import { useAhoraNegocio } from '../useAhoraNegocio';
import { normalizarPestana } from './solicitudesLaboratorio.utils.js';

const PAGINA = 50;

// Estado de la pantalla: pestaña activa, laboratorios, reloj del plantel y la bandeja de pendientes (que vive aquí, y no en su pestaña,
// para que el contador de «Pendientes» se vea también desde la Agenda y el Historial).
export function useSolicitudesLaboratorio({ pestanaInicial }) {
    const { toast } = useToast();
    const [pestana, setPestana] = useState(() => normalizarPestana(pestanaInicial));
    const pendientes = useApiQuery(laboratorioSolicitudesListar, { estatus: 'pendiente', limit: PAGINA });
    const laboratorios = useApiQuery(laboratoriosListar, {});
    const reloj = useAhoraNegocio();
    const [extras, setExtras] = useState([]);
    const [cargandoMas, setCargandoMas] = useState(false);

    const lista = unirPaginas(pendientes.data?.items ?? [], extras);
    const total = pendientes.data?.conteos?.pendiente ?? pendientes.data?.total ?? lista.length;

    // «Ver más»: la siguiente página de pendientes se agrega a la lista.
    const cargarMas = async () => {
        setCargandoMas(true);
        try {
            const r = await laboratorioSolicitudesListar({ estatus: 'pendiente', limit: PAGINA, offset: lista.length });
            setExtras((e) => [...e, ...(r.items ?? [])]);
        } catch (error) {
            toast({ tone: 'danger', title: 'No se pudieron cargar más solicitudes', message: error.message });
        } finally {
            setCargandoMas(false);
        }
    };

    // Recarga la bandeja y los contadores. Las páginas extra se descartan: su `conflicto` y `compite` pudieron cambiar con la decisión.
    const recargar = async () => {
        setExtras([]);
        await pendientes.refetch();
    };

    return {
        pestana,
        cambiarPestana: setPestana,
        pendientes: { consulta: pendientes, lista, total, cargandoMas, cargarMas, recargar },
        contadorPendientes: pendientes.data ? total : null,
        laboratorios,
        ahora: reloj.ahora,
        hoy: reloj.hoy,
    };
}

export default useSolicitudesLaboratorio;
