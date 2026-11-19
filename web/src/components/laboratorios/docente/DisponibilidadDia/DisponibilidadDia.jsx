'use client';

import clsx from 'clsx';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import EstatusSolicitud from '../../EstatusSolicitud';
import { formatoFechaCorta, rangoHoras } from '../../laboratorios.utils.js';
import { rotuloEdificio } from '../compartido/rotulos.utils.js';
import { bloquesDelDia, resumenOcupacion, rotuloBloque, textoTraslape } from './disponibilidadDia.utils.js';

// Estilo de la fila que se traslapa con el horario elegido: fondo del estado + el texto que lo dice (nunca solo color).
const TONO_TRASLAPE = {
    duplicada: { fila: 'bg-ausente-bg', texto: 'text-ausente' },
    bloquea: { fila: 'bg-ausente-bg', texto: 'text-ausente' },
    compite: { fila: 'bg-retardo-bg', texto: 'text-retardo' },
};

/**
 * «Disponibilidad ese día»: bloques ocupados de un laboratorio en la fecha elegida (clases y solicitudes vigentes) para que el docente
 * escoja un horario libre. El servidor no envía nombres de otros docentes, solo grupo y materia.
 *
 *   aula         laboratorio elegido ({ clave, edificio }) o null
 *   fecha        'AAAA-MM-DD' de la consulta (los bloques de otra fecha se ignoran: pueden ser de la consulta anterior)
 *   consultable  false mientras falte laboratorio o fecha válida: se muestra la invitación a elegirlos
 *   consulta     { data, loading, error, refetch } de useApiQuery(laboratorioAgenda)
 *   choques      resultado de `traslapes()`: marca las filas que chocan con el horario que la persona está capturando
 */
export default function DisponibilidadDia({ aula, fecha, consultable = true, consulta, choques = [], className }) {
    const titulo = useId();
    const bloques = bloquesDelDia(consulta?.data?.bloques, fecha);
    const nivelDe = new Map(choques.map((c) => [c.bloque, c.nivel]));

    let cuerpo;
    if (!consultable) {
        cuerpo = <p className="mt-1 text-[13px] text-muted-foreground">Elige el laboratorio y una fecha disponible para ver qué horarios están ocupados.</p>;
    } else if (consulta?.loading) {
        cuerpo = (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
                <Spinner size="sm" label="Consultando la disponibilidad" />
                <span aria-hidden="true">Consultando…</span>
            </p>
        );
    } else if (consulta?.error && !consulta?.data) {
        cuerpo = (
            <div className="mt-2 flex flex-col items-start gap-2">
                <Alert tone="warning" compact role="status" className="w-full">
                    No se pudo consultar la disponibilidad. Puedes enviar la solicitud: el sistema revisará el horario.
                </Alert>
                <Button size="sm" variant="secondary" onClick={() => consulta.refetch?.()}>
                    Reintentar
                </Button>
            </div>
        );
    } else if (bloques.length === 0) {
        cuerpo = (
            <p className="mt-2 flex items-start gap-2 text-[13px]">
                <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-presente" strokeWidth={1.75} />
                Sin clases ni solicitudes ese día: el laboratorio está libre.
            </p>
        );
    } else {
        cuerpo = (
            <ul aria-label="Bloques ocupados" className="mt-2 flex flex-col gap-1.5">
                {bloques.map((b, i) => {
                    const nivel = nivelDe.get(b);
                    const tono = nivel ? TONO_TRASLAPE[nivel] : null;
                    return (
                        <li
                            key={`${b.tipo}-${b.hora_inicio}-${b.hora_fin}-${b.clave_grupo}-${i}`}
                            className={clsx('flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px]', tono?.fila)}
                        >
                            <span className="font-medium tabular-nums">{rangoHoras(b.hora_inicio, b.hora_fin)}</span>
                            {b.tipo === 'clase' ? <Badge>Clase</Badge> : <EstatusSolicitud estatus={b.estatus} />}
                            <span className="min-w-0 break-words text-muted-foreground">
                                {rotuloBloque(b)}
                                {b.propia ? (b.tipo === 'clase' ? ' (tu clase)' : ' (tuya)') : ''}
                            </span>
                            {tono && (
                                <span className={clsx('inline-flex w-full items-center gap-1 text-xs font-medium', tono.texto)}>
                                    <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.75} />
                                    {textoTraslape(nivel)}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        );
    }

    return (
        <section aria-labelledby={titulo} className={clsx('rounded-xl border border-border bg-muted/40 p-3', className)}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <h3 id={titulo} className="text-[13px] font-semibold">
                    Disponibilidad ese día
                </h3>
                {consultable && aula && (
                    <p className="text-xs text-muted-foreground">
                        {aula.clave} · {rotuloEdificio(aula.edificio)} · {formatoFechaCorta(fecha)}
                        {!consulta?.loading && !consulta?.error ? ` · ${resumenOcupacion(bloques)}` : ''}
                    </p>
                )}
            </div>
            {cuerpo}
        </section>
    );
}
