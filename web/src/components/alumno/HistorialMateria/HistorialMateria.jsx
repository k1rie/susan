import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import StatusChip from '@/components/ui/StatusChip';
import { fechaCorta, horaCorta } from '../alumno.utils.js';

// Historial por sesión como lista (legible a 360 px): fecha, estado, hora, origen y justificante asociado.
export default function HistorialMateria({ items = [], total = 0, limit = 10, offset = 0, onPagina, onJustificar }) {
    if (!items.length) return <EmptyState title="Aún no hay sesiones registradas en esta materia." />;
    return (
        <div className="flex flex-col gap-3">
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {items.map((s) => (
                    <li key={s.id_sesion} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <div className="min-w-0">
                            <p className="font-medium">{fechaCorta(s.fecha)} · {horaCorta(s.hora_inicio)}</p>
                            <p className="text-xs text-muted">
                                {s.origen ? <>Origen: <StatusChip kind="origen" value={s.origen} size="sm" /></> : 'Sin origen'}
                                {s.hora_registro ? ` · registrado ${horaCorta(String(s.hora_registro).slice(11))}` : ''}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {s.estatus_sesion === 'suspendida' ? (
                                <StatusChip kind="sesion" value="suspendida" size="sm" />
                            ) : s.estado ? (
                                <StatusChip kind="asistencia" value={s.estado} size="sm" />
                            ) : (
                                <span className="text-sm text-muted">Sin registro</span>
                            )}
                            {s.justificante && (
                                <span className="text-xs text-muted">
                                    Justificante: <StatusChip kind="justificante" value={s.justificante.estatus} size="sm" />
                                </span>
                            )}
                            {s.puede_justificar && onJustificar && (
                                <button type="button" onClick={() => onJustificar(s)}
                                    className="min-h-11 rounded-md border border-border px-3 text-sm font-medium text-primary hover:bg-surface-muted">
                                    Justificar
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            <Pagination total={total} limit={limit} offset={offset} onChange={({ offset: o }) => onPagina?.(o)} />
        </div>
    );
}
