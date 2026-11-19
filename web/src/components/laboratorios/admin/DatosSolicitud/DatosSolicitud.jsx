import clsx from 'clsx';
import { CalendarDays, Clock } from 'lucide-react';
import EstatusSolicitud from '../../EstatusSolicitud';
import { duracionTexto, formatoFechaCorta, rangoHoras } from '../../laboratorios.utils.js';
import { ocupacion } from '../laboratoriosAdmin.utils.js';

function Dato({ etiqueta, className, children }) {
    return (
        <div className={clsx('min-w-0', className)}>
            <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
            <dd className="mt-0.5 break-words text-sm">{children}</dd>
        </div>
    );
}

// Los datos de una solicitud de laboratorio tal como los lee el administrador: laboratorio y estatus arriba, fecha y horario con su
// duración, y debajo grupo, docente, ocupación y actividad. Lo comparten la bandeja de pendientes y el historial; quien lo usa pone el
// contenedor (tarjeta) y las acciones.
//   solicitud   un item de api_laboratorio_solicitudes_listar.
//   hoy         'AAAA-MM-DD' del plantel; solo decide si la fecha lleva el año (cuando no es el actual).
export default function DatosSolicitud({ solicitud, hoy = null }) {
    const { aula, grupo, docente } = solicitud;
    const cupo = ocupacion(grupo, aula);
    const duracion = duracionTexto(solicitud.hora_inicio, solicitud.hora_fin);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <h2 className="min-w-0 text-base font-semibold leading-snug">
                    {aula?.clave}
                    {aula?.edificio && <span className="ml-2 text-sm font-normal text-muted-foreground">Edificio {aula.edificio}</span>}
                </h2>
                <EstatusSolicitud solicitud={solicitud} />
            </div>

            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
                <span className="inline-flex items-center gap-1.5">
                    <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    {formatoFechaCorta(solicitud.fecha, hoy)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <Clock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span className="tabular-nums">{rangoHoras(solicitud.hora_inicio, solicitud.hora_fin)}</span>
                    {duracion && <span className="font-normal text-muted-foreground">({duracion})</span>}
                </span>
            </p>

            <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                <Dato etiqueta="Grupo y materia">
                    {grupo?.clave_grupo} · {grupo?.materia_nombre}
                    {grupo?.materia_clave && <span className="ml-1.5 text-muted-foreground">{grupo.materia_clave}</span>}
                </Dato>
                <Dato etiqueta="Docente">{docente?.nombre_completo ?? '—'}</Dato>
                <Dato etiqueta="Ocupación">
                    {cupo.texto}
                    {cupo.excede && <span className="ml-1.5 font-medium text-destructive">(excede la capacidad)</span>}
                </Dato>
                <Dato etiqueta="Actividad" className="sm:col-span-2">
                    {solicitud.actividad || '—'}
                </Dato>
            </dl>
        </div>
    );
}
