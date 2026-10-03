'use client';

import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
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
            <header className="flex flex-col gap-1">
                <Button variant="ghost" size="sm" className="self-start md:hidden" onClick={onCerrar}>
                    Volver a la lista
                </Button>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">{caso.alumno.nombre_completo}</h2>
                    <StatusChip kind="asistencia" value="pendiente" />
                </div>
                <p className="text-sm text-muted-foreground">Matrícula {caso.alumno.matricula}</p>
                <p className="text-sm">
                    {caso.materia.nombre} · Grupo {caso.grupo.clave_grupo}
                </p>
                <p className="text-sm text-muted-foreground">
                    Sesión del {caso.sesion.fecha}, {String(caso.sesion.hora_inicio).slice(0, 5)} a {String(caso.sesion.hora_fin).slice(0, 5)}
                </p>
                <p className="text-sm">
                    <PlazoRestante key={caso.segundos_restantes} venceEn={caso.vence_en} segundosRestantes={caso.segundos_restantes} />
                </p>
            </header>

            <section aria-label="Lecturas del caso">
                <LecturasCaso idAsistencia={caso.id_asistencia} minimoValidas={minimoValidas} />
            </section>

            {historial.length > 0 && (
                <section aria-label="Bitácora del caso">
                    <h3 className="mb-1 text-sm font-semibold">Bitácora</h3>
                    <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                        {historial.map((h) => (
                            <li key={h.id_bitacora}>
                                {h.estado_anterior} a {h.estado_nuevo} · {h.automatica ? 'Automática (plazo vencido)' : h.usuario?.rol} ·{' '}
                                {formatearFechaHora(h.fecha_hora)}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {error && <Alert tone="danger">{error.message}</Alert>}

            <ResolverComo
                estadoActual="pendiente"
                estadoSugerido={caso.estado_sugerido}
                cargando={loading}
                deshabilitado={vencido}
                motivoDeshabilitado="El plazo de corrección venció; el sistema lo resolverá como ausente"
                onResolver={resolver}
            />
        </article>
    );
}
