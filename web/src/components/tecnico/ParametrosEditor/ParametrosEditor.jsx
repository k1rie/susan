'use client';

import { parametrosListar, parametroActualizar } from '@/lib/api/biometria.js';
import { useApiQuery } from '@/hooks/data';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import ParametroFila from '../ParametroFila';
import { resumenLista } from '../ParametroFila/parametros.utils.js';

const ARGS = { limit: 50 };

export default function ParametrosEditor({ soloLectura = false }) {
    const q = useApiQuery(parametrosListar, ARGS);
    const { toast } = useToast();

    // Lanza el error para que la fila lo muestre bajo su campo.
    const guardar = async (clave, valor) => {
        try {
            const r = await parametroActualizar({ clave, valor });
            toast({ tone: 'success', title: 'Parámetro actualizado' });
            q.refetch();
            return r;
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo guardar', message: e.message });
            throw e;
        }
    };

    return (
        <DataState
            loading={q.loading}
            error={q.error}
            data={q.data}
            onRetry={q.refetch}
            isEmpty={(d) => !d.items?.length}
            empty={<EmptyState title="No hay parámetros." />}
        >
            {(d) => (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                        {resumenLista(d.items)}. Cada cambio pide confirmación.
                    </p>
                    <ul className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                        {d.items.map((p) => (
                            // La clave incluye el valor para que la fila se reinicie tras un guardado exitoso.
                            <ParametroFila key={`${p.clave}:${p.valor}`} parametro={p} soloLectura={soloLectura} onGuardar={guardar} />
                        ))}
                    </ul>
                </div>
            )}
        </DataState>
    );
}
