'use client';

import PageHeader from '@/components/layout/PageHeader';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Tabs from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import CasoPendiente from '../CasoPendiente';
import CorreccionesRecientes from '../CorreccionesRecientes';
import JustificanteCard from '../JustificanteCard';
import { mensajeResolucion } from '../ResolverComo/resolverComo.utils.js';
import ListaCasos from './ListaCasos.jsx';
import { VACIOS, idDeCaso } from './colaRevision.utils.js';
import { useColaRevision } from './useColaRevision.js';

// P-05 Cola de revisión del docente: pendientes, justificantes y correcciones recientes.
// En pantallas angostas lista y detalle se alternan; desde md van en dos columnas.
export default function ColaRevision({ pestanaInicial, casoInicial = null }) {
    const { toast } = useToast();
    const c = useColaRevision({ pestanaInicial, casoInicial });
    const { data, pestana, lista, total, seleccionado } = c;
    const cont = data?.contadores ?? {};

    const tabs = [
        { id: 'pendientes', label: 'Pendientes', count: cont.pendientes ?? 0 },
        { id: 'justificantes', label: 'Justificantes', count: cont.justificantes ?? 0 },
        { id: 'correcciones', label: 'Correcciones', count: cont.correcciones_recientes ?? 0 },
    ];

    const alResolverPendiente = async (resultado, estado) => {
        toast({ tone: 'success', message: mensajeResolucion(resultado, estado) });
        await c.recargar(resultado.id_asistencia);
    };
    const alResolverJustificante = async (resultado, aprobar) => {
        toast({ tone: 'success', message: aprobar ? 'Justificante aprobado' : 'Justificante rechazado' });
        await c.recargar(resultado.id_justificante);
    };

    const historial = (idAsistencia) => (data?.correcciones_recientes ?? []).filter((h) => h.id_asistencia === idAsistencia);

    return (
        <div>
            <PageHeader title="Revisión" subtitle="Casos por decidir de tus grupos" />
            <Tabs tabs={tabs} value={pestana} onChange={c.cambiarPestana} idPrefix="rev" className="mb-4" />
            <div role="tabpanel" id={`rev-panel-${pestana}`} aria-labelledby={`rev-${pestana}`}>
                <DataState
                    loading={c.cola.loading}
                    error={c.cola.error}
                    data={data}
                    onRetry={c.cola.refetch}
                    isEmpty={() => false}
                    loadingFallback={<p role="status" className="py-10 text-center text-sm text-muted-foreground">Cargando casos…</p>}
                >
                    {() =>
                        lista.length === 0 ? (
                            <EmptyState title={VACIOS[pestana]} />
                        ) : pestana === 'correcciones' ? (
                            <CorreccionesRecientes items={lista} />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
                                <div className={seleccionado ? 'hidden md:block' : ''}>
                                    <ListaCasos
                                        tipo={pestana === 'pendientes' ? 'pendiente' : 'justificante'}
                                        items={lista}
                                        total={total}
                                        seleccionadoId={seleccionado ? idDeCaso(pestana, seleccionado) : null}
                                        onSeleccionar={(it) => c.seleccionar(idDeCaso(pestana, it))}
                                        onCargarMas={c.cargarMas}
                                        cargandoMas={c.cargandoMas}
                                    />
                                </div>
                                <div className={seleccionado ? '' : 'hidden md:block'}>
                                    {!seleccionado ? (
                                        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                                            Elige un caso de la lista para ver sus lecturas.
                                        </p>
                                    ) : pestana === 'pendientes' ? (
                                        <CasoPendiente
                                            key={seleccionado.id_asistencia}
                                            caso={seleccionado}
                                            minimoValidas={data?.min_detecciones_validas}
                                            historial={historial(seleccionado.id_asistencia)}
                                            onResuelto={alResolverPendiente}
                                            onRecargar={() => c.recargar(seleccionado.id_asistencia)}
                                            onCerrar={() => c.seleccionar(null)}
                                        />
                                    ) : (
                                        <JustificanteCard
                                            key={seleccionado.id_justificante}
                                            justificante={seleccionado}
                                            minimoValidas={data?.min_detecciones_validas}
                                            onResuelto={alResolverJustificante}
                                            onRecargar={() => c.recargar(seleccionado.id_justificante)}
                                            onCerrar={() => c.seleccionar(null)}
                                        />
                                    )}
                                </div>
                            </div>
                        )
                    }
                </DataState>
            </div>
        </div>
    );
}
