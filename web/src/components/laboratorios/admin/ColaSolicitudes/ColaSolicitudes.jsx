'use client';

import { CheckCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import { conteoTexto } from '../laboratoriosAdmin.utils.js';
import SolicitudPendiente from '../SolicitudPendiente';

// Bandeja de solicitudes pendientes, en el orden del servidor (primero la fecha de uso más próxima: es la que vence antes).
//   consulta     resultado de useApiQuery de la primera página (carga, error, reintento).
//   lista/total  las solicitudes cargadas (primera página + «Ver más») y cuántas hay en total.
//   hoy          'AAAA-MM-DD' del plantel.
//   onRecargar   se aprobó o rechazó una solicitud, o el servidor avisó que cambió: recarga la bandeja y los contadores.
export default function ColaSolicitudes({ consulta, lista, total, hoy, cargandoMas, onCargarMas, onRecargar }) {
    return (
        <DataState
            loading={consulta.loading}
            error={consulta.error}
            data={consulta.data}
            onRetry={consulta.refetch}
            isEmpty={() => lista.length === 0}
            loadingFallback={
                <p role="status" className="py-10 text-center text-sm text-muted-foreground">
                    Cargando solicitudes…
                </p>
            }
            empty={
                <EmptyState
                    icon={<CheckCheck aria-hidden="true" className="size-6" strokeWidth={1.5} />}
                    title="Todo al día"
                    description="No hay solicitudes pendientes. Cuando un docente pida un laboratorio, aparecerá aquí para que lo autorices."
                />
            }
        >
            {() => (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                        {conteoTexto(total, 'solicitud pendiente', 'solicitudes pendientes')}. Primero las de fecha más próxima.
                    </p>
                    <ul className="flex flex-col gap-3">
                        {lista.map((solicitud) => (
                            <li key={solicitud.id_solicitud}>
                                <SolicitudPendiente solicitud={solicitud} hoy={hoy} onResuelta={onRecargar} onRecargar={onRecargar} />
                            </li>
                        ))}
                    </ul>
                    {lista.length < total && (
                        <Button variant="secondary" className="self-center" loading={cargandoMas} onClick={onCargarMas}>
                            Ver más ({total - lista.length} restantes)
                        </Button>
                    )}
                </div>
            )}
        </DataState>
    );
}
