'use client';

import { useId, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Field from '@/components/ui/Field';
import StatusChip from '@/components/ui/StatusChip';
import Textarea from '@/components/ui/Textarea';
import { useApiMutation } from '@/hooks/data';
import { resolverJustificante } from '@/lib/api/revision.js';
import { obtenerDocumentoJustificante } from '@/lib/http/revision.js';
import LecturasCaso from '../LecturasCaso';
import { formatearFechaHora } from '../PlazoRestante/plazoRestante.utils.js';
import { MAX_COMENTARIO, normalizarComentario } from '../ResolverComo/resolverComo.utils.js';

// Detalle de un justificante pendiente: motivo, documento por URL firmada, lecturas y Aprobar / Rechazar
// (ambos con confirmación). Aprobar deja el registro justificado sin borrar lecturas.
export default function JustificanteCard({ justificante, minimoValidas, onResuelto, onRecargar, onCerrar }) {
    const { run, loading, error } = useApiMutation(resolverJustificante);
    const [comentario, setComentario] = useState('');
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

    const resolver = async (aprobar) => {
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

            <Field label="Comentario (opcional)">
                <Textarea rows={2} maxLength={MAX_COMENTARIO} showCount value={comentario} onChange={(e) => setComentario(e.target.value)} />
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button disabled={loading} onClick={() => setConfirmar('aprobar')} className="w-full sm:w-auto">
                    Aprobar
                </Button>
                <Button variant="danger" disabled={loading} onClick={() => setConfirmar('rechazar')} className="w-full sm:w-auto">
                    Rechazar
                </Button>
            </div>

            <ConfirmDialog
                open={confirmar === 'aprobar'}
                title="Aprobar justificante"
                message="Aprobar cambia el registro a justificado y no se puede deshacer."
                confirmLabel="Aprobar"
                onConfirm={() => resolver(true)}
                onCancel={() => setConfirmar(null)}
            />
            <ConfirmDialog
                open={confirmar === 'rechazar'}
                title="Rechazar justificante"
                message="Rechazar conserva el estado del registro."
                confirmLabel="Rechazar"
                variant="danger"
                onConfirm={() => resolver(false)}
                onCancel={() => setConfirmar(null)}
            />
        </article>
    );
}
