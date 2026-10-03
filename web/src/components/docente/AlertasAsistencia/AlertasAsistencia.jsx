import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';

const sinDerecho = (a) => a.tipo === 'sin_derecho_examen' || a.tipo === 'sin_derecho';

// Alertas RN-11: alumnos sin derecho a examen o a una falta del limite.
export default function AlertasAsistencia({ alertas = [] }) {
    return (
        <Card title="Alertas de asistencia">
            {alertas.length === 0 ? (
                <EmptyState title="Sin alertas" description="Ningún alumno está en el límite de faltas." />
            ) : (
                <ul className="flex flex-col gap-2">
                    {alertas.map((a) => (
                        <li key={`${a.tipo}-${a.id_grupo}-${a.id_alumno}`} className="flex flex-col gap-1 rounded-2xl border border-border p-3.5 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-medium">
                                    {a.nombre} <span className="font-normal text-muted-foreground">({a.matricula})</span>
                                </span>
                                <Badge tone={sinDerecho(a) ? 'danger' : 'warning'}>{sinDerecho(a) ? 'Sin derecho a examen' : 'A una falta del límite'}</Badge>
                            </div>
                            <p className="text-muted-foreground">
                                {a.materia} ({a.clave_grupo}) · {a.porcentaje_faltas}% de faltas equivalentes (límite {a.limite_pct}%)
                            </p>
                            {a.mensaje && <p>{a.mensaje}</p>}
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
