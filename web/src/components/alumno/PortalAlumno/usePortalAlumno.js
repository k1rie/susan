'use client';

import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/data';
import { alumnoHistorial, alumnoResumen } from '@/lib/api/reportes.js';

export const FILAS_HISTORIAL = 8;

export default function usePortalAlumno({ idSesionInicial = null } = {}) {
    const [periodo, setPeriodo] = useState('');
    const [idGrupo, setIdGrupo] = useState(null);
    const [offset, setOffset] = useState(0);
    const [idSesionJustificar, setIdSesionJustificar] = useState(idSesionInicial);
    const [refreshKey, setRefreshKey] = useState(0);

    const resumen = useApiQuery(alumnoResumen, periodo ? { periodo } : {});
    const items = resumen.data?.items;
    // Materia por defecto: la primera del periodo.
    const grupoActivo = idGrupo && items?.some((i) => i.id_grupo === idGrupo) ? idGrupo : items?.[0]?.id_grupo ?? null;
    const historial = useApiQuery(alumnoHistorial, { idGrupo: grupoActivo, limit: FILAS_HISTORIAL, offset }, { enabled: Boolean(grupoActivo) });

    const cambiarPeriodo = useCallback((p) => { setPeriodo(p); setIdGrupo(null); setOffset(0); }, []);
    const elegirGrupo = useCallback((g) => { setIdGrupo(g); setOffset(0); }, []);
    const justificar = useCallback((s) => setIdSesionJustificar(s.id_sesion), []);

    const { refetch: recargarResumen } = resumen;
    const { refetch: recargarHistorial } = historial;
    const alRegistrado = useCallback(() => {
        setRefreshKey((k) => k + 1);
        recargarResumen();
        recargarHistorial();
    }, [recargarResumen, recargarHistorial]);


    return { resumen, historial, periodo: periodo || resumen.data?.periodo || '', cambiarPeriodo, grupoActivo, elegirGrupo,
        offset, setOffset, idSesionJustificar, justificar, refreshKey, alRegistrado };
}
