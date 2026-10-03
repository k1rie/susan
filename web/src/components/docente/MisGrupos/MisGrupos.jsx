import { Users } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Detalles from '@/components/ui/Detalles';
import EmptyState from '@/components/ui/EmptyState';
import TarjetaFila from '@/components/ui/TarjetaFila';
import { partirLista } from '../PanelDocente/panelDocente.utils.js';

const VISIBLES = 6;

const FilaGrupo = ({ g }) => (
    <TarjetaFila
        icono={Users}
        tono="azul"
        titulo={`${g.materia} (${g.clave_grupo})`}
        subtitulo={`Aula ${g.aula} · ${g.periodo}`}
        accion={<Badge>{g.inscritos} alumnos</Badge>}
    />
);

// Grupos del periodo más reciente del docente. Los 6 primeros a la vista; el resto, plegado.
export default function MisGrupos({ grupos = [] }) {
    const { visibles, resto } = partirLista(grupos, VISIBLES);
    return (
        <section aria-labelledby="t-grupos">
            <h2 id="t-grupos" className="mb-4 text-xl font-semibold tracking-tight">Mis grupos</h2>
            {grupos.length === 0 ? (
                <EmptyState title="Sin grupos" description="No tienes grupos asignados en el periodo actual." />
            ) : (
                <div className="flex flex-col gap-3">
                    <ul className="flex flex-col gap-3">
                        {visibles.map((g) => (
                            <li key={g.id_grupo}>
                                <FilaGrupo g={g} />
                            </li>
                        ))}
                    </ul>
                    {resto.length > 0 && (
                        <Detalles titulo={`Ver los ${resto.length} restantes`}>
                            <ul className="flex flex-col gap-3">
                                {resto.map((g) => (
                                    <li key={g.id_grupo}>
                                        <FilaGrupo g={g} />
                                    </li>
                                ))}
                            </ul>
                        </Detalles>
                    )}
                </div>
            )}
        </section>
    );
}
