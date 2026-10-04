'use client';

import AlertasAsistencia from '../AlertasAsistencia';
import GraficaAlertas from '../GraficaAlertas';
import IndicadoresPendientes from '../IndicadoresPendientes';
import MisGrupos from '../MisGrupos';
import PasarListaHero from '../PasarListaHero';
import SesionesHoy from '../SesionesHoy';

// Contenido del panel una vez que llegan los datos. Vive aparte para que PanelDocente lo cargue en diferido (ver PanelDocente).
// Orden: «Pasar lista» (la acción de todos los días) · pendientes · todas las sesiones de hoy · alertas y grupos.
export default function ContenidoPanel({ datos: d, hora }) {
    return (
        <div className="flex flex-col gap-4">
            <PasarListaHero sesiones={d.sesiones_hoy} hora={hora} />
            <IndicadoresPendientes pendientes={d.pendientes} justificantes={d.justificantes_por_resolver} />
            <SesionesHoy sesiones={d.sesiones_hoy} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                <AlertasAsistencia alertas={d.alertas} />
                <div className="flex flex-col gap-4">
                    <GraficaAlertas alertas={d.alertas} />
                    <MisGrupos grupos={d.grupos} />
                </div>
            </div>
        </div>
    );
}
