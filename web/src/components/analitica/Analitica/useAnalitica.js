'use client';

import { useCallback, useMemo } from 'react';
import { useApiQuery } from '@/hooks/data';
import { matrizGrupo, serieGrupo } from '@/lib/api/reportes.js';
import { analizarGrupo } from '@/lib/numerics';

const PAGINA = 200;

// La matriz viene paginada por alumno (máx. 200): se repite hasta cubrir `total`.
export async function matrizCompleta({ idGrupo }) {
    let offset = 0;
    let total = Infinity;
    let fechas = [];
    const alumnos = [];
    while (offset < total) {
        const pag = await matrizGrupo({ idGrupo, limit: PAGINA, offset });
        fechas = pag.fechas || fechas;
        alumnos.push(...(pag.alumnos || []));
        total = Number(pag.total ?? alumnos.length);
        if (!pag.alumnos || pag.alumnos.length === 0) break;
        offset += pag.alumnos.length;
    }
    return { fechas, alumnos, total: alumnos.length };
}

/**
 * Carga serie y matriz del grupo y ejecuta analizarGrupo en el cliente.
 * @returns {{ estado: 'sin_grupo'|'cargando'|'error'|'vacio'|'listo', error, serie, matriz, analisis, recargar: () => void }}
 */
export function useAnalitica({ idGrupo }) {
    const activo = Boolean(idGrupo);
    const args = idGrupo ? { idGrupo } : undefined;
    const s = useApiQuery(serieGrupo, args, { enabled: activo });
    const m = useApiQuery(matrizCompleta, args, { enabled: activo });

    const serie = activo ? s.data : null;
    const matriz = activo ? m.data : null;

    const { analisis, errorAnalisis } = useMemo(() => {
        if (!serie || !matriz) return { analisis: null, errorAnalisis: null };
        try {
            return {
                analisis: analizarGrupo({
                    serie,
                    matriz,
                    limitePct: serie.limite_pct,
                    sesionesProgramadas: serie.sesiones_programadas,
                    retardosPorAusencia: serie.retardos_por_ausencia,
                }),
                errorAnalisis: null,
            };
        } catch (e) {
            return { analisis: null, errorAnalisis: e };
        }
    }, [serie, matriz]);

    const recargar = useCallback(() => {
        s.refetch();
        m.refetch();
    }, [s, m]);

    const error = (activo && (s.error || m.error)) || errorAnalisis || null;
    let estado;
    if (!activo) estado = 'sin_grupo';
    else if (error && !analisis) estado = 'error';
    else if (!analisis) estado = 'cargando';
    else if (analisis.resumen.sesionesCerradas === 0) estado = 'vacio';
    else estado = 'listo';
    return { estado, error, serie, matriz, analisis, recargar };
}
