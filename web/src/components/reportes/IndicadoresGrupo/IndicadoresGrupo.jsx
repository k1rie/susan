import { CalendarCheck, TrendingUp, TriangleAlert, UserX } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { apoyoEnLimite, apoyoSinDerecho, cifraPorcentaje } from '../reporte.utils.js';

// Cuatro indicadores del grupo (Tabla 43): sesiones cerradas, asistencia promedio, en el límite, sin derecho.
// Dos columnas desde 360 px: con icono, etiqueta de hasta dos líneas y cifra con unidad caben en ~126 px de ancho útil.
export default function IndicadoresGrupo({ kpis }) {
    const k = kpis || {};
    const enLimite = Number(k.alumnos_en_limite ?? 0);
    const sinDerecho = Number(k.alumnos_sin_derecho ?? 0);
    const asistencia = cifraPorcentaje(k.asistencia_promedio);
    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {/* Las programadas van como unidad ("/ 45") para que la cifra grande sea solo las cerradas. */}
            <StatCard
                animated
                icon={CalendarCheck}
                label="Sesiones cerradas"
                value={Number(k.sesiones_cerradas ?? 0)}
                unit={`/ ${Number(k.sesiones_programadas ?? 0)}`}
                hint="de las programadas"
            />
            {/* El promedio sale de las sesiones cerradas (api_reporte_grupo): así lo dice el apoyo. Texto, no animado: lleva decimales fijos. */}
            <StatCard
                icon={TrendingUp}
                label="Asistencia promedio"
                {...asistencia}
                hint={asistencia.unit ? 'en sesiones cerradas' : undefined}
            />
            <StatCard animated icon={TriangleAlert} label="Alumnos en el límite" value={enLimite} tone={enLimite ? 'warning' : 'neutral'} hint={apoyoEnLimite(enLimite)} />
            <StatCard animated icon={UserX} label="Sin derecho a examen" value={sinDerecho} tone={sinDerecho ? 'danger' : 'neutral'} hint={apoyoSinDerecho(sinDerecho)} />
        </div>
    );
}
