'use client';

import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import AgendaLaboratorio from '../AgendaLaboratorio';
import ColaSolicitudes from '../ColaSolicitudes';
import HistorialSolicitudes from '../HistorialSolicitudes';
import { pestanasLaboratorios } from './solicitudesLaboratorio.utils.js';
import { useSolicitudesLaboratorio } from './useSolicitudesLaboratorio.js';

// Pantalla del administrador para los laboratorios: autorizar o rechazar lo que piden los docentes (Pendientes), ver qué ocupa cada
// laboratorio por semana (Agenda) y consultar lo ya resuelto (Historial). Solo se monta la pestaña activa; la bandeja de pendientes vive
// en el hook para que su contador se vea desde cualquier pestaña.
//   pestanaInicial   'pendientes' | 'agenda' | 'historial' (enlace ?pestana=...).
export default function SolicitudesLaboratorio({ pestanaInicial }) {
    const s = useSolicitudesLaboratorio({ pestanaInicial });
    const p = s.pendientes;

    return (
        <div>
            <PageHeader title="Solicitudes de laboratorio" subtitle="Autoriza o rechaza el uso de laboratorios que piden los docentes para sus grupos." />
            <Tabs tabs={pestanasLaboratorios(s.contadorPendientes)} value={s.pestana} onChange={s.cambiarPestana} idPrefix="lab" className="mb-4" />
            <div role="tabpanel" id={`lab-panel-${s.pestana}`} aria-labelledby={`lab-${s.pestana}`}>
                {s.pestana === 'pendientes' && (
                    <ColaSolicitudes
                        consulta={p.consulta}
                        lista={p.lista}
                        total={p.total}
                        hoy={s.hoy}
                        cargandoMas={p.cargandoMas}
                        onCargarMas={p.cargarMas}
                        onRecargar={p.recargar}
                    />
                )}
                {s.pestana === 'agenda' && <AgendaLaboratorio laboratorios={s.laboratorios} hoy={s.hoy} />}
                {s.pestana === 'historial' && <HistorialSolicitudes laboratorios={s.laboratorios} hoy={s.hoy} ahora={s.ahora} onCambio={p.recargar} />}
            </div>
        </div>
    );
}
