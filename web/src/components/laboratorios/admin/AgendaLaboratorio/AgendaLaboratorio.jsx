'use client';

import clsx from 'clsx';
import { ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';
import { formatoFechaCorta, rangoHoras } from '../../laboratorios.utils.js';
import { etiquetaLaboratorio } from '../laboratoriosAdmin.utils.js';
import { etiquetaSemana, tipoDeBloque, TIPOS_BLOQUE } from './agendaLaboratorio.utils.js';
import { useAgendaLaboratorio } from './useAgendaLaboratorio.js';

function Bloque({ bloque }) {
    const tipo = TIPOS_BLOQUE[tipoDeBloque(bloque)];
    return (
        <li className={clsx('rounded-lg border p-3', tipo.estilo)}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-medium tabular-nums">{rangoHoras(bloque.hora_inicio, bloque.hora_fin)}</span>
                <Badge tone={tipo.tono}>{tipo.etiqueta}</Badge>
            </div>
            <p className="mt-1 break-words text-sm font-medium">
                {bloque.clave_grupo} · {bloque.materia_nombre}
            </p>
            {bloque.docente_nombre && <p className="break-words text-sm text-muted-foreground">Docente: {bloque.docente_nombre}</p>}
        </li>
    );
}

// Agenda semanal de un laboratorio: por cada día de lunes a domingo, lo que lo ocupa (clases del grupo asignado, solicitudes aprobadas y
// pendientes) con el grupo, la materia, el horario y el docente. En lugar de una rejilla de horas —que a 360 px desbordaría— es una lista
// por día; el tipo de cada bloque va siempre escrito, además del color y del borde.
//   laboratorios   resultado de useApiQuery(laboratoriosListar).
//   hoy            'AAAA-MM-DD' del plantel (null mientras llega): marca el día de hoy y fija la semana inicial.
export default function AgendaLaboratorio({ laboratorios, hoy = null }) {
    const a = useAgendaLaboratorio({ laboratorios, hoy });
    const labs = laboratorios?.data?.items ?? [];

    if (laboratorios?.error && !laboratorios.data) {
        return <ErrorState error={laboratorios.error} onRetry={laboratorios.refetch} />;
    }
    if (laboratorios?.loading && !laboratorios.data) {
        return (
            <p role="status" className="py-10 text-center text-sm text-muted-foreground">
                Cargando laboratorios…
            </p>
        );
    }
    if (labs.length === 0) {
        return (
            <EmptyState
                icon={<FlaskConical aria-hidden="true" className="size-6" strokeWidth={1.5} />}
                title="Aún no hay laboratorios registrados"
                description="Marca un aula como laboratorio en el catálogo para que los docentes puedan solicitarla y aquí veas su agenda."
                action={<Button href="/admin/aulas">Ir a aulas</Button>}
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <Field label="Laboratorio" className="sm:w-72">
                    <Select
                        value={String(a.idAula ?? '')}
                        onChange={(e) => a.elegirLaboratorio(e.target.value)}
                        options={labs.map((lab) => ({ value: String(lab.id_aula), label: etiquetaLaboratorio(lab) }))}
                    />
                </Field>
                <div className="flex items-center gap-2" role="group" aria-label="Cambiar de semana">
                    <Button
                        variant="secondary"
                        aria-label="Semana anterior"
                        icon={<ChevronLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                        disabled={!a.lunes}
                        onClick={a.irAnterior}
                    />
                    <Button variant="secondary" disabled={!hoy || a.esSemanaActual} onClick={a.irHoy}>
                        Hoy
                    </Button>
                    <Button
                        variant="secondary"
                        aria-label="Semana siguiente"
                        icon={<ChevronRight aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                        disabled={!a.lunes}
                        onClick={a.irSiguiente}
                    />
                </div>
            </div>

            {!a.lunes ? (
                <p role="status" className="py-10 text-center text-sm text-muted-foreground">
                    Cargando agenda…
                </p>
            ) : (
                <>
                    <div>
                        <p className="text-sm font-medium">{etiquetaSemana(a.lunes, hoy)}</p>
                        <p role="status" className="text-sm text-muted-foreground">
                            {a.consulta.error ? 'No se pudo cargar la agenda.' : (a.resumen ?? 'Cargando agenda…')}
                        </p>
                    </div>

                    {a.consulta.error && !a.consulta.data ? (
                        <ErrorState error={a.consulta.error} onRetry={a.consulta.refetch} compact />
                    ) : (
                        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {a.dias.map((dia) => (
                                <li key={dia.fecha} className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
                                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                                        {formatoFechaCorta(dia.fecha, hoy)}
                                        {dia.fecha === hoy && <Badge tone="info">Hoy</Badge>}
                                    </h2>
                                    {dia.bloques.length > 0 ? (
                                        <ul className="mt-2 flex flex-col gap-2">
                                            {dia.bloques.map((bloque, i) => (
                                                <Bloque key={`${bloque.tipo}-${bloque.id_solicitud ?? 'c'}-${bloque.hora_inicio}-${i}`} bloque={bloque} />
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="mt-1 text-sm text-muted-foreground">{a.consulta.data ? 'Libre todo el día.' : '—'}</p>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                </>
            )}
        </div>
    );
}
