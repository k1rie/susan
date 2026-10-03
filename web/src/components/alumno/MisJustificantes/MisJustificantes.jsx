'use client';

import { useEffect, useRef } from 'react';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/ui/StatusChip';
import { useApiQuery } from '@/hooks/data';
import { misJustificantes } from '@/lib/api/revision.js';
import { claveGrupo, fechaCorta, nombreMateria } from '../alumno.utils.js';

// Lista de mis justificantes con su estatus; se recarga cuando cambia refreshKey.
export default function MisJustificantes({ refreshKey = 0 }) {
    const q = useApiQuery(misJustificantes, { limit: 50 });
    const primera = useRef(true);
    const { refetch } = q;
    useEffect(() => {
        if (primera.current) { primera.current = false; return; }
        refetch();
    }, [refreshKey, refetch]);

    return (
        <DataState loading={q.loading} error={q.error} data={q.data} onRetry={q.refetch}
            isEmpty={(d) => !(d.items || []).length}
            empty={<EmptyState title="Aún no has enviado justificantes." />}>
            {(d) => (
                <ul className="divide-y divide-border rounded-3xl border border-border bg-card shadow-soft">
                    {d.items.map((j) => (
                        <li key={j.id_justificante} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                            <div className="min-w-0">
                                <p className="font-medium">{nombreMateria(j.materia)} · {claveGrupo(j.grupo)}</p>
                                <p className="text-sm text-muted-foreground">Sesión del {fechaCorta(j.fecha)} · enviado el {fechaCorta(j.fecha_registro)}</p>
                                <p className="mt-1 break-words text-sm">{j.motivo}</p>
                            </div>
                            <StatusChip kind="justificante" value={j.estatus} />
                        </li>
                    ))}
                </ul>
            )}
        </DataState>
    );
}
