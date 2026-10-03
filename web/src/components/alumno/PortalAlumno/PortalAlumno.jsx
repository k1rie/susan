'use client';

import { useRef } from 'react';
import Card from '@/components/ui/Card';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';
import PageHeader from '@/components/layout/PageHeader';
import ResumenMaterias from '../ResumenMaterias';
import HistorialMateria from '../HistorialMateria';
import MisJustificantes from '../MisJustificantes';
import RegistrarJustificanteForm from '../RegistrarJustificanteForm';
import usePortalAlumno, { FILAS_HISTORIAL } from './usePortalAlumno.js';

// Contenedor de P-08: resumen por materia, historial de la materia elegida y justificantes.
export default function PortalAlumno({ idSesionInicial = null, encabezado = true }) {
    const p = usePortalAlumno({ idSesionInicial });
    const seccionJustificantes = useRef(null);
    const periodos = p.resumen.data?.periodos_disponibles || [];

    const alJustificar = (s) => {
        p.justificar(s);
        seccionJustificantes.current?.scrollIntoView?.({ block: 'start' });
    };

    return (
        <div className="flex flex-col gap-6">
            {encabezado && <PageHeader title="Mi asistencia" subtitle="Tu avance por materia frente al límite de faltas para tener derecho a examen." />}
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
                        <section aria-labelledby="t-materias">
                            <h2 id="t-materias" className="mb-2 text-lg font-semibold">Resumen por materia</h2>
                            <ResumenMaterias items={d.items} idGrupoSeleccionado={p.grupoActivo} onSeleccionar={p.elegirGrupo} />
                        </section>
                        <section aria-labelledby="t-historial">
                            <h2 id="t-historial" className="mb-2 text-lg font-semibold">
                                Historial{p.historial.data?.grupo?.materia ? ` · ${p.historial.data.grupo.materia.nombre ?? p.historial.data.grupo.materia}` : ''}
                            </h2>
                            <DataState loading={p.historial.loading} error={p.historial.error} data={p.historial.data} onRetry={p.historial.refetch}
                                isEmpty={() => false}>
                                {(h) => (
                                    <HistorialMateria items={h.items} total={h.total} limit={FILAS_HISTORIAL} offset={p.offset}
                                        onPagina={p.setOffset} onJustificar={alJustificar} />
                                )}
                            </DataState>
                        </section>
                    </>
                )}
            </DataState>
            <section ref={seccionJustificantes} aria-labelledby="t-just" className="flex flex-col gap-4">
                <h2 id="t-just" className="text-lg font-semibold">Justificantes</h2>
                <Card title="Registrar justificante" padded={false} className="border-0">
                    <RegistrarJustificanteForm idSesion={p.idSesionJustificar} onRegistrado={p.alRegistrado} key={p.idSesionJustificar ?? 'sin'} />
                </Card>
                <div>
                    <h3 className="mb-2 font-semibold">Mis justificantes</h3>
                    <MisJustificantes refreshKey={p.refreshKey} />
                </div>
            </section>
        </div>
    );
}
