'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataState from '@/components/ui/DataState';
import { useToast } from '@/components/ui/Toast';
import { revocarConsentimiento, solicitarUrlDocumento } from '@/lib/http/biometria.js';
import { fechaLegible, resumenConsentimiento, textoEstatusItem } from './consentimiento.utils.js';
import FormularioConsentimiento from './FormularioConsentimiento.jsx';
import useConsentimientos from './useConsentimientos.js';

// Consentimiento informado firmado (RN-13): estado, documento, registro y revocación.
//   alumnoActivo  false si el alumno está en baja: la RPC solo registra consentimientos de alumnos activos, así que en vez del
//                 formulario se explica qué hacer.
export default function ConsentimientoPanel({ idAlumno, version = 0, onCambio, alumnoActivo = true }) {
    const consulta = useConsentimientos(idAlumno, version);
    const { toast } = useToast();
    const [formAbierto, setFormAbierto] = useState(false);
    const [confirmando, setConfirmando] = useState(false);
    const [enlace, setEnlace] = useState(null);
    const [abriendo, setAbriendo] = useState(false);
    const [registrado, setRegistrado] = useState(null);

    const resumen = resumenConsentimiento(consulta.data);
    const mostrarForm = alumnoActivo && (resumen.estado !== 'vigente' || formAbierto);

    const alCambiar = async () => {
        await consulta.refetch();
        onCambio?.();
    };

    const alRegistrar = async (nuevo) => {
        setFormAbierto(false);
        setRegistrado(nuevo);
        await alCambiar();
    };

    const revocar = async () => {
        let respuesta;
        try {
            respuesta = await revocarConsentimiento({ idConsent: resumen.idConsent });
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo revocar', message: err.message });
            throw err;
        }
        setConfirmando(false);
        setRegistrado(null);
        // La revocación solo es efectiva cuando el índice se reconstruye: si quedó pendiente, el vector sigue
        // en el índice y hay que avisarlo en lugar de dar el trámite por cerrado.
        if (respuesta?.indice?.estado === 'pendiente') {
            toast({
                tone: 'warning',
                title: 'Consentimiento revocado',
                message: 'El índice facial conserva el vector hasta que se reconstruya; pide a un técnico que lo reconstruya.',
                durationMs: 10000,
            });
        } else {
            toast({ tone: 'success', title: 'Consentimiento revocado', message: 'La plantilla ligada se archivó.' });
        }
        await alCambiar();
    };

    // La URL firmada dura <= 300 s: se muestra como enlace para no depender del bloqueo de ventanas emergentes.
    const verDocumento = async (idConsent) => {
        setAbriendo(true);
        try {
            const r = await solicitarUrlDocumento({ tipo: 'consentimiento', idRegistro: idConsent });
            setEnlace({ idConsent, url: r.url });
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo abrir el documento', message: err.message });
        } finally {
            setAbriendo(false);
        }
    };

    return (
        <Card id="consentimiento" title="Consentimiento informado" className="scroll-mt-20 lg:scroll-mt-4">
            <DataState
                loading={consulta.loading}
                error={consulta.error}
                data={consulta.data}
                onRetry={consulta.refetch}
                isEmpty={() => false}
            >
                {(data) => (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={resumen.tone}>{resumen.texto}</Badge>
                            {resumen.estado === 'vigente' && (
                                <>
                                    {alumnoActivo && (
                                        <Button variant="secondary" size="sm" onClick={() => setFormAbierto((v) => !v)}>
                                            {formAbierto ? 'Cancelar nuevo registro' : 'Registrar nuevo'}
                                        </Button>
                                    )}
                                    <Button variant="danger" size="sm" onClick={() => setConfirmando(true)}>
                                        Revocar
                                    </Button>
                                </>
                            )}
                        </div>

                        {registrado && (
                            <Alert tone="success" title="Consentimiento registrado" onClose={() => setRegistrado(null)}>
                                Vigente hasta {fechaLegible(registrado.vigencia_hasta)}. Siguiente paso:{' '}
                                <a href="#plantilla" className="font-medium underline underline-offset-2">
                                    registrar la plantilla facial
                                </a>
                                .
                            </Alert>
                        )}

                        {resumen.estado !== 'vigente' && !registrado && (
                            <Alert tone="warning" title="Sin consentimiento vigente">
                                Se tomará asistencia por pase de lista manual. Registra el documento firmado para habilitar la plantilla facial.
                            </Alert>
                        )}

                        {!alumnoActivo && resumen.estado !== 'vigente' && (
                            <Alert tone="info" compact>
                                Solo se registra el consentimiento de un alumno activo. Reactívalo en la sección Estado de sus datos.
                            </Alert>
                        )}

                        {enlace && (
                            <p className="text-sm" aria-live="polite">
                                <a href={enlace.url} target="_blank" rel="noopener noreferrer" className="text-link underline">
                                    Abrir documento firmado
                                </a>{' '}
                                <span className="text-muted-foreground">(el enlace caduca en 5 minutos)</span>
                            </p>
                        )}

                        {mostrarForm && (
                            <FormularioConsentimiento
                                idAlumno={idAlumno}
                                onRegistrado={alRegistrar}
                                onCancelar={resumen.estado === 'vigente' ? () => setFormAbierto(false) : undefined}
                            />
                        )}

                        <div>
                            <h3 className="mb-2 text-sm font-semibold">Historial</h3>
                            {data.items?.length ? (
                                <ul className="flex flex-col gap-2">
                                    {data.items.map((c) => (
                                        <li key={c.id_consent} className="rounded-xl border border-border p-3.5 text-sm">
                                            <p className="font-medium">
                                                Firmado {fechaLegible(c.fecha_firma)} · vigente hasta {fechaLegible(c.vigencia_hasta)}
                                            </p>
                                            <p className="text-muted-foreground">
                                                {textoEstatusItem(c)} · {c.plantillas_activas ?? 0} plantilla(s) activa(s)
                                            </p>
                                            {c.tiene_documento && (
                                                <Button variant="ghost" size="sm" loading={abriendo} onClick={() => verDocumento(c.id_consent)}>
                                                    Ver documento firmado
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">Este alumno aún no tiene consentimientos registrados.</p>
                            )}
                        </div>
                    </div>
                )}
            </DataState>

            <ConfirmDialog
                open={confirmando}
                title="Revocar consentimiento"
                message="Al revocar, se archivará la plantilla facial ligada y el alumno pasará a pase de lista manual."
                confirmLabel="Revocar"
                variant="danger"
                onConfirm={revocar}
                onCancel={() => setConfirmando(false)}
            />
        </Card>
    );
}
