'use client';

import { useCallback, useMemo, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useApiQuery } from '@/hooks/data';
import { reporteFiltros } from '@/lib/api/reportes.js';
import { construirCsvAnalisis } from '../analitica.utils.js';
import AlertasAnalitica from '../AlertasAnalitica';
import GraficaAcumulado from '../GraficaAcumulado';
import GraficaSerie from '../GraficaSerie';
import PanelProcedimiento from '../PanelProcedimiento';
import PatronSemanal from '../PatronSemanal';
import SelectorGrupo from '../SelectorGrupo';
import TablaRiesgo from '../TablaRiesgo';
import TarjetasAnalitica from '../TarjetasAnalitica';
import { useAnalitica } from './useAnalitica.js';

// Contenedor de /analitica: selector, cifras clave, alertas, gráficas, riesgo y procedimiento numérico (plegado).
export default function Analitica({ filtrosIniciales = {} }) {
    const { toast } = useToast();
    const [valor, setValor] = useState({ periodo: filtrosIniciales.periodo || '', idGrupo: filtrosIniciales.idGrupo || null });
    const filtros = useApiQuery(reporteFiltros, valor.periodo ? { periodo: valor.periodo } : {});
    const { estado, error, analisis, serie, recargar } = useAnalitica({ idGrupo: valor.idGrupo });

    const periodoEfectivo = valor.periodo || filtros.data?.periodo || '';
    const grupos = useMemo(() => filtros.data?.grupos || [], [filtros.data]);
    const grupoActual = grupos.find((g) => g.id_grupo === valor.idGrupo);

    const cambiar = useCallback((nuevo) => {
        setValor(nuevo);
        try {
            const q = new URLSearchParams();
            if (nuevo.periodo) q.set('periodo', nuevo.periodo);
            if (nuevo.idGrupo) q.set('grupo', String(nuevo.idGrupo));
            window.history.replaceState(null, '', q.size ? `?${q}` : window.location.pathname);
        } catch {
            // la URL es solo una comodidad
        }
    }, []);

    const exportar = () => {
        try {
            const nombreGrupo = grupoActual ? `${grupoActual.materia_nombre} ${grupoActual.clave_grupo}` : String(valor.idGrupo);
            const csv = construirCsvAnalisis(analisis, { grupo: nombreGrupo, periodo: periodoEfectivo });
            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `analitica-${periodoEfectivo || 'periodo'}-grupo-${valor.idGrupo}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo exportar', message: e.message });
        }
    };

    const hrefHistorial = (idAlumno) => {
        const q = new URLSearchParams({ grupo: String(valor.idGrupo), alumno: String(idAlumno) });
        if (periodoEfectivo) q.set('periodo', periodoEfectivo);
        return `/reportes?${q}`;
    };

    const limitePct = analisis?.resumen.limitePct ?? serie?.limite_pct ?? 20;

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Analítica de ausentismo"
                subtitle="Tendencia, proyección y riesgo por grupo."
                actions={
                    estado === 'listo' && (
                        <Button variant="secondary" onClick={exportar}>
                            Exportar resumen CSV
                        </Button>
                    )
                }
            />
            {filtros.error && !filtros.data ? (
                <ErrorState error={filtros.error} onRetry={filtros.refetch} />
            ) : (
                <SelectorGrupo
                    periodos={filtros.data?.periodos || (periodoEfectivo ? [periodoEfectivo] : [])}
                    grupos={grupos}
                    valor={{ periodo: periodoEfectivo, idGrupo: valor.idGrupo }}
                    onCambio={cambiar}
                    deshabilitado={filtros.loading && !filtros.data}
                />
            )}

            {estado === 'sin_grupo' && (
                <EmptyState title="Elige un grupo para analizar." description={grupos.length === 0 && filtros.data ? 'No hay grupos disponibles en este periodo.' : undefined} />
            )}
            {estado === 'cargando' && (
                <div className="flex justify-center py-10" aria-live="polite">
                    <Spinner />
                </div>
            )}
            {estado === 'error' && <ErrorState error={error} onRetry={recargar} />}
            {estado === 'vacio' && (
                <EmptyState
                    title="Este grupo aún no tiene sesiones cerradas."
                    description="El análisis se habilita al cerrar sesiones con asistencia."
                />
            )}
            {estado === 'listo' && (
                <>
                    <TarjetasAnalitica
                        resumen={analisis.resumen}
                        tendencia={analisis.tendencia}
                        proyeccion={analisis.proyeccion}
                        cruceLimite={analisis.cruceLimite}
                        limitePct={limitePct}
                    />
                    <AlertasAnalitica alertas={analisis.alertas} />
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
                        <GraficaSerie
                            tendencia={analisis.tendencia}
                            suavizado={analisis.suavizado}
                            proyeccion={analisis.proyeccion}
                            resumen={analisis.resumen}
                            cruceLimite={analisis.cruceLimite}
                            limitePct={limitePct}
                        />
                        <GraficaAcumulado cruceLimite={analisis.cruceLimite} limitePct={limitePct} />
                    </div>
                    <PatronSemanal patronSemanal={analisis.patronSemanal} />
                    <TablaRiesgo items={analisis.alumnosEnRiesgo} evaluados={analisis.resumen.alumnosEvaluados} hrefHistorial={hrefHistorial} />
                    <PanelProcedimiento procedimientos={analisis.procedimientos} />
                </>
            )}
        </div>
    );
}
