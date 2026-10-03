'use client';

import { useCallback, useMemo, useState } from 'react';
import { impactoTiempo, reporteFiltros, reporteGrupo, reportePeriodo } from '@/lib/api/reportes.js';
import { useApiQuery } from '@/hooks/data';

const PAGINA_RPC = 200;
export const FILAS_POR_PAGINA = 25;

// La exportación necesita todas las filas: se piden las páginas siguientes hasta cubrir `total`.
async function cargarGrupoCompleto({ idGrupo }) {
    const primera = await reporteGrupo({ idGrupo, limit: PAGINA_RPC, offset: 0 });
    const items = [...(primera.items || [])];
    while (items.length < (primera.total || 0)) {
        const sig = await reporteGrupo({ idGrupo, limit: PAGINA_RPC, offset: items.length });
        if (!sig.items?.length) break;
        items.push(...sig.items);
    }
    return { ...primera, items };
}

async function cargarPeriodoCompleto({ periodo }) {
    const primera = await reportePeriodo({ periodo, limit: PAGINA_RPC, offset: 0 });
    const items = [...(primera.items || [])];
    while (items.length < (primera.total || 0)) {
        const sig = await reportePeriodo({ periodo, limit: PAGINA_RPC, offset: items.length });
        if (!sig.items?.length) break;
        items.push(...sig.items);
    }
    return { ...primera, items };
}

const consultaDetalle = ({ idGrupo, idAlumno }) => reporteGrupo({ idGrupo, idAlumno, limit: 1 });

// La URL es el estado compartible (?periodo&grupo&alumno): se actualiza con replaceState, sin recargar.
function escribirUrl(v) {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams();
    if (v.periodo) q.set('periodo', v.periodo);
    if (v.idGrupo) q.set('grupo', String(v.idGrupo));
    if (v.idAlumno) q.set('alumno', String(v.idAlumno));
    const s = q.toString();
    window.history.replaceState(null, '', s ? `?${s}` : window.location.pathname);
}

export default function useReporteAsistencia(filtrosIniciales = {}) {
    const [valor, setValor] = useState({
        periodo: filtrosIniciales.periodo || '',
        idGrupo: filtrosIniciales.idGrupo || null,
        idAlumno: filtrosIniciales.idAlumno || null,
    });
    const [pagina, setPagina] = useState(0);

    const filtros = useApiQuery(reporteFiltros, valor.periodo ? { periodo: valor.periodo } : {});
    const periodo = valor.periodo || filtros.data?.periodo_actual || filtros.data?.periodo || '';
    const listoFiltros = Boolean(filtros.data);
    const hayGrupo = Boolean(valor.idGrupo);

    const grupo = useApiQuery(cargarGrupoCompleto, { idGrupo: valor.idGrupo }, { enabled: listoFiltros && hayGrupo });
    const periodoRep = useApiQuery(cargarPeriodoCompleto, { periodo }, { enabled: listoFiltros && !hayGrupo && Boolean(periodo) });
    const detalle = useApiQuery(consultaDetalle, { idGrupo: valor.idGrupo, idAlumno: valor.idAlumno },
        { enabled: listoFiltros && hayGrupo && Boolean(valor.idAlumno) });
    const impacto = useApiQuery(impactoTiempo, hayGrupo ? { idGrupo: valor.idGrupo, periodo } : { periodo },
        { enabled: listoFiltros && Boolean(periodo) });

    const cambiar = useCallback((nuevo) => {
        const v = { periodo: nuevo.periodo ?? '', idGrupo: nuevo.idGrupo ?? null, idAlumno: nuevo.idAlumno ?? null };
        setValor(v);
        setPagina(0);
        escribirUrl(v);
    }, []);

    const abrirGrupo = useCallback((idGrupo) => cambiar({ periodo, idGrupo, idAlumno: null }), [cambiar, periodo]);

    const alumnos = useMemo(
        () => (grupo.data?.items || []).map((a) => ({ idAlumno: a.id_alumno, nombreCompleto: `${a.nombre_completo} (${a.matricula})` })),
        [grupo.data],
    );
    const filas = useMemo(() => {
        const todas = grupo.data?.items || [];
        return valor.idAlumno ? todas.filter((a) => a.id_alumno === valor.idAlumno) : todas;
    }, [grupo.data, valor.idAlumno]);

    return {
        valor: { ...valor, periodo }, cambiar, abrirGrupo, filtros, grupo, periodoRep, detalle, impacto, alumnos, filas,
        pagina, setPagina,
        filasPagina: filas.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA),
    };
}
