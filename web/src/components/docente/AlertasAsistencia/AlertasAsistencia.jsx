import { TriangleAlert } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import TarjetaFila from '@/components/ui/TarjetaFila';
import Badge from '@/components/ui/Badge';

const sinDerecho = (a) => a.tipo === 'sin_derecho_examen' || a.tipo === 'sin_derecho';

// Alertas RN-11: alumnos sin derecho a examen o a una falta del límite. Una tarjeta de fila por alumno.
export default function AlertasAsistencia({ alertas = [] }) {
    return (
        <section aria-labelledby="t-alertas">
            <h2 id="t-alertas" className="mb-4 text-xl font-semibold tracking-tight">Alertas de asistencia</h2>
            {alertas.length === 0 ? (
                <EmptyState title="Sin alertas" description="Ningún alumno está en el límite de faltas." />
            ) : (
                <ul className="flex flex-col gap-3">
                    {alertas.map((a) => (
                        <li key={`${a.tipo}-${a.id_grupo}-${a.id_alumno}`}>
                            <TarjetaFila
                                icono={TriangleAlert}
                                tono={sinDerecho(a) ? 'rosa' : 'dorado'}
                                titulo={`${a.nombre} (${a.matricula})`}
                                subtitulo={`${a.materia} (${a.clave_grupo}) · ${a.porcentaje_faltas}% de faltas equivalentes (límite ${a.limite_pct}%)`}
                                className="items-start"
                            >
                                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <Badge tone={sinDerecho(a) ? 'danger' : 'warning'}>{sinDerecho(a) ? 'Sin derecho a examen' : 'A una falta del límite'}</Badge>
                                </span>
                                {a.mensaje && <span className="mt-1.5 block text-[13px]">{a.mensaje}</span>}
                            </TarjetaFila>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
