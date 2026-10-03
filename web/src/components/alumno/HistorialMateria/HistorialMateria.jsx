import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import StatusChip from '@/components/ui/StatusChip';
import { fechaCorta, horaCorta, lineaRegistro } from '../alumno.utils.js';

// Historial por sesión como lista (legible a 360 px): fecha, estado y, solo si hay, justificante y acción. Las sesiones llegan
// paginadas desde la base (las más recientes primero); "Anterior/Siguiente" recorre el resto.
export default function HistorialMateria({ items = [], total = 0, limit = 8, offset = 0, onPagina, onJustificar }) {
    if (!items.length) return <EmptyState title="Aún no hay sesiones registradas en esta materia." />;
    return (
        <div className="flex flex-col gap-3">
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {items.map((s) => {
                    const registro = lineaRegistro(s);
                    return (
                        <li key={s.id_sesion} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
                            <div className="min-w-0">
                                <p className="font-medium">{fechaCorta(s.fecha)} · {horaCorta(s.hora_inicio)}</p>
                                {registro && <p className="text-xs text-muted-foreground">{registro}</p>}
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                {s.estatus_sesion === 'suspendida' ? (
                                    <StatusChip kind="sesion" value="suspendida" size="sm" />
                                ) : s.estado ? (
                                    <StatusChip kind="asistencia" value={s.estado} size="sm" />
                                ) : (
                                    <span className="text-sm text-muted-foreground">Sin registro</span>
                                )}
                                {s.justificante && (
                                    <span className="text-xs text-muted-foreground">
                                        Justificante: <StatusChip kind="justificante" value={s.justificante.estatus} size="sm" />
                                    </span>
                                )}
                                {s.puede_justificar && onJustificar && (
                                    <button type="button" onClick={() => onJustificar(s)}
                                        className="min-h-11 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                                        Justificar
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
            <Pagination total={total} limit={limit} offset={offset} onChange={({ offset: o }) => onPagina?.(o)} />
        </div>
    );
}
