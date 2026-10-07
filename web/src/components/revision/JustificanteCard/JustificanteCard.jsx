'use client';

import { Check, X } from 'lucide-react';
import { useId, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusChip from '@/components/ui/StatusChip';
import { useApiMutation } from '@/hooks/data';
import { resolverJustificante } from '@/lib/api/revision.js';
import { obtenerDocumentoJustificante } from '@/lib/http/revision.js';
import LecturasCaso from '../LecturasCaso';
import { formatearFechaHora } from '../PlazoRestante/plazoRestante.utils.js';
import { ETIQUETAS, MAX_COMENTARIO, normalizarComentario } from '../ResolverComo/resolverComo.utils.js';

// Textos de cada decisión en el diálogo de confirmación.
const DECISION = {
    aprobar: {
        titulo: 'Aprobar justificante',
        mensaje: 'Aprobar cambia el registro a justificado y no se puede deshacer.',
        confirmar: 'Aprobar',
        variante: 'primary',
        campo: 'Comentario (opcional)',
    },
    rechazar: {
        titulo: 'Rechazar justificante',
        mensaje: 'Rechazar conserva el estado del registro.',
        confirmar: 'Rechazar',
        variante: 'danger',
        campo: 'Motivo del rechazo',
    },
};

// Detalle de un justificante pendiente: motivo, documento por URL firmada, lecturas y Aprobar / Rechazar. Cada decisión se confirma UNA
// vez, en un solo diálogo que ya lleva el comentario (opcional al aprobar, obligatorio al rechazar): el docente no escribe nada «aparte»
// antes de saber para qué. El comentario queda en la bitácora de la resolución; el alumno solo ve el estatus. Aprobar deja el registro
// justificado sin borrar lecturas.
export default function JustificanteCard({ justificante, minimoValidas, onResuelto, onRecargar, onCerrar }) {
    const { run, loading, error } = useApiMutation(resolverJustificante);
    const [confirmar, setConfirmar] = useState(null); // 'aprobar' | 'rechazar' | null
    const [doc, setDoc] = useState({ cargando: false, url: null, error: null });
    // Las lecturas se piden al abrirlas por primera vez: cada carga queda en la bitácora de consulta (RF-19) y los recortes
    // firmados vencen a los 5 min, así que no se cargan «por si acaso». Al ocultar se conservan montadas (sin otra consulta).
    const [lecturas, setLecturas] = useState({ visibles: false, cargadas: false });
    const idLecturas = useId();

    const verDocumento = async () => {
        setDoc({ cargando: true, url: null, error: null });
        try {
            const r = await obtenerDocumentoJustificante(justificante.id_justificante);
            const ventana = window.open(r.url, '_blank', 'noopener');
            // Si el navegador bloquea la ventana, se deja el enlace visible.
            setDoc({ cargando: false, url: ventana ? null : r.url, error: null });
        } catch (e) {
            setDoc({ cargando: false, url: null, error: e.message });
        }
    };

    const resolver = async (aprobar, comentario) => {
        try {
            const resultado = await run({
                idJustificante: justificante.id_justificante,
                aprobar,
                comentario: normalizarComentario(comentario),
            });
            setConfirmar(null);
            onResuelto?.(resultado, aprobar);
        } catch (e) {
            setConfirmar(null);
            if (['JUSTIFICANTE_YA_RESUELTO', 'ESTADO_NO_JUSTIFICABLE'].includes(e?.code)) onRecargar?.();
        }
    };

    const j = justificante;
    const estadoActual = ETIQUETAS[j.estado_asistencia] ?? j.estado_asistencia;
    return (
        <article aria-label={`Justificante de ${j.alumno.nombre_completo}`} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <header className="flex flex-col gap-2">
                <Button variant="ghost" size="sm" className="self-start md:hidden" onClick={onCerrar}>
                    Volver a la lista
                </Button>
                {/* flex-wrap: a 360 px los dos chips bajan a su propia línea en lugar de dejar el nombre en «Me…». */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Avatar nombre={j.alumno.nombre_completo} />
                    <div className="min-w-0 flex-1 basis-44">
                        <h2 className="truncate text-lg font-semibold leading-tight">{j.alumno.nombre_completo}</h2>
                        <p className="truncate text-sm text-muted-foreground">
                            {j.alumno.matricula} · {j.materia.nombre} · {j.grupo.clave_grupo}
                        </p>
                    </div>
                    <span className="flex flex-wrap gap-1.5">
                        <StatusChip kind="justificante" value="pendiente" />
                        <StatusChip kind="asistencia" value={j.estado_asistencia} />
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">
                    Sesión del {j.sesion.fecha} · Registrado por {j.registrado_por_rol === 'docente' ? 'el docente' : 'el alumno'} el {formatearFechaHora(j.fecha_registro)}
                </p>
            </header>

            <section aria-label="Motivo">
                <h3 className="text-sm font-semibold">Motivo</h3>
                <p className="text-sm">{j.motivo}</p>
                <Button variant="secondary" size="sm" className="mt-2" loading={doc.cargando} onClick={verDocumento}>
                    Ver documento
                </Button>
                {doc.url && (
                    <p className="mt-2 text-sm">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-link underline">
                            Abrir documento
                        </a>{' '}
                        (vence en 5 min)
                    </p>
                )}
                {doc.error && <Alert tone="danger" className="mt-2">{doc.error}</Alert>}
            </section>

            <section aria-label="Lecturas del reconocimiento" className="flex flex-col gap-3">
                <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    aria-expanded={lecturas.visibles}
                    aria-controls={lecturas.cargadas ? idLecturas : undefined}
                    onClick={() => setLecturas((previo) => ({ visibles: !previo.visibles, cargadas: true }))}
                >
                    {lecturas.visibles ? 'Ocultar lecturas del reconocimiento' : 'Ver lecturas del reconocimiento'}
                </Button>
                {lecturas.cargadas && (
                    <div id={idLecturas} hidden={!lecturas.visibles}>
                        <LecturasCaso idAsistencia={j.id_asistencia} minimoValidas={minimoValidas} />
                    </div>
                )}
            </section>

            {error && <Alert tone="danger">{error.message}</Alert>}

            <section aria-label="Decisión" className="flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                    Aprobar deja el registro como justificado. Rechazar lo conserva{estadoActual ? ` como ${estadoActual.toLowerCase()}` : ' sin cambios'}.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button icon={<Check aria-hidden="true" className="size-4" strokeWidth={1.75} />} disabled={loading} onClick={() => setConfirmar('aprobar')} className="w-full sm:w-auto">
                        Aprobar
                    </Button>
                    <Button variant="danger" icon={<X aria-hidden="true" className="size-4" strokeWidth={1.75} />} disabled={loading} onClick={() => setConfirmar('rechazar')} className="w-full sm:w-auto">
                        Rechazar
                    </Button>
                </div>
            </section>

            {/* Un solo diálogo para las dos decisiones: lleva el comentario dentro (obligatorio al rechazar, para que el registro de la
                resolución no quede sin explicación) y nombra a quién y qué se resuelve. */}
            <ConfirmDialog
                open={confirmar !== null}
                title={DECISION[confirmar ?? 'aprobar'].titulo}
                message={DECISION[confirmar ?? 'aprobar'].mensaje}
                confirmLabel={DECISION[confirmar ?? 'aprobar'].confirmar}
                variant={DECISION[confirmar ?? 'aprobar'].variante}
                reason={{ label: DECISION[confirmar ?? 'aprobar'].campo, required: confirmar === 'rechazar', maxLength: MAX_COMENTARIO }}
                onConfirm={(texto) => resolver(confirmar === 'aprobar', texto)}
                onCancel={() => setConfirmar(null)}
            >
                <p className="mt-2 text-sm text-muted-foreground">
                    {j.alumno.nombre_completo} · {j.materia.nombre} · sesión del {j.sesion.fecha}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">El comentario queda en la bitácora; el alumno solo ve el estatus.</p>
            </ConfirmDialog>
        </article>
    );
}
