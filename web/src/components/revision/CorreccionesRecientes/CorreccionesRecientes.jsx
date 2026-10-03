import { ArrowRight } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import GraficaDona from '@/components/ui/GraficaDona';
import StatusChip from '@/components/ui/StatusChip';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_ASISTENCIA, resumenTexto } from '@/lib/graficas.js';
import { fechaCorta } from '../ColaRevision/colaRevision.utils.js';
import { formatearFechaHora } from '../PlazoRestante/plazoRestante.utils.js';
import { autorCorreccion, conteoAutomaticas, distribucionCorrecciones } from './correccionesRecientes.utils.js';

// Correcciones de los últimos 30 días (solo lectura): a qué estado cambiaron (dona) y una fila compacta por cambio.
// `total` es el contador del servidor; si hay más que las cargadas, la gráfica lo avisa.
export default function CorreccionesRecientes({ items = [], total }) {
    const distribucion = distribucionCorrecciones(items);
    const { automaticas } = conteoAutomaticas(items);
    const parcial = Number.isFinite(total) && total > items.length;
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
            <TarjetaGrafica
                titulo="Estado final"
                descripcion="A qué estado cambiaron los registros"
                resumen={resumenTexto(distribucion, CONFIG_ASISTENCIA)}
                pie={`${automaticas} automática${automaticas === 1 ? '' : 's'} por plazo vencido${parcial ? ` · se muestran ${items.length} de ${total}` : ''}`}
            >
                <GraficaDona datos={distribucion} config={CONFIG_ASISTENCIA} centro={{ valor: items.length, etiqueta: 'cambios' }} alto={220} />
            </TarjetaGrafica>
            <ul className="flex flex-col gap-2">
                {items.map((c) => (
                    <li key={c.id_bitacora} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                        <Avatar nombre={c.alumno.nombre_completo} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                <p className="truncate font-medium">{c.alumno.nombre_completo}</p>
                                <span className="flex items-center gap-1.5">
                                    <StatusChip kind="asistencia" value={c.estado_anterior} size="sm" />
                                    <ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                                    <span className="sr-only">cambió a</span>
                                    <StatusChip kind="asistencia" value={c.estado_nuevo} size="sm" />
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {c.materia.nombre} · {c.grupo.clave_grupo} · sesión {fechaCorta(c.sesion.fecha)} · {autorCorreccion(c)} · {formatearFechaHora(c.fecha_hora)}
                            </p>
                            {c.comentario && <p className="mt-1 line-clamp-2 text-xs">“{c.comentario}”</p>}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
