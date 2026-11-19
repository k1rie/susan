'use client';

import { Check, X } from 'lucide-react';
import { useId } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { formatoFechaCorta, rangoHoras } from '../../laboratorios.utils.js';
import DatosSolicitud from '../DatosSolicitud';
import DialogoMotivo from '../DialogoMotivo';
import { etiquetaLaboratorio } from '../laboratoriosAdmin.utils.js';
import { motivosBloqueo, textoCompite } from './solicitudPendiente.utils.js';
import { useSolicitudPendiente } from './useSolicitudPendiente.js';

// Tarjeta de una solicitud pendiente con sus avisos y las dos decisiones. «Aprobar» se apaga con el motivo a la vista cuando hoy no sería
// posible (vencida, laboratorio ocupado, grupo que no cabe); «Rechazar» siempre está disponible y exige un motivo.
// Cada decisión pasa por un diálogo: aprobar pide un comentario opcional y rechazar uno obligatorio (3 a 300 caracteres).
//   solicitud   un item pendiente de api_laboratorio_solicitudes_listar (con `conflicto` y `compite`).
//   hoy         'AAAA-MM-DD' del plantel.
export default function SolicitudPendiente({ solicitud, hoy = null, onResuelta, onRecargar }) {
    const avisosId = useId();
    const { dialogo, abrir, cerrar, resolver } = useSolicitudPendiente({ solicitud, onResuelta, onRecargar });
    const bloqueos = motivosBloqueo(solicitud);
    const compite = textoCompite(solicitud.compite);
    const hayAvisos = bloqueos.length > 0 || compite !== '';

    const fecha = formatoFechaCorta(solicitud.fecha, hoy);
    const laboratorio = etiquetaLaboratorio(solicitud.aula);
    const resumen = `${laboratorio}, ${fecha} de ${rangoHoras(solicitud.hora_inicio, solicitud.hora_fin)}, grupo ${solicitud.grupo?.clave_grupo}`;

    return (
        <article aria-label={`Solicitud de ${solicitud.aula?.clave}, ${fecha}`} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
            <DatosSolicitud solicitud={solicitud} hoy={hoy} />

            {hayAvisos && (
                <div id={avisosId} className="flex flex-col gap-2">
                    {bloqueos.map((motivo) => (
                        <Alert key={motivo} tone="warning" compact>
                            {motivo}
                        </Alert>
                    ))}
                    {compite && (
                        <Alert tone="info" compact>
                            {compite}
                        </Alert>
                    )}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                <Button
                    icon={<Check aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                    disabled={bloqueos.length > 0}
                    aria-describedby={bloqueos.length > 0 ? avisosId : undefined}
                    onClick={() => abrir('aprobar')}
                >
                    Aprobar
                </Button>
                <Button variant="secondary" icon={<X aria-hidden="true" className="size-4" strokeWidth={1.75} />} onClick={() => abrir('rechazar')}>
                    Rechazar
                </Button>
            </div>

            {dialogo === 'aprobar' && (
                <DialogoMotivo
                    titulo="Aprobar solicitud"
                    mensaje={`Se reservará ${resumen}.`}
                    etiqueta="Comentario para el docente"
                    ayuda="Opcional. Queda registrado en la solicitud."
                    etiquetaConfirmar="Aprobar solicitud"
                    onConfirm={(texto) => resolver(true, texto)}
                    onClose={cerrar}
                />
            )}
            {dialogo === 'rechazar' && (
                <DialogoMotivo
                    titulo="Rechazar solicitud"
                    mensaje={`Rechazarás la solicitud de ${solicitud.docente?.nombre_completo ?? 'la persona docente'}: ${resumen}.`}
                    etiqueta="Motivo del rechazo"
                    ayuda="Explica por qué no se autoriza. Queda registrado en la solicitud."
                    obligatorio
                    variante="danger"
                    etiquetaConfirmar="Rechazar solicitud"
                    onConfirm={(texto) => resolver(false, texto)}
                    onClose={cerrar}
                />
            )}
        </article>
    );
}
