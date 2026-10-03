import { Users } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import TarjetaFila from '@/components/ui/TarjetaFila';

// Grupos del periodo más reciente del docente, con inscritos. Una tarjeta de fila por grupo.
export default function MisGrupos({ grupos = [] }) {
    return (
        <section aria-labelledby="t-grupos">
            <h2 id="t-grupos" className="mb-4 text-xl font-semibold tracking-tight">Mis grupos</h2>
            {grupos.length === 0 ? (
                <EmptyState title="Sin grupos" description="No tienes grupos asignados en el periodo actual." />
            ) : (
                <ul className="flex flex-col gap-3">
                    {grupos.map((g) => (
                        <li key={g.id_grupo}>
                            <TarjetaFila
                                icono={Users}
                                tono="azul"
                                titulo={`${g.materia} (${g.clave_grupo})`}
                                subtitulo={`Aula ${g.aula} · ${g.periodo} · ${g.inscritos} inscritos`}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
