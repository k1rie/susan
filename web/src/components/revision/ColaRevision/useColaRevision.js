'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useApiQuery } from '@/hooks/data';
import { colaRevision } from '@/lib/api/revision.js';
import {
    CAMPO_CONTADOR,
    CAMPO_LISTA,
    idDeCaso,
    normalizarCaso,
    normalizarPestana,
    siguienteCaso,
    unirListas,
    urlRevision,
} from './colaRevision.utils.js';

const PAGINA = 50;
const SIN_EXTRAS = { pendientes: [], justificantes: [], correcciones: [] };

// Estado de la cola: datos, pestaña, caso seleccionado (sincronizado con ?pestana y ?caso), «Ver más»
// y recarga tras cada acción con selección del siguiente caso.
export function useColaRevision({ pestanaInicial, casoInicial }) {
    const router = useRouter();
    const ruta = usePathname();
    const { toast } = useToast();
    const cola = useApiQuery(colaRevision, {});
    const [pestana, setPestana] = useState(() => normalizarPestana(pestanaInicial));
    const [casoId, setCasoId] = useState(() => normalizarCaso(casoInicial));
    const [extras, setExtras] = useState(SIN_EXTRAS);
    const [cargandoMas, setCargandoMas] = useState(false);

    const data = cola.data;
    const lista = unirListas(pestana, data?.[CAMPO_LISTA[pestana]] ?? [], extras[pestana]);
    const total = data?.contadores?.[CAMPO_CONTADOR[pestana]] ?? lista.length;
    const seleccionado = casoId ? lista.find((i) => idDeCaso(pestana, i) === casoId) ?? null : null;

    const sincronizar = useCallback(
        (p, c) => router.replace(urlRevision(ruta, p, c), { scroll: false }),
        [router, ruta],
    );

    const cambiarPestana = (p) => {
        setPestana(p);
        setCasoId(null);
        sincronizar(p, null);
    };

    const seleccionar = (id) => {
        setCasoId(id);
        sincronizar(pestana, id);
    };

    const cargarMas = async () => {
        setCargandoMas(true);
        try {
            const r = await colaRevision({ pestana, limit: PAGINA, offset: lista.length });
            setExtras((e) => ({ ...e, [pestana]: [...e[pestana], ...(r[CAMPO_LISTA[pestana]] ?? [])] }));
        } catch (e) {
            toast({ tone: 'danger', message: e.message });
        } finally {
            setCargandoMas(false);
        }
    };

    // Recarga la cola. Si se indica `resuelto`, selecciona el siguiente caso (en pantalla angosta vuelve a la lista).
    const recargar = async (resuelto = null) => {
        const anterior = lista;
        const r = await cola.refetch();
        setExtras(SIN_EXTRAS);
        if (!r.ok) return;
        if (resuelto == null) return;
        const nueva = r.data?.[CAMPO_LISTA[pestana]] ?? [];
        const ancho = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
        const siguiente = ancho ? siguienteCaso(pestana, anterior, resuelto, nueva) : null;
        setCasoId(siguiente);
        sincronizar(pestana, siguiente);
    };

    return {
        cola, data, pestana, lista, total, seleccionado, casoId, cargandoMas,
        cambiarPestana, seleccionar, cargarMas, recargar,
    };
}
