import StatCard from '@/components/ui/StatCard';
import { porcentaje } from '../reporte.utils.js';

// Cuatro indicadores del grupo (Tabla 43): sesiones cerradas, asistencia promedio, en el límite, sin derecho.
export default function IndicadoresGrupo({ kpis }) {
    const k = kpis || {};
    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Sesiones cerradas" value={`${k.sesiones_cerradas ?? 0} / ${k.sesiones_programadas ?? 0}`} hint="de las programadas" />
            <StatCard label="Asistencia promedio" value={k.asistencia_promedio == null ? '—' : porcentaje(k.asistencia_promedio)} />
            <StatCard label="Alumnos en el límite" value={k.alumnos_en_limite ?? 0} tone={k.alumnos_en_limite ? 'warning' : 'neutral'} />
            <StatCard label="Sin derecho a examen" value={k.alumnos_sin_derecho ?? 0} tone={k.alumnos_sin_derecho ? 'danger' : 'neutral'} />
        </div>
    );
}
