import { CalendarDays, Clock, FlaskConical, Info, MessageSquareText, Users, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import EstatusSolicitud from '../../EstatusSolicitud';
import { formatoFechaCorta, rangoHoras } from '../../laboratorios.utils.js';
import { rotuloEdificio, rotuloGrupo, textoAlumnos } from '../compartido/rotulos.utils.js';
import { duracionSolicitud, notaDeEstado, puedeCancelar, resumenSolicitud, rotuloComentario } from './tarjetaSolicitud.utils.js';

// Una solicitud de laboratorio del docente: laboratorio, fecha y horario, grupo y materia, actividad, estatus y, si lo hay, el comentario
// del administrador (rechazo o cancelación). «Cancelar» solo aparece mientras tenga sentido (puedeCancelar).
//   solicitud   item de api_laboratorio_solicitudes_listar
//   reloj       { hoy, hora } del plantel (useRelojPlantel): decide si una aprobada ya inició
//   onCancelar  (solicitud) => void
export default function TarjetaSolicitud({ solicitud: s, reloj, onCancelar }) {
    const comentario = String(s.comentario ?? '').trim();
    const nota = notaDeEstado(s);
    const duracion = duracionSolicitud(s);
    const cancelable = puedeCancelar(s, reloj);

    return (
        <article aria-label={`Solicitud de ${resumenSolicitud(s, reloj?.hoy)}`} className="rounded-xl border border-border bg-card p-4">
            <header className="flex items-start gap-3">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-tono-verde text-tono-verde-fg">
                    <FlaskConical aria-hidden="true" className="size-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="break-words text-[14.5px] font-medium leading-tight">{s.aula?.clave}</h3>
                    <p className="mt-0.5 break-words text-[13px] text-muted-foreground">{rotuloEdificio(s.aula?.edificio)}</p>
                </div>
                <EstatusSolicitud solicitud={s} className="shrink-0" />
            </header>

            <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
                <li className="flex items-start gap-2">
                    <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span>{formatoFechaCorta(s.fecha, reloj?.hoy)}</span>
                </li>
                <li className="flex items-start gap-2">
                    <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span>
                        {rangoHoras(s.hora_inicio, s.hora_fin)}
                        {duracion && <span className="text-muted-foreground"> · {duracion}</span>}
                    </span>
                </li>
                <li className="flex items-start gap-2">
                    <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span className="min-w-0 break-words">
                        {rotuloGrupo(s.grupo)}
                        {s.grupo?.inscritos != null && <span className="text-muted-foreground"> · {textoAlumnos(s.grupo.inscritos)}</span>}
                    </span>
                </li>
            </ul>

            <p className="mt-3 whitespace-pre-line break-words text-sm">{s.actividad}</p>

            {comentario && (
                <div className="mt-3 rounded-lg bg-muted p-3 text-[13px]">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <MessageSquareText aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.75} />
                        {rotuloComentario(s.estatus)}
                    </p>
                    <p className="mt-1 whitespace-pre-line break-words">{comentario}</p>
                </div>
            )}

            {(nota || cancelable) && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {nota && (
                        <p className="flex min-w-0 flex-1 basis-40 items-start gap-1.5 text-xs text-muted-foreground">
                            <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" strokeWidth={1.75} />
                            {nota}
                        </p>
                    )}
                    {cancelable && (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="ml-auto"
                            icon={<X aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                            aria-label={`Cancelar la solicitud de ${resumenSolicitud(s, reloj?.hoy)}`}
                            onClick={() => onCancelar?.(s)}
                        >
                            Cancelar
                        </Button>
                    )}
                </div>
            )}
        </article>
    );
}
