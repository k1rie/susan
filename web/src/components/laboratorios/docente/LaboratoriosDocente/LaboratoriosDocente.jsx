'use client';

import { FlaskConical, Plus } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Pills from '@/components/ui/Pills';
import SolicitudForm from '../SolicitudForm';
import TarjetaSolicitud from '../TarjetaSolicitud';
import { itemsDePills, textoCancelacion, textoResultado, VACIOS } from './laboratoriosDocente.utils.js';
import { useLaboratoriosDocente } from './useLaboratoriosDocente.js';

// «Laboratorios» del docente: pide un laboratorio para uno de sus grupos (fecha, horario y actividad) y sigue el estado de sus
// solicitudes. El administrador las aprueba o rechaza; mientras tanto quedan pendientes y se pueden cancelar.
export default function LaboratoriosDocente() {
    const c = useLaboratoriosDocente();
    const botonNueva = (
        <Button icon={<Plus aria-hidden="true" className="size-4" strokeWidth={1.75} />} onClick={c.abrirPanel}>
            Nueva solicitud
        </Button>
    );
    const vacio = VACIOS[c.filtro] ?? VACIOS.todas;

    return (
        <div>
            <PageHeader
                title="Laboratorios"
                subtitle="Solicita un laboratorio para uno de tus grupos y revisa si el administrador lo autorizó."
                actions={botonNueva}
            />

            <section aria-labelledby="t-mis-solicitudes" className="flex flex-col gap-4">
                <h2 id="t-mis-solicitudes" className="text-xl font-semibold tracking-tight">
                    Mis solicitudes
                </h2>
                {c.conteos?.total > 0 && (
                    <Pills items={itemsDePills(c.conteos)} value={c.filtro} onChange={c.cambiarFiltro} label="Filtrar solicitudes por estatus" />
                )}
                <DataState
                    loading={c.lista.loading}
                    error={c.lista.error}
                    data={c.lista.data}
                    onRetry={c.lista.refetch}
                    isEmpty={() => c.items.length === 0}
                    empty={
                        <EmptyState
                            icon={<FlaskConical aria-hidden="true" className="size-6" strokeWidth={1.5} />}
                            title={vacio.title}
                            description={vacio.description}
                            action={
                                c.filtro === 'todas' ? (
                                    botonNueva
                                ) : (
                                    <Button variant="secondary" onClick={() => c.cambiarFiltro('todas')}>
                                        Ver todas las solicitudes
                                    </Button>
                                )
                            }
                        />
                    }
                >
                    {() => (
                        <div className="flex flex-col gap-3" aria-busy={c.lista.refetching}>
                            <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                {c.items.map((s) => (
                                    <li key={s.id_solicitud}>
                                        <TarjetaSolicitud solicitud={s} reloj={c.reloj} onCancelar={c.pedirCancelar} />
                                    </li>
                                ))}
                            </ul>
                            <p aria-live="polite" className="text-center text-xs text-muted-foreground">
                                {textoResultado(c.items.length, c.total)}
                            </p>
                            {c.hayMas && (
                                <div className="flex justify-center">
                                    <Button variant="secondary" onClick={c.cargarMas} loading={c.cargandoMas}>
                                        Ver más
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DataState>
            </section>

            {c.panelAbierto && <SolicitudForm onClose={c.cerrarPanel} onCreada={c.alCrear} />}

            <ConfirmDialog
                open={Boolean(c.porCancelar)}
                title="Cancelar la solicitud"
                message={c.porCancelar ? textoCancelacion(c.porCancelar) : undefined}
                confirmLabel="Cancelar solicitud"
                cancelLabel="Conservarla"
                variant="danger"
                reason={{ label: 'Motivo (opcional)', maxLength: 300 }}
                onConfirm={c.confirmarCancelar}
                onCancel={c.cerrarCancelar}
            >
                {c.cancelacion.error && (
                    <div className="mt-3">
                        <Alert tone="danger" compact title="No se pudo cancelar">
                            {c.cancelacion.error.message}
                        </Alert>
                    </div>
                )}
            </ConfirmDialog>
        </div>
    );
}
