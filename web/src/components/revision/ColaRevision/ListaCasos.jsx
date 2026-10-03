import clsx from 'clsx';
import Button from '@/components/ui/Button';
import StatusChip from '@/components/ui/StatusChip';
import PlazoRestante from '../PlazoRestante';
import { formatearFechaHora } from '../PlazoRestante/plazoRestante.utils.js';
import { idDeCaso } from './colaRevision.utils.js';

// Lista de casos de Pendientes / Justificantes. Cada fila es un botón (táctil >= 44 px).
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
                                    'flex min-h-11 w-full flex-col gap-1 rounded-full border p-3 text-left text-sm',
                                    activo ? 'border-primary bg-muted' : 'border-border bg-card hover:bg-muted',
                                )}
                            >
                                <span className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium">{it.alumno.nombre_completo}</span>
                                    <StatusChip
                                        kind="asistencia"
                                        value={tipo === 'pendiente' ? 'pendiente' : it.estado_asistencia}
                                        size="sm"
                                    />
                                </span>
                                <span className="text-muted-foreground">
                                    {it.materia.nombre} · Grupo {it.grupo.clave_grupo}
                                </span>
                                <span className="text-muted-foreground">
                                    Sesión {it.sesion.fecha} {String(it.sesion.hora_inicio).slice(0, 5)}
                                </span>
                                {tipo === 'pendiente' ? (
                                    <PlazoRestante key={it.segundos_restantes} venceEn={it.vence_en} segundosRestantes={it.segundos_restantes} />
                                ) : (
                                    <span className="text-muted-foreground">
                                        Justificante de {it.registrado_por_rol === 'docente' ? 'docente' : 'alumno'} · {formatearFechaHora(it.fecha_registro)}
                                    </span>
                                )}
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
