'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import DataState from '@/components/ui/DataState';
import StatusChip from '@/components/ui/StatusChip';
import { useApiQuery } from '@/hooks/data';
import { misJustificantes } from '@/lib/api/revision.js';
import { claveGrupo, fechaCorta, nombreMateria } from '../alumno.utils.js';

// Cuántos justificantes se ven sin pulsar "Ver todos"; al imprimir se muestran todos.
export const VISIBLES = 4;

// Mis justificantes con su estatus, en su propia tarjeta; se recarga cuando cambia refreshKey.
export default function MisJustificantes({ refreshKey = 0 }) {
    const q = useApiQuery(misJustificantes, { limit: 50 });
    const primera = useRef(true);
    const [todos, setTodos] = useState(false);
    const { refetch } = q;
    useEffect(() => {
        if (primera.current) { primera.current = false; return; }
        refetch();
    }, [refreshKey, refetch]);

    return (
        <section aria-labelledby="t-mis-just" className="rounded-xl border border-border bg-card p-5">
            <h3 id="t-mis-just" className="text-base font-semibold tracking-tight">Mis justificantes</h3>
            <div className="mt-3">
                <DataState loading={q.loading} error={q.error} data={q.data} onRetry={q.refetch}
                    isEmpty={(d) => !(d.items || []).length}
                    empty={<p className="text-sm text-muted-foreground">Aún no has enviado justificantes.</p>}>
                    {(d) => {
                        const recortar = d.items.length > VISIBLES;
                        return (
                            <>
                                {/* El borde va en el borde superior de cada fila salvo la primera: con `divide-y`, la última fila visible
                                    dejaba una línea colgando cuando el resto estaba oculto (no es :last-child). */}
                                <ul>
                                    {d.items.map((j, i) => (
                                        <li key={j.id_justificante}
                                            className={clsx('flex flex-wrap items-start justify-between gap-2 border-t border-border py-3 first:border-t-0 first:pt-0', i >= VISIBLES && !todos && 'hidden print:flex')}>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium">{nombreMateria(j.materia)} · {claveGrupo(j.grupo)}</p>
                                                <p className="text-xs text-muted-foreground">Sesión {fechaCorta(j.fecha)} · enviado {fechaCorta(j.fecha_registro)}</p>
                                                {/* Con pocos justificantes el motivo se lee completo; el recorte solo aparece en listas largas y se
                                                    quita con "Ver todos" y al imprimir, para que el alumno pueda releer lo que escribió. */}
                                                <p title={j.motivo} className={clsx('mt-1 break-words text-sm', recortar && !todos && 'line-clamp-2 print:line-clamp-none')}>{j.motivo}</p>
                                            </div>
                                            <StatusChip kind="justificante" value={j.estatus} size="sm" />
                                        </li>
                                    ))}
                                </ul>
                                {recortar && (
                                    <button type="button" onClick={() => setTodos((v) => !v)} aria-expanded={todos}
                                        className="mt-2 min-h-10 rounded-md text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 print:hidden">
                                        {todos ? 'Ver menos' : `Ver todos (${d.items.length})`}
                                    </button>
                                )}
                            </>
                        );
                    }}
                </DataState>
            </div>
        </section>
    );
}
