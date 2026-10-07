'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import CampoFecha from '@/components/ui/CampoFecha';
import Field from '@/components/ui/Field';
import FileInput from '@/components/ui/FileInput';
import FormActions from '@/components/ui/FormActions';
import Spinner from '@/components/ui/Spinner';
import { useApiMutation } from '@/hooks/data';
import { useCambiosSinGuardar } from '@/hooks/ui/useCambiosSinGuardar.js';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { registrarConsentimiento } from '@/lib/http/biometria.js';
import { sumarAnios, sumarDias } from '@/lib/formularios/fechas.js';
import {
    describirVigencia, MAX_DOCUMENTO_BYTES, mapearErrorConsentimiento, validarConsentimiento, vigenciaSugerida,
} from './consentimiento.utils.js';
import useHoyNegocio from './useHoyNegocio.js';

const INICIAL = { fechaFirma: '', vigenciaHasta: '', documento: null };

// Registro de un consentimiento firmado (RN-13): dos fechas y el PDF. Al elegir la fecha de firma se sugiere la vigencia de un año
// (editable, con atajos «+1 año» y «+2 años»), se escribe cuánto dura y el documento se arrastra a una zona con las reglas a la vista.
//   idAlumno      alumno al que pertenece
//   onRegistrado  (consentimiento) => void, cuando el servidor lo aceptó
//   onCancelar    si se pasa, muestra «Cancelar» (cuando ya hay un consentimiento vigente y este sería uno nuevo)
export default function FormularioConsentimiento({ idAlumno, onRegistrado, onCancelar }) {
    const { hoy, listo } = useHoyNegocio();
    const registrar = useApiMutation(registrarConsentimiento);
    const [vigenciaPropia, setVigenciaPropia] = useState(false);

    const f = useFormulario({
        inicial: INICIAL,
        validar: (v) => validarConsentimiento(v, hoy),
        mapearError: mapearErrorConsentimiento,
        onSubmit: async (v) => {
            const datos = new FormData();
            datos.append('id_alumno', String(idAlumno));
            datos.append('fecha_firma', v.fechaFirma);
            datos.append('vigencia_hasta', v.vigenciaHasta);
            datos.append('documento', v.documento, v.documento.name || 'consentimiento.pdf');
            const registrado = await registrar.run(datos);
            onRegistrado?.(registrado);
        },
    });
    useCambiosSinGuardar(f.sucio);

    const firma = f.campo('fechaFirma');
    const vigencia = f.campo('vigenciaHasta');
    const documento = f.campo('documento');
    const { fechaFirma, vigenciaHasta } = f.valores;
    const duracion = describirVigencia(fechaFirma, vigenciaHasta);
    // La vigencia no puede ser anterior a hoy ni a la firma (la RPC pide posterior a la firma y no vencida).
    const minVigencia = [sumarDias(fechaFirma, 1), hoy].filter(Boolean).sort().at(-1);

    const alCambiarFirma = (e) => {
        const nueva = e.target.value;
        firma.onChange(e);
        // Mientras la vigencia no se haya tocado a mano, sigue a la firma (un año después).
        if (!vigenciaPropia) f.setCampo('vigenciaHasta', vigenciaSugerida(nueva));
    };
    const alCambiarVigencia = (e) => {
        setVigenciaPropia(true);
        vigencia.onChange(e);
    };

    const ayudaVigencia = !vigenciaHasta
        ? 'Hasta cuándo es válido el documento.'
        : !vigenciaPropia
          ? `Sugerida: 1 año desde la firma${duracion && duracion !== '1 año' ? ` (ahora son ${duracion})` : ''}. Cámbiala si el documento indica otra.`
          : duracion
            ? `Vigencia de ${duracion}.`
            : undefined;

    if (!listo) {
        return (
            <div className="flex justify-center rounded-xl border border-border p-6">
                <Spinner label="Preparando el formulario" />
            </div>
        );
    }

    return (
        <form onSubmit={f.enviar} noValidate aria-label="Registrar consentimiento" className="flex flex-col gap-4 rounded-xl border border-border p-4">
            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">Registrar consentimiento firmado</h3>
                <p className="text-[13px] text-muted-foreground">Sube el PDF firmado y confirma las fechas que trae el documento.</p>
            </div>
            <div className="@container">
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2">
                    <Field label="Fecha de firma" required error={firma.error}>
                        <CampoFecha {...firma.props} onChange={alCambiarFirma} max={hoy} hoy={hoy} />
                    </Field>
                    <Field label="Vigente hasta" required hint={ayudaVigencia} error={vigencia.error}>
                        <CampoFecha
                            {...vigencia.props}
                            onChange={alCambiarVigencia}
                            min={minVigencia}
                            hoy={hoy}
                            atajos={[
                                { label: '+1 año', valor: () => sumarAnios(fechaFirma, 1) },
                                { label: '+2 años', valor: () => sumarAnios(fechaFirma, 2) },
                            ]}
                        />
                    </Field>
                </div>
            </div>
            <Field label="Documento firmado" required error={documento.error}>
                <FileInput
                    variant="zona"
                    accept="application/pdf"
                    maxBytes={MAX_DOCUMENTO_BYTES}
                    value={f.valores.documento}
                    onSelect={(archivo) => f.setCampo('documento', archivo)}
                    label="selecciona el PDF"
                    disabled={f.enviando}
                />
            </Field>
            {f.errorEnvio && (
                <Alert tone="danger" compact title="No se pudo registrar el consentimiento">
                    {f.errorEnvio.message}
                </Alert>
            )}
            <FormActions
                sticky={false}
                summary={
                    f.enviando ? (
                        <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                            <Spinner size="sm" label="Subiendo" />
                            Subiendo el documento y registrando el consentimiento…
                        </span>
                    ) : undefined
                }
            >
                {onCancelar && (
                    <Button variant="secondary" onClick={onCancelar} disabled={f.enviando}>
                        Cancelar
                    </Button>
                )}
                <Button type="submit" loading={f.enviando}>
                    Registrar consentimiento
                </Button>
            </FormActions>
        </form>
    );
}
