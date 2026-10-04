'use client';

import { useRef } from 'react';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import PageHeader from '@/components/layout/PageHeader';
import CalendarioRacha from '../CalendarioRacha';
import CifrasMateria from '../CifrasMateria';
import GraficasAsistencia from '../GraficasAsistencia';
import ResumenMaterias from '../ResumenMaterias';
import HistorialMateria from '../HistorialMateria';
import MisJustificantes from '../MisJustificantes';
import RegistrarJustificanteForm from '../RegistrarJustificanteForm';
import { nombreMateria, resumenHistorial } from '../alumno.utils.js';
import usePortalAlumno, { FILAS_HISTORIAL } from './usePortalAlumno.js';

// Mientras llega el calendario se reserva una tarjeta de su alto aproximado (no un círculo suelto): la página no salta al aparecer.
const CARGANDO_CALENDARIO = (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-border bg-card">
        <Spinner label="Cargando calendario" />
    </div>
);

// Contenedor de P-08. De arriba abajo: la tarjeta principal de asistencia y las materias (resumen), y la vista de la materia elegida
// (casillas de cifras, calendario con la racha, historial por sesión); al final, los justificantes.
export default function PortalAlumno({ idSesionInicial = null, encabezado = true }) {
    const p = usePortalAlumno({ idSesionInicial });
    const seccionJustificantes = useRef(null);
    const periodos = p.resumen.data?.periodos_disponibles || [];
    // Fila del resumen de la materia elegida: de ahí salen las casillas de cifras y el texto bajo «Historial».
    const materiaActiva = p.resumen.data?.items?.find((i) => i.id_grupo === p.grupoActivo);

    const alJustificar = (s) => {
        p.justificar(s);
        seccionJustificantes.current?.scrollIntoView?.({ block: 'start' });
    };

    return (
        <div className="flex flex-col gap-6">
            {encabezado && <PageHeader title="Mi asistencia" subtitle="Tu avance frente al límite de faltas." />}
            <DataState loading={p.resumen.loading} error={p.resumen.error} data={p.resumen.data} onRetry={p.resumen.refetch}
                isEmpty={(d) => !(d.items || []).length}
                empty={<EmptyState title="No tienes materias inscritas en este periodo." />}>
                {(d) => (
                    <>
                        {periodos.length > 1 && (
                            <Field label="Periodo" className="max-w-xs">
                                <Select value={p.periodo} onChange={(e) => p.cambiarPeriodo(e.target.value)}
                                    options={periodos.map((x) => ({ value: x, label: x }))} />
                            </Field>
                        )}
                        <section aria-labelledby="t-materias" className="flex flex-col gap-3">
                            <h2 id="t-materias" className="text-xl font-semibold tracking-tight">Resumen por materia</h2>
                            {/* Con una sola materia las gráficas (medidor y anillo) y la tarjeta van lado a lado; con varias, las gráficas arriba y las tarjetas debajo. */}
                            <div className={d.items.length === 1 ? 'grid items-start gap-3 lg:grid-cols-2' : 'flex flex-col gap-3'}>
                                <GraficasAsistencia items={d.items} />
                                <ResumenMaterias items={d.items} idGrupoSeleccionado={p.grupoActivo} onSeleccionar={p.elegirGrupo} />
                            </div>
                        </section>
                        <section aria-labelledby="t-historial" className="flex flex-col gap-3">
                            <div>
                                <h2 id="t-historial" className="text-xl font-semibold tracking-tight">
                                    Historial{p.historial.data?.grupo?.materia ? ` · ${nombreMateria(p.historial.data.grupo.materia)}` : ''}
                                </h2>
                                {p.historial.data && (
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        {resumenHistorial(p.historial.data.total, materiaActiva)}
                                    </p>
                                )}
                            </div>
                            <CifrasMateria item={materiaActiva} />
                            <DataState loading={p.calendario.loading} error={p.calendario.error} data={p.calendario.data} onRetry={p.calendario.refetch}
                                isEmpty={() => false} loadingFallback={CARGANDO_CALENDARIO}>
                                {(c) => <CalendarioRacha items={c.items || []} materia={nombreMateria(c.grupo?.materia) || nombreMateria(materiaActiva?.materia)} />}
                            </DataState>
                            <DataState loading={p.historial.loading} error={p.historial.error} data={p.historial.data} onRetry={p.historial.refetch}
                                isEmpty={() => false}>
                                {(h) => (
                                    <div className="flex flex-col gap-3">
                                        {h.items.length > 0 && <h3 className="text-base font-semibold tracking-tight">Por sesión</h3>}
                                        <HistorialMateria items={h.items} total={h.total} limit={FILAS_HISTORIAL} offset={p.offset}
                                            onPagina={p.setOffset} onJustificar={alJustificar} />
                                    </div>
                                )}
                            </DataState>
                        </section>
                    </>
                )}
            </DataState>
            <section ref={seccionJustificantes} aria-labelledby="t-just" className="flex flex-col gap-3">
                <h2 id="t-just" className="text-xl font-semibold tracking-tight">Justificantes</h2>
                <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                    <RegistrarJustificanteForm idSesion={p.idSesionJustificar} onRegistrado={p.alRegistrado} key={p.idSesionJustificar ?? 'sin'} />
                    <MisJustificantes refreshKey={p.refreshKey} />
                </div>
            </section>
        </div>
    );
}
