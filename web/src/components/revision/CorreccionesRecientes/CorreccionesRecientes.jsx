import StatusChip from '@/components/ui/StatusChip';
import { formatearFechaHora } from '../PlazoRestante/plazoRestante.utils.js';

// Correcciones de los últimos 30 días (solo lectura): valor anterior, nuevo, quién y cuándo.
export default function CorreccionesRecientes({ items = [] }) {
    return (
        <ul className="flex flex-col gap-2">
            {items.map((c) => (
                <li key={c.id_bitacora} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3.5 text-sm">
                    <p className="font-medium">{c.alumno.nombre_completo}</p>
                    <p className="text-muted-foreground">
                        {c.materia.nombre} · Grupo {c.grupo.clave_grupo} · Sesión del {c.sesion.fecha}
                    </p>
                    <p className="flex flex-wrap items-center gap-2">
                        <StatusChip kind="asistencia" value={c.estado_anterior} size="sm" />
                        <span aria-label="cambió a">a</span>
                        <StatusChip kind="asistencia" value={c.estado_nuevo} size="sm" />
                    </p>
                    <p className="text-muted-foreground">
                        {c.automatica ? 'Automática (plazo vencido)' : c.usuario?.rol === 'docente' ? 'Docente' : c.usuario?.rol} ·{' '}
                        {formatearFechaHora(c.fecha_hora)}
                    </p>
                    {c.comentario && <p>Comentario: {c.comentario}</p>}
                </li>
            ))}
        </ul>
    );
}
