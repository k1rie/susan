'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation, useApiQuery } from '@/hooks/data';
import { laboratorioCancelar, laboratorioSolicitudesListar } from '@/lib/api/laboratorios.js';
import { useRelojPlantel } from '../compartido/useRelojPlantel.js';
import { estatusDeFiltro, filtroTrasCrear, PAGINA, unirPaginas } from './laboratoriosDocente.utils.js';

// Códigos con los que el servidor avisa que la solicitud ya cambió de estado: la lista en pantalla quedó desactualizada.
const CODIGOS_DESACTUALIZADO = new Set(['SOLICITUD_YA_RESUELTA', 'SOLICITUD_VENCIDA', 'NO_ENCONTRADO']);

// Cada minuto se vuelve a pedir la hora del plantel: una aprobada que ya inició deja de ofrecer «Cancelar» aunque la pestaña siga abierta.
const SONDEO_RELOJ_MS = 60_000;

// Estado de «Laboratorios» del docente: lista filtrada por estatus (en el servidor) con «Ver más», panel de nueva solicitud y
// cancelación con motivo opcional. Los contadores de las píldoras se conservan mientras llega la respuesta de otro filtro.
export function useLaboratoriosDocente() {
    const { toast } = useToast();
    const reloj = useRelojPlantel({ sondeoMs: SONDEO_RELOJ_MS });
    const [filtro, setFiltro] = useState('todas');
    const [panelAbierto, setPanelAbierto] = useState(false);
    const [porCancelar, setPorCancelar] = useState(null);
    const [extras, setExtras] = useState({ filtro: 'todas', items: [] });
    const [cargandoMas, setCargandoMas] = useState(false);
    const [conteos, setConteos] = useState(null);

    const lista = useApiQuery(laboratorioSolicitudesListar, { estatus: estatusDeFiltro(filtro), limit: PAGINA });
    const respuesta = lista.data;
    // Los contadores no dependen del filtro; se guardan para no hacer desaparecer las píldoras mientras llega otra respuesta.
    if (respuesta?.conteos && respuesta.conteos !== conteos) setConteos(respuesta.conteos);

    const items = unirPaginas(respuesta?.items, extras.filtro === filtro ? extras.items : []);
    const total = respuesta?.total ?? items.length;

    const cancelacion = useApiMutation(laboratorioCancelar);

    // Al cambiar de filtro se descartan las páginas de «Ver más» del anterior: al volver estarían desactualizadas.
    const cambiarFiltro = (id) => {
        setFiltro(id);
        setExtras({ filtro: id, items: [] });
    };

    const recargar = async () => {
        setExtras({ filtro, items: [] });
        return lista.refetch();
    };

    const cargarMas = async () => {
        setCargandoMas(true);
        try {
            const r = await laboratorioSolicitudesListar({ estatus: estatusDeFiltro(filtro), limit: PAGINA, offset: items.length });
            // Si mientras llegaba la página la persona cambió de filtro, esa página ya no corresponde: se descarta.
            setExtras((e) => (e.filtro === filtro ? { filtro, items: [...e.items, ...(r.items ?? [])] } : e));
        } catch (e) {
            toast({ tone: 'danger', message: e.message });
        } finally {
            setCargandoMas(false);
        }
    };

    // Una solicitud nueva nace pendiente: se avisa dónde quedó y la lista se refresca (o cambia de filtro si el actual la ocultaría).
    const alCrear = () => {
        toast({ tone: 'success', title: 'Solicitud enviada', message: 'Queda pendiente hasta que el administrador la revise.' });
        const siguiente = filtroTrasCrear(filtro);
        if (siguiente === filtro) recargar();
        else cambiarFiltro(siguiente);
    };

    const pedirCancelar = (solicitud) => {
        cancelacion.reset();
        setPorCancelar(solicitud);
    };

    // Devuelve la promesa: ConfirmDialog mantiene el botón en «cargando» y, si rechaza, deja el diálogo abierto para mostrar el error.
    const confirmarCancelar = async (comentario) => {
        try {
            await cancelacion.run({ idSolicitud: porCancelar.id_solicitud, comentario: comentario || undefined });
        } catch (e) {
            if (CODIGOS_DESACTUALIZADO.has(e.code)) recargar();
            throw e;
        }
        toast({ tone: 'success', title: 'Solicitud cancelada' });
        setPorCancelar(null);
        await recargar();
    };

    return {
        reloj,
        filtro,
        cambiarFiltro,
        lista,
        conteos,
        items,
        total,
        hayMas: items.length < total,
        cargandoMas,
        cargarMas,
        panelAbierto,
        abrirPanel: () => setPanelAbierto(true),
        cerrarPanel: () => setPanelAbierto(false),
        alCrear,
        porCancelar,
        pedirCancelar,
        cerrarCancelar: () => setPorCancelar(null),
        confirmarCancelar,
        cancelacion,
    };
}

export default useLaboratoriosDocente;
