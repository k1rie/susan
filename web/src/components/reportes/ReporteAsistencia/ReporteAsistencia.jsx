'use client';

import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/layout/PageHeader';
import FiltrosReporte from '../FiltrosReporte';
import TablaReporte from '../TablaReporte';
import TablaPeriodo from '../TablaPeriodo';
import ResumenGrupo from '../ResumenGrupo';
import ResumenPeriodo from '../ResumenPeriodo';
import DetalleAlumno from '../DetalleAlumno';
import PestanasReporte from '../PestanasReporte';
import BotonesExportar from '../BotonesExportar';
import HojaImpresion from '../HojaImpresion';
import useReporteAsistencia, { FILAS_POR_PAGINA } from './useReporteAsistencia.js';

// Contenedor de P-07: filtros -> pestañas (Resumen con cifras y gráficas / detalle en tabla) -> exportación. Sin reglas de negocio.
// Al imprimir solo se muestra HojaImpresion, que lleva TODAS las filas (las pestañas no recortan el papel).
export default function ReporteAsistencia({ filtrosIniciales = {} }) {
    const r = useReporteAsistencia(filtrosIniciales);
    // Con un enlace directo a un alumno (?grupo&alumno) se aterriza en su historial por sesión, igual que al elegirlo en el filtro.
    const [pestana, setPestana] = useState(filtrosIniciales.idGrupo && filtrosIniciales.idAlumno ? 'detalle' : 'resumen');
    const hayGrupo = Boolean(r.valor.idGrupo);
    const grupos = r.filtros.data?.grupos || [];
    const alumnoSel = r.alumnos.find((a) => a.idAlumno === r.valor.idAlumno);
    const reporteExport = hayGrupo ? (r.grupo.data ? { ...r.grupo.data, items: r.filas } : null) : r.periodoRep.data;
    // Si el impacto falla no bloquea el reporte: solo se omite la tarjeta.
    const impacto = r.impacto.data || null;

    // Al elegir un alumno lo que interesa es su historial por sesión: se abre la pestaña de detalle. Si cambia el periodo o el
    // grupo se empieza de nuevo en el resumen (la pestaña "detalle" de un grupo no es la del periodo ni la de otro grupo).
    const alCambiarFiltros = (nuevo) => {
        if (nuevo.idAlumno && nuevo.idAlumno !== r.valor.idAlumno) setPestana('detalle');
        else if ((nuevo.idGrupo ?? null) !== (r.valor.idGrupo ?? null) || (nuevo.periodo ?? '') !== r.valor.periodo) setPestana('resumen');
        r.cambiar(nuevo);
    };
    const verDetalle = () => setPestana('detalle');
    const abrirGrupo = (idGrupo) => {
        setPestana('resumen');
        r.abrirGrupo(idGrupo);
    };

    return (
        <div>
            <HojaImpresion reporte={reporteExport} tipo={hayGrupo ? 'grupo' : 'periodo'}
                filtros={{ periodo: r.valor.periodo, alumno: alumnoSel?.nombreCompleto }} />
            <div className="print:hidden">
                <PageHeader
                    title="Reporte de asistencia"
                    subtitle="Asistencia acumulada y derecho a examen."
                    actions={
                        <>
                            {hayGrupo && (
                                <Link href={`/analitica?grupo=${r.valor.idGrupo}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                                    <BarChart3 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                                    Ver analítica
                                </Link>
                            )}
                            <BotonesExportar reporte={reporteExport} tipo={hayGrupo ? 'grupo' : 'periodo'} />
                        </>
                    }
                />
                <DataState
                    loading={r.filtros.loading}
                    error={r.filtros.error}
                    data={r.filtros.data}
                    onRetry={r.filtros.refetch}
                    isEmpty={() => false}
                >
                    {(f) => (
                        <div className="flex flex-col gap-4">
                            <FiltrosReporte periodos={f.periodos || []} grupos={f.grupos || []} alumnos={r.alumnos} valor={r.valor} onCambio={alCambiarFiltros} />
                            {grupos.length === 0 ? (
                                <EmptyState title="No hay grupos para este periodo." />
                            ) : hayGrupo ? (
                                <DataState loading={r.grupo.loading} error={r.grupo.error} data={r.grupo.data} onRetry={r.grupo.refetch}
                                    isEmpty={() => false}>
                                    {(g) => (
                                        <div className="flex flex-col gap-4">
                                            <p className="text-sm text-muted-foreground">
                                                {g.grupo.materia_nombre} · Grupo {g.grupo.clave_grupo} · {g.grupo.docente_nombre}
                                            </p>
                                            {g.kpis.sesiones_programadas === 0 && (
                                                <Alert tone="info">Aún no hay sesiones programadas: el porcentaje se calcula al generar el horario.</Alert>
                                            )}
                                            <PestanasReporte
                                                valor={pestana}
                                                onCambio={setPestana}
                                                pestanas={[
                                                    { id: 'resumen', label: 'Resumen' },
                                                    r.valor.idAlumno
                                                        ? { id: 'detalle', label: 'Sesiones' }
                                                        : { id: 'detalle', label: 'Alumnos', count: r.filas.length },
                                                ]}
                                                paneles={{
                                                    resumen: (
                                                        <ResumenGrupo reporte={g} filas={r.filas} impacto={impacto} onVerDetalle={verDetalle}
                                                            nombreAlumno={r.valor.idAlumno ? r.filas[0]?.nombre_completo : undefined} />
                                                    ),
                                                    detalle: (
                                                        <>
                                                            {r.filas.length === 0 ? (
                                                                <EmptyState title="El grupo no tiene alumnos inscritos." />
                                                            ) : (
                                                                <>
                                                                    <TablaReporte items={r.filasPagina} sinSesiones={g.kpis.sesiones_programadas === 0} />
                                                                    <Pagination total={r.filas.length} limit={FILAS_POR_PAGINA} offset={r.pagina * FILAS_POR_PAGINA}
                                                                        onChange={({ offset }) => r.setPagina(Math.floor(offset / FILAS_POR_PAGINA))} />
                                                                </>
                                                            )}
                                                            {r.valor.idAlumno && (
                                                                <DataState loading={r.detalle.loading} error={r.detalle.error} data={r.detalle.data} onRetry={r.detalle.refetch}
                                                                    isEmpty={() => false}>
                                                                    {(d) => <DetalleAlumno detalle={d.detalle} />}
                                                                </DataState>
                                                            )}
                                                        </>
                                                    ),
                                                }}
                                            />
                                        </div>
                                    )}
                                </DataState>
                            ) : (
                                <DataState loading={r.periodoRep.loading} error={r.periodoRep.error} data={r.periodoRep.data} onRetry={r.periodoRep.refetch}
                                    isEmpty={(d) => !(d.items || []).length}
                                    empty={<EmptyState title="No hay grupos para este periodo." />}>
                                    {(p) => (
                                        <PestanasReporte
                                            valor={pestana}
                                            onCambio={setPestana}
                                            pestanas={[{ id: 'resumen', label: 'Resumen' }, { id: 'detalle', label: 'Grupos', count: p.items.length }]}
                                            paneles={{
                                                resumen: <ResumenPeriodo reporte={p} impacto={impacto} />,
                                                detalle: <TablaPeriodo items={p.items} onAbrirGrupo={abrirGrupo} />,
                                            }}
                                        />
                                    )}
                                </DataState>
                            )}
                        </div>
                    )}
                </DataState>
            </div>
        </div>
    );
}
