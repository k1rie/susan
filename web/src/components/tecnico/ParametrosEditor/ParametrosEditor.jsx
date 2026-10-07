'use client';

import { useCallback, useState } from 'react';
import { parametrosListar, parametroActualizar } from '@/lib/api/biometria.js';
import { useApiQuery } from '@/hooks/data';
import { useCambiosSinGuardar } from '@/hooks/ui/useCambiosSinGuardar.js';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import ParametroFila from '../ParametroFila';
import { agruparParametros, nombreParametro, resumenLista, textoSinGuardar } from '../ParametroFila/parametros.utils.js';

const ARGS = { limit: 50 };

export default function ParametrosEditor({ soloLectura = false }) {
    const q = useApiQuery(parametrosListar, ARGS);
    const { toast } = useToast();
    // Filas con cambios sin guardar (cada una avisa por `onSucio`): se cuentan en el encabezado y protegen la salida de la página.
    const [sucios, setSucios] = useState(() => new Set());
    useCambiosSinGuardar(sucios.size > 0);

    const marcar = useCallback((clave, sucio) => {
        setSucios((previo) => {
            if (previo.has(clave) === sucio) return previo;
            const siguiente = new Set(previo);
            if (sucio) siguiente.add(clave);
            else siguiente.delete(clave);
            return siguiente;
        });
    }, []);

    // Lanza el error para que la fila lo muestre bajo su campo.
    const guardar = async (clave, valor) => {
        try {
            const r = await parametroActualizar({ clave, valor });
            toast({ tone: 'success', title: 'Parámetro actualizado', message: nombreParametro(clave) });
            q.refetch();
            return r;
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo guardar', message: e.message });
            throw e;
        }
    };

    const sinGuardar = textoSinGuardar(sucios.size);

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
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm text-muted-foreground">
                            {resumenLista(d.items)}. Cada cambio pide confirmación.
                        </p>
                        {/* Región viva fija: el aviso aparece y desaparece sin mover el resto; cada fila se guarda por separado. */}
                        <p role="status" className="min-h-5 text-[13px] font-medium">
                            {sinGuardar && (
                                <span className="inline-flex items-center gap-1.5">
                                    <span aria-hidden="true" className="size-2 rounded-full bg-retardo" />
                                    {sinGuardar}: usa «Guardar» en cada uno.
                                </span>
                            )}
                        </p>
                    </div>
                    {agruparParametros(d.items).map((g) => (
                        <section key={g.id} aria-labelledby={`grupo-param-${g.id}`} className="flex flex-col gap-3">
                            <div>
                                <h2 id={`grupo-param-${g.id}`} className="text-[15px] font-semibold tracking-tight">
                                    {g.titulo}
                                </h2>
                                {g.descripcion && <p className="text-[13px] text-muted-foreground">{g.descripcion}</p>}
                            </div>
                            <ul className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                                {g.items.map((p) => (
                                    // La clave incluye el valor para que la fila se reinicie tras un guardado exitoso.
                                    <ParametroFila
                                        key={`${p.clave}:${p.valor}`}
                                        parametro={p}
                                        todos={d.items}
                                        soloLectura={soloLectura}
                                        onGuardar={guardar}
                                        onSucio={marcar}
                                    />
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </DataState>
    );
}
