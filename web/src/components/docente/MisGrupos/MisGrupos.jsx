import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';

// Grupos del periodo mas reciente del docente, con inscritos.
export default function MisGrupos({ grupos = [] }) {
    return (
        <Card title="Mis grupos">
            {grupos.length === 0 ? (
                <EmptyState title="Sin grupos" description="No tienes grupos asignados en el periodo actual." />
            ) : (
                <ul className="flex flex-col gap-2">
                    {grupos.map((g) => (
                        <li key={g.id_grupo} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                            <span>
                                <span className="font-medium">{g.materia}</span> ({g.clave_grupo}) · Aula {g.aula} · {g.periodo}
                            </span>
                            <span className="text-muted">{g.inscritos} inscritos</span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
