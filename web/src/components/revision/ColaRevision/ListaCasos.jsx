import clsx from 'clsx';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import StatusChip from '@/components/ui/StatusChip';
import PlazoRestante from '../PlazoRestante';
import { idDeCaso, metaCaso } from './colaRevision.utils.js';

// Lista de casos de Pendientes / Justificantes. Cada fila es un botón (táctil >= 44 px) con avatar y tres líneas cortas:
// nombre + estado, meta (materia · grupo · sesión) y, debajo, el plazo restante (pendientes) o quién lo registró (justificantes).
export default function ListaCasos({ tipo, items, total, seleccionadoId, onSeleccionar, onCargarMas, cargandoMas }) {
    const pestana = tipo === 'pendiente' ? 'pendientes' : 'justificantes';
    return (
        <div className="flex flex-col gap-2">
            <ul className="flex flex-col gap-2">
                {items.map((it) => {
                    const id = idDeCaso(pestana, it);
                    const activo = id === seleccionadoId;
                    return (
                        <li key={id}>
                            <button
                                type="button"
                                aria-current={activo ? 'true' : undefined}
                                onClick={() => onSeleccionar(it)}
                                className={clsx(
                                    'flex min-h-11 w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors duration-150',
                                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
                                    activo ? 'border-foreground bg-accent/50' : 'border-border bg-card hover:border-input hover:bg-accent/30',
                                )}
                            >
                                <Avatar nombre={it.alumno.nombre_completo} size="md" />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="truncate font-medium">{it.alumno.nombre_completo}</span>
                                        <StatusChip kind="asistencia" value={tipo === 'pendiente' ? 'pendiente' : it.estado_asistencia} size="sm" />
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">{metaCaso(it)}</span>
                                    <span className="text-xs">
                                        {tipo === 'pendiente' ? (
                                            <PlazoRestante compacto key={it.segundos_restantes} venceEn={it.vence_en} segundosRestantes={it.segundos_restantes} />
                                        ) : (
                                            <span className="text-muted-foreground">De {it.registrado_por_rol === 'docente' ? 'docente' : 'alumno'}</span>
                                        )}
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            {items.length < total && onCargarMas && (
                <Button variant="secondary" loading={cargandoMas} onClick={onCargarMas}>
                    Ver más
                </Button>
            )}
        </div>
    );
}
