'use client';

import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import StatusChip from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/layout/PageHeader';
import { useApiMutation, useApiQuery } from '@/hooks/data';
import { abrirSesion, sesionMonitor } from '@/lib/api/sesiones.js';
import MonitorSesion from '../MonitorSesion';
import { formatearFecha, formatearHora } from '../MonitorSesion/monitorSesion.utils.js';
import PaseListaManual from '../PaseListaManual';
import ResumenSesion from '../ResumenSesion';

const INTERVALO_SONDEO_MS = 5000;

// Pantalla de una sesion: P-03 (automatica), P-04 (manual), resumen (cerrada), aviso (suspendida) o apertura (programada).
export default function SesionClase({ idSesion }) {
    const { toast } = useToast();
    const consulta = useApiQuery(sesionMonitor, { idSesion }, { refetchInterval: INTERVALO_SONDEO_MS });
    const abrir = useApiMutation(abrirSesion);

    const abrirAhora = async () => {
        try {
            await abrir.run({ idSesion });
            await consulta.refetch();
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo abrir la sesión', message: e.message });
        }
    };

    return (
        <DataState loading={consulta.loading} error={consulta.error} data={consulta.data} onRetry={consulta.refetch}>
            {(data) => {
                const { sesion } = data;
                const subtitulo = `${formatearFecha(sesion.fecha)} · ${formatearHora(sesion.hora_inicio)} a ${formatearHora(sesion.hora_fin)} · Aula ${sesion.aula}`;
                return (
                    <div>
                        <PageHeader
                            title={`${sesion.materia} (${sesion.clave_grupo})`}
                            subtitle={subtitulo}
                            backHref="/docente"
                            backLabel="Volver al panel"
                            actions={
                                <>
                                    <StatusChip kind="sesion" value={sesion.estatus} />
                                    <StatusChip kind="modo" value={sesion.modo_registro} />
                                </>
                            }
                        />
                        {consulta.error && (
                            <Alert tone="warning" className="mb-3">
                                No se pudo actualizar el monitor: {consulta.error.message}
                            </Alert>
                        )}
                        {sesion.estatus === 'programada' && (
                            <Alert tone="info" title="La sesión aún no se abre">
                                <p>Al abrirla se fija el modo según las cámaras activas del aula.</p>
                                <Button onClick={abrirAhora} loading={abrir.loading} className="mt-2">
                                    Abrir sesión
                                </Button>
                            </Alert>
                        )}
                        {sesion.estatus === 'suspendida' && (
                            <Alert tone="warning" title="Sesión suspendida">
                                No cuenta para el cálculo de faltas.
                            </Alert>
                        )}
                        {sesion.estatus === 'cerrada' && <ResumenSesion data={data} />}
                        {sesion.estatus === 'abierta' && sesion.modo_registro === 'automatico' && <MonitorSesion data={data} onActualizar={consulta.refetch} />}
                        {sesion.estatus === 'abierta' && sesion.modo_registro !== 'automatico' && <PaseListaManual key={sesion.id_sesion} data={data} onActualizar={consulta.refetch} />}
                    </div>
                );
            }}
        </DataState>
    );
}
