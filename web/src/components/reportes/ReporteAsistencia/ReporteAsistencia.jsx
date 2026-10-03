'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';
import Pagination from '@/components/ui/Pagination';
import StatusChip from '@/components/ui/StatusChip';
import PageHeader from '@/components/layout/PageHeader';
import FiltrosReporte from '../FiltrosReporte';
import IndicadoresGrupo from '../IndicadoresGrupo';
import TablaReporte from '../TablaReporte';
import TablaPeriodo from '../TablaPeriodo';
import ImpactoTiempo from '../ImpactoTiempo';
import BotonesExportar from '../BotonesExportar';
import HojaImpresion from '../HojaImpresion';
import { fechaCorta } from '../reporte.utils.js';
import useReporteAsistencia, { FILAS_POR_PAGINA } from './useReporteAsistencia.js';

function DetalleAlumno({ detalle }) {
    const filas = detalle || [];
    return (
        <Card title="Detalle por sesión">
            {filas.length === 0 ? (
                <EmptyState title="Sin sesiones registradas para este alumno." />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-max text-sm">
                        <thead className="text-left text-muted-foreground">
                            <tr>
                                {['Fecha', 'Hora', 'Estado', 'Origen', 'Justificante'].map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((d) => (
                                <tr key={d.id_sesion} className="border-t border-border">
                                    <td className="px-3 py-2">{fechaCorta(d.fecha)}</td>
                                    <td className="px-3 py-2">{String(d.hora_inicio || '').slice(0, 5)}</td>
                                    <td className="px-3 py-2">{d.estado ? <StatusChip kind="asistencia" value={d.estado} size="sm" /> : 'Sin registro'}</td>
                                    <td className="px-3 py-2">{d.origen ? <StatusChip kind="origen" value={d.origen} size="sm" /> : '—'}</td>
                                    <td className="px-3 py-2">{d.justificante_estatus ? <StatusChip kind="justificante" value={d.justificante_estatus} size="sm" /> : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}

// Contenedor de P-07: filtros -> indicadores -> tabla -> exportación. Sin reglas de negocio.
export default function ReporteAsistencia({ filtrosIniciales = {} }) {
    const r = useReporteAsistencia(filtrosIniciales);
    const hayGrupo = Boolean(r.valor.idGrupo);
    const grupos = r.filtros.data?.grupos || [];
    const alumnoSel = r.alumnos.find((a) => a.idAlumno === r.valor.idAlumno);
    const reporteExport = hayGrupo ? (r.grupo.data ? { ...r.grupo.data, items: r.filas } : null) : r.periodoRep.data;

    return (
        <div>
            <HojaImpresion reporte={reporteExport} tipo={hayGrupo ? 'grupo' : 'periodo'}
                filtros={{ periodo: r.valor.periodo, alumno: alumnoSel?.nombreCompleto }} />
            <div className="print:hidden">
                <PageHeader
                    title="Reporte de asistencia"
                    subtitle="Acumulados por grupo y periodo, con derecho a examen."
                    actions={
                        <>
                            {hayGrupo && (
                                <Link href={`/analitica?grupo=${r.valor.idGrupo}`} className="inline-flex min-h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
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
                            <FiltrosReporte periodos={f.periodos || []} grupos={f.grupos || []} alumnos={r.alumnos} valor={r.valor} onCambio={r.cambiar} />
                            {grupos.length === 0 ? (
                                <EmptyState title="No hay grupos para este periodo." />
                            ) : hayGrupo ? (
                                <DataState loading={r.grupo.loading} error={r.grupo.error} data={r.grupo.data} onRetry={r.grupo.refetch}
                                    isEmpty={() => false}>
                                    {(g) => (
                                        <div className="flex flex-col gap-4">
                                            <p className="text-sm text-muted-foreground">
                                                {g.grupo.materia_nombre} · Grupo {g.grupo.clave_grupo} · Docente: {g.grupo.docente_nombre}
                                            </p>
                                            {g.kpis.sesiones_programadas === 0 && (
                                                <Alert tone="info">Aún no hay sesiones programadas: el porcentaje se calculará al generar el horario.</Alert>
                                            )}
                                            <IndicadoresGrupo kpis={g.kpis} />
                                            <ImpactoBloque impacto={r.impacto} />
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
                                        </div>
                                    )}
                                </DataState>
                            ) : (
                                <DataState loading={r.periodoRep.loading} error={r.periodoRep.error} data={r.periodoRep.data} onRetry={r.periodoRep.refetch}
                                    isEmpty={(d) => !(d.items || []).length}
                                    empty={<EmptyState title="No hay grupos para este periodo." />}>
                                    {(p) => (
                                        <div className="flex flex-col gap-4">
                                            <ImpactoBloque impacto={r.impacto} />
                                            <TablaPeriodo items={p.items} onAbrirGrupo={r.abrirGrupo} />
                                        </div>
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

// Si el impacto falla no bloquea el reporte: solo se omite la tarjeta.
function ImpactoBloque({ impacto }) {
    if (impacto.loading && !impacto.data) return null;
    if (!impacto.data) return null;
    return <ImpactoTiempo impacto={impacto.data} />;
}
