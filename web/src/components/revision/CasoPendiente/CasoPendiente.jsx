'use client';

import { Clock } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Detalles from '@/components/ui/Detalles';
import StatusChip from '@/components/ui/StatusChip';
import { useApiMutation } from '@/hooks/data';
import { corregirAsistencia } from '@/lib/api/revision.js';
import LecturasCaso from '../LecturasCaso';
import PlazoRestante from '../PlazoRestante';
import ResolverComo from '../ResolverComo';
import { formatearFechaHora } from '../PlazoRestante/plazoRestante.utils.js';

const CODIGOS_RECARGA = ['RN_08_PLAZO_VENCIDO', 'SIN_CAMBIO', 'TRANSICION_NO_PERMITIDA'];

// Detalle de un pendiente: datos del caso, plazo, lecturas con recortes y «Resolver como».
// Al resolver llama onResuelto(resultado, estado); ante concurrencia o plazo vencido pide recargar la cola.
export default function CasoPendiente({ caso, minimoValidas, historial = [], onResuelto, onRecargar, onCerrar }) {
    const { run, loading, error } = useApiMutation(corregirAsistencia);
    const vencido = caso.vencido || caso.segundos_restantes <= 0;

    const resolver = async (estado, comentario) => {
        try {
            const resultado = await run({ idAsistencia: caso.id_asistencia, estado, comentario });
            onResuelto?.(resultado, estado);
        } catch (e) {
            if (CODIGOS_RECARGA.includes(e?.code)) onRecargar?.();
        }
    };

    return (
        <article aria-label={`Caso de ${caso.alumno.nombre_completo}`} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <header className="flex flex-col gap-2">
                <Button variant="ghost" size="sm" className="self-start md:hidden" onClick={onCerrar}>
                    Volver a la lista
                </Button>
                {/* flex-wrap: a 360 px el chip baja a su propia línea en lugar de truncar el nombre. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Avatar nombre={caso.alumno.nombre_completo} />
                    <div className="min-w-0 flex-1 basis-44">
                        <h2 className="truncate text-lg font-semibold leading-tight">{caso.alumno.nombre_completo}</h2>
                        <p className="truncate text-sm text-muted-foreground">
                            {caso.alumno.matricula} · {caso.materia.nombre} · {caso.grupo.clave_grupo}
                        </p>
                    </div>
                    <StatusChip kind="asistencia" value="pendiente" />
                </div>
                <p className="text-sm text-muted-foreground">
                    Sesión del {caso.sesion.fecha}, {String(caso.sesion.hora_inicio).slice(0, 5)} a {String(caso.sesion.hora_fin).slice(0, 5)}
                </p>
                <p className="flex items-center gap-1.5 text-sm">
                    <Clock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <PlazoRestante key={caso.segundos_restantes} venceEn={caso.vence_en} segundosRestantes={caso.segundos_restantes} />
                </p>
            </header>

            <section aria-label="Lecturas del caso">
                <LecturasCaso idAsistencia={caso.id_asistencia} minimoValidas={minimoValidas} />
            </section>

            {historial.length > 0 && (
                <Detalles titulo="Bitácora del caso" resumen={`${historial.length} ${historial.length === 1 ? 'cambio' : 'cambios'}`}>
                    <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                        {historial.map((h) => (
                            <li key={h.id_bitacora}>
                                {h.estado_anterior} a {h.estado_nuevo} · {h.automatica ? 'Automática (plazo vencido)' : h.usuario?.rol} ·{' '}
                                {formatearFechaHora(h.fecha_hora)}
                            </li>
                        ))}
                    </ul>
                </Detalles>
            )}

            {error && <Alert tone="danger">{error.message}</Alert>}

            <ResolverComo
                estadoActual="pendiente"
                estadoSugerido={caso.estado_sugerido}
                cargando={loading}
                deshabilitado={vencido}
                motivoDeshabilitado="El plazo venció; el sistema lo resolverá como ausente."
                onResolver={resolver}
            />
        </article>
    );
}
