'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataState from '@/components/ui/DataState';
import Field from '@/components/ui/Field';
import FileInput from '@/components/ui/FileInput';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { registrarConsentimiento, revocarConsentimiento, solicitarUrlDocumento } from '@/lib/http/biometria.js';
import {
    hoyLocal, MAX_DOCUMENTO_BYTES, resumenConsentimiento, textoEstatusItem, validarConsentimiento,
} from './consentimiento.utils.js';
import useConsentimientos from './useConsentimientos.js';

const VACIO = { fechaFirma: '', vigenciaHasta: '', documento: null };

// Consentimiento informado firmado (RN-13): estado, documento, registro y revocación.
export default function ConsentimientoPanel({ idAlumno, version = 0, onCambio }) {
    const consulta = useConsentimientos(idAlumno, version);
    const { toast } = useToast();
    const registrar = useApiMutation(registrarConsentimiento);
    const [form, setForm] = useState(VACIO);
    const [errores, setErrores] = useState({});
    const [formAbierto, setFormAbierto] = useState(false);
    const [confirmando, setConfirmando] = useState(false);
    const [enlace, setEnlace] = useState(null);
    const [abriendo, setAbriendo] = useState(false);

    const resumen = resumenConsentimiento(consulta.data);
    const mostrarForm = resumen.estado !== 'vigente' || formAbierto;

    const alCambiar = async () => {
        await consulta.refetch();
        onCambio?.();
    };

    const enviar = async (e) => {
        e.preventDefault();
        const encontrados = validarConsentimiento(form);
        setErrores(encontrados);
        if (Object.keys(encontrados).length > 0) return;
        const datos = new FormData();
        datos.append('id_alumno', String(idAlumno));
        datos.append('fecha_firma', form.fechaFirma);
        datos.append('vigencia_hasta', form.vigenciaHasta);
        datos.append('documento', form.documento, form.documento.name || 'consentimiento.pdf');
        try {
            await registrar.run(datos);
            toast({ tone: 'success', title: 'Consentimiento registrado' });
            setForm(VACIO);
            setFormAbierto(false);
            await alCambiar();
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo registrar el consentimiento', message: err.message });
        }
    };

    const revocar = async () => {
        try {
            await revocarConsentimiento({ idConsent: resumen.idConsent });
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo revocar', message: err.message });
            throw err;
        }
        setConfirmando(false);
        toast({ tone: 'success', title: 'Consentimiento revocado', message: 'La plantilla ligada se archivó.' });
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
        <Card title="Consentimiento informado">
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
                                    <Button variant="secondary" size="sm" onClick={() => setFormAbierto((v) => !v)}>
                                        {formAbierto ? 'Cancelar nuevo registro' : 'Registrar nuevo'}
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => setConfirmando(true)}>
                                        Revocar
                                    </Button>
                                </>
                            )}
                        </div>

                        {resumen.estado !== 'vigente' && (
                            <Alert tone="warning" title="Sin consentimiento vigente">
                                Se tomará asistencia por pase de lista manual. Registre el documento firmado para habilitar la plantilla facial.
                            </Alert>
                        )}

                        {enlace && (
                            <p className="text-sm" aria-live="polite">
                                <a href={enlace.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                    Abrir documento firmado
                                </a>{' '}
                                <span className="text-muted-foreground">(el enlace caduca en 5 minutos)</span>
                            </p>
                        )}

                        {mostrarForm && (
                            <form onSubmit={enviar} noValidate className="grid gap-3 sm:grid-cols-2" aria-label="Registrar consentimiento">
                                <Field label="Fecha de firma" required error={errores.fechaFirma}>
                                    <Input type="date" max={hoyLocal()} value={form.fechaFirma} onChange={(e) => setForm((f) => ({ ...f, fechaFirma: e.target.value }))} />
                                </Field>
                                <Field label="Vigente hasta" required error={errores.vigenciaHasta}>
                                    <Input type="date" min={form.fechaFirma || undefined} value={form.vigenciaHasta} onChange={(e) => setForm((f) => ({ ...f, vigenciaHasta: e.target.value }))} />
                                </Field>
                                <div className="flex flex-col gap-1 sm:col-span-2">
                                    <span className="text-sm font-medium">Documento firmado (PDF, máx. 10 MB)</span>
                                    <FileInput
                                        accept="application/pdf"
                                        maxBytes={MAX_DOCUMENTO_BYTES}
                                        value={form.documento}
                                        onSelect={(documento) => setForm((f) => ({ ...f, documento }))}
                                        label="Seleccionar PDF"
                                        error={errores.documento}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <Button type="submit" loading={registrar.loading}>
                                        Registrar consentimiento
                                    </Button>
                                </div>
                            </form>
                        )}

                        <div>
                            <h3 className="mb-2 text-sm font-semibold">Historial</h3>
                            {data.items?.length ? (
                                <ul className="flex flex-col gap-2">
                                    {data.items.map((c) => (
                                        <li key={c.id_consent} className="rounded-2xl border border-border p-3.5 text-sm">
                                            <p className="font-medium">
                                                Firmado {c.fecha_firma} · vigente hasta {c.vigencia_hasta}
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
