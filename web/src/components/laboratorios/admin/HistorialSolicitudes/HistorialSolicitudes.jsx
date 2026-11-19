'use client';

import { History } from 'lucide-react';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import Pagination from '@/components/ui/Pagination';
import Pills from '@/components/ui/Pills';
import Select from '@/components/ui/Select';
import { formatoFechaCorta, rangoHoras } from '../../laboratorios.utils.js';
import DialogoMotivo from '../DialogoMotivo';
import { etiquetaLaboratorio } from '../laboratoriosAdmin.utils.js';
import FilaHistorial from './FilaHistorial.jsx';
import { textoVacioHistorial } from './historialSolicitudes.utils.js';
import { useHistorialSolicitudes } from './useHistorialSolicitudes.js';

// Historial de solicitudes resueltas (aprobadas, rechazadas y canceladas) con filtro por estatus y por laboratorio, paginado.
//   laboratorios   resultado de useApiQuery(laboratoriosListar): llena el filtro de laboratorio (si falla, el filtro no se ofrece).
//   hoy / ahora    fecha del plantel y { fecha, hora }: deciden qué aprobadas todavía se pueden cancelar.
//   onCambio       se canceló una aprobada: la bandeja de pendientes debe recargar.
export default function HistorialSolicitudes({ laboratorios, hoy = null, ahora = null, onCambio }) {
    const h = useHistorialSolicitudes({ onCambio });
    const labs = laboratorios?.data?.items ?? [];
    const solicitud = h.aCancelar;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <Pills items={h.pastillas} value={h.estatus} onChange={h.cambiarEstatus} label="Filtrar por estatus" />
                {labs.length > 0 && (
                    <Field label="Laboratorio" className="sm:w-64">
                        <Select
                            value={h.idAula}
                            onChange={(e) => h.cambiarLaboratorio(e.target.value)}
                            options={[
                                { value: '', label: 'Todos los laboratorios' },
                                ...labs.map((lab) => ({ value: String(lab.id_aula), label: etiquetaLaboratorio(lab) })),
                            ]}
                        />
                    </Field>
                )}
            </div>

            <DataState
                loading={h.consulta.loading}
                error={h.consulta.error}
                data={h.consulta.data}
                onRetry={h.consulta.refetch}
                isEmpty={(d) => !d.items?.length}
                loadingFallback={
                    <p role="status" className="py-10 text-center text-sm text-muted-foreground">
                        Cargando historial…
                    </p>
                }
                empty={<EmptyState icon={<History aria-hidden="true" className="size-6" strokeWidth={1.5} />} title={textoVacioHistorial(h.estatus, Boolean(h.idAula))} />}
            >
                {(d) => (
                    <div className="flex flex-col gap-3">
                        <ul className="flex flex-col gap-3">
                            {d.items.map((item) => (
                                <li key={item.id_solicitud}>
                                    <FilaHistorial solicitud={item} hoy={hoy} ahora={ahora} onCancelar={h.pedirCancelar} />
                                </li>
                            ))}
                        </ul>
                        <Pagination
                            total={d.total}
                            limit={h.pagina.limit}
                            offset={h.pagina.offset}
                            onChange={h.cambiarPagina}
                            onLimitChange={h.cambiarTamano}
                        />
                    </div>
                )}
            </DataState>

            {solicitud && (
                <DialogoMotivo
                    titulo="Cancelar solicitud aprobada"
                    mensaje={`Se liberará ${etiquetaLaboratorio(solicitud.aula)}, ${formatoFechaCorta(solicitud.fecha, hoy)} de ${rangoHoras(solicitud.hora_inicio, solicitud.hora_fin)}, que tenía aprobado el grupo ${solicitud.grupo?.clave_grupo}.`}
                    etiqueta="Motivo de la cancelación"
                    ayuda="Obligatorio. Queda registrado en la solicitud."
                    obligatorio
                    variante="danger"
                    etiquetaConfirmar="Cancelar solicitud"
                    etiquetaVolver="Volver"
                    onConfirm={h.cancelar}
                    onClose={h.cerrarCancelar}
                />
            )}
        </div>
    );
}
