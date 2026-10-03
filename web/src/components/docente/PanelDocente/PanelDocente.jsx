'use client';

import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import PageHeader from '@/components/layout/PageHeader';
import { useApiQuery } from '@/hooks/data';
import { ahora } from '@/lib/api/plataforma.js';
import { docentePanel } from '@/lib/api/sesiones.js';
import AlertasAsistencia from '../AlertasAsistencia';
import IndicadoresPendientes from '../IndicadoresPendientes';
import MisGrupos from '../MisGrupos';
import SesionesHoy from '../SesionesHoy';

// P-02: panel del docente.
export default function PanelDocente() {
    const panel = useApiQuery(docentePanel, {});
    const reloj = useApiQuery(ahora, {});
    const simulado = reloj.data?.reloj_simulado ? reloj.data : null;

    return (
        <div>
            <PageHeader
                title="Panel del docente"
                subtitle={panel.data?.fecha ? `Hoy: ${panel.data.fecha}` : undefined}
                actions={
                    <>
                        <Button variant="secondary" href="/reportes">
                            Reportes
                        </Button>
                        <Button variant="secondary" href="/analitica">
                            Analítica
                        </Button>
                    </>
                }
            />
            {simulado && (
                <p className="mb-3 text-xs text-muted-foreground" role="note">
                    Reloj simulado: {simulado.fecha} {simulado.hora}
                </p>
            )}
            <DataState loading={panel.loading} error={panel.error} data={panel.data} onRetry={panel.refetch} isEmpty={() => false}>
                {(d) => (
                    <div className="flex flex-col gap-4">
                        <IndicadoresPendientes pendientes={d.pendientes} justificantes={d.justificantes_por_resolver} />
                        <SesionesHoy sesiones={d.sesiones_hoy} />
                        <div className="grid gap-4 lg:grid-cols-2">
                            <AlertasAsistencia alertas={d.alertas} />
                            <MisGrupos grupos={d.grupos} />
                        </div>
                    </div>
                )}
            </DataState>
        </div>
    );
}
