'use client';

import { FileCheck2 } from 'lucide-react';
import { useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import Field from '@/components/ui/Field';
import FileInput from '@/components/ui/FileInput';
import FormActions from '@/components/ui/FormActions';
import SuccessState from '@/components/ui/SuccessState';
import Textarea from '@/components/ui/Textarea';
import { useApiQuery } from '@/hooks/data';
import useCambiosSinGuardar from '@/hooks/ui/useCambiosSinGuardar.js';
import { misJustificables } from '@/lib/api/revision.js';
import ElegirFalta from './ElegirFalta.jsx';
import EtiquetaPaso from './EtiquetaPaso.jsx';
import useRegistrarJustificante from './useRegistrarJustificante.js';
import {
    ACCEPT,
    MAX_BYTES,
    MOTIVOS_SUGERIDOS,
    MOTIVO_MAX,
    pendientesDeCaptura,
    primerCampoConError,
    sesionInicial,
    textoPendientes,
    validarFormulario,
} from './registrarJustificante.utils.js';

const TEXTO_FASE = { subiendo: 'Subiendo documento…', guardando: 'Registrando justificante…' };
// Para llevar el foco al primer campo con error: cada bloque del formulario lleva su `data-campo`.
const SELECTOR_FOCO = ':is(input, textarea, button, [role="combobox"]):not([disabled])';

// Formulario puro (recibe los registros justificables ya cargados). Sin borde propio: la tarjeta y el título los pone
// RegistrarJustificanteForm, para que el estado de carga, el vacío, el formulario y el éxito compartan una sola tarjeta.
// Es un formulario guiado en tres bloques (falta → motivo → documento); cada número se vuelve palomita al resolverse y la barra de
// abajo dice qué falta. El botón nunca se apaga: al pulsarlo con datos incompletos se marcan los errores y el foco va al primero.
export function FormularioJustificante({ registros, idSesionInicial = null, onRegistrado, onNoJustificable }) {
    const [elegida, setElegida] = useState(() => sesionInicial(registros, idSesionInicial));
    // Si la falta elegida ya no es justificable (se recargó la lista), se deja de dar por elegida.
    const idSesion = registros.some((r) => String(r.id_sesion) === elegida) ? elegida : '';
    const [motivo, setMotivo] = useState('');
    const [archivo, setArchivo] = useState(null);
    const [intentado, setIntentado] = useState(false);
    const formRef = useRef(null);
    const motivoRef = useRef(null);
    const h = useRegistrarJustificante({ onRegistrado, onNoJustificable });

    // Tras el primer intento de envío los errores se recalculan en cada cambio: desaparecen en cuanto se corrigen.
    const errores = intentado ? validarFormulario({ idSesion, motivo, archivo }) : {};
    const faltan = pendientesDeCaptura({ idSesion, motivo, archivo });
    const registroElegido = registros.find((r) => String(r.id_sesion) === idSesion);
    // Lo capturado se pierde al salir: se avisa al recargar o cerrar la pestaña (no hay nada que «guardar» hasta enviarlo).
    useCambiosSinGuardar(Boolean(motivo.trim() || archivo) && !h.ocupado);

    const alEnviar = (e) => {
        e.preventDefault();
        setIntentado(true);
        const campo = primerCampoConError(validarFormulario({ idSesion, motivo, archivo }));
        if (campo) {
            formRef.current?.querySelector(`[data-campo="${campo}"] ${SELECTOR_FOCO}`)?.focus();
            return;
        }
        h.enviar({ idSesion: Number(idSesion), motivo, archivo });
    };

    const empezarMotivo = (texto) => {
        setMotivo(`${texto}: `);
        motivoRef.current?.focus();
    };

    return (
        <form ref={formRef} onSubmit={alEnviar} noValidate className="flex flex-col gap-5" aria-label="Registrar justificante">
            {h.error && (
                <Alert tone="danger" compact title="No se pudo enviar el justificante">
                    {h.error}
                </Alert>
            )}

            <div data-campo="idSesion" className="flex flex-col gap-2">
                <ElegirFalta registros={registros} value={idSesion} onChange={setElegida} error={errores.idSesion} />
                {registroElegido?.tiene_rechazado && (
                    <Alert tone="warning" compact>
                        Tu justificante anterior para esta falta fue rechazado. Puedes enviar uno nuevo con el documento o el motivo corregido.
                    </Alert>
                )}
            </div>

            <div data-campo="motivo" className="flex flex-col gap-2">
                <Field label={<EtiquetaPaso n={2} hecho={Boolean(motivo.trim())}>Motivo</EtiquetaPaso>} required error={errores.motivo} hint="Cuenta en pocas palabras qué pasó.">
                    <Textarea
                        ref={motivoRef}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        maxLength={MOTIVO_MAX}
                        showCount
                        autoGrow
                        rows={3}
                        maxRows={6}
                        placeholder="Ej. Cita médica durante la clase."
                    />
                </Field>
                {/* Ideas para empezar: solo con el campo vacío, para no estorbar a quien ya escribe. */}
                {!motivo.trim() && (
                    <div role="group" aria-label="Ideas para empezar el motivo" className="flex flex-wrap gap-2">
                        {MOTIVOS_SUGERIDOS.map((texto) => (
                            <button
                                key={texto}
                                type="button"
                                onClick={() => empezarMotivo(texto)}
                                className="inline-flex min-h-9 items-center rounded-full bg-muted px-3 text-[13px] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                            >
                                {texto}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div data-campo="archivo" className="flex flex-col gap-2">
                <Field
                    label={<EtiquetaPaso n={3} hecho={Boolean(archivo)}>Documento</EtiquetaPaso>}
                    required
                    hint="Foto o PDF legible del comprobante (por ejemplo, una constancia médica)."
                >
                    <FileInput
                        variant="zona"
                        preview="imagen"
                        value={archivo}
                        onSelect={setArchivo}
                        accept={ACCEPT}
                        maxBytes={MAX_BYTES}
                        label="elige un archivo"
                        error={errores.archivo}
                    />
                </Field>
                {/* Solo en pantallas táctiles: abre la cámara trasera directamente (en escritorio la zona ya cubre elegir o arrastrar). `capture`
                    solo se usa en este botón porque, junto con PDF en `accept`, algunos teléfonos abrirían la cámara y no dejarían elegir un PDF. */}
                <div className="hidden [@media(pointer:coarse)]:block">
                    <FileInput variant="boton" capture="environment" accept=".jpg,.jpeg,.png" maxBytes={MAX_BYTES} label="Tomar foto" onSelect={(f) => f && setArchivo(f)} />
                </div>
            </div>

            <FormActions sticky={false} summary={h.ocupado ? TEXTO_FASE[h.fase] : textoPendientes(faltan)}>
                <Button type="submit" loading={h.ocupado}>
                    Enviar justificante
                </Button>
            </FormActions>
        </form>
    );
}

// Lleva a la tarjeta «Mis justificantes» (vive junto a esta, en la misma página). Se centra en pantalla en lugar de alinearla arriba: en
// teléfono la barra superior fija taparía el título.
function verMisJustificantes() {
    const tarjeta = document.getElementById('t-mis-just')?.closest('section');
    const reducido = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    tarjeta?.scrollIntoView?.({ block: 'center', behavior: reducido ? 'auto' : 'smooth' });
}

// Éxito dentro de la propia tarjeta: qué pasó, en qué estado quedó y qué sigue (nunca un «listo» sin salida).
function JustificanteEnviado({ restantes, onOtra }) {
    return (
        <SuccessState
            className="py-4"
            title="Justificante enviado"
            description="Tu docente lo revisará. Mientras tanto aparece como Pendiente en «Mis justificantes»."
            steps={[
                ...(restantes > 0
                    ? [{ label: 'Justificar otra falta', description: restantes === 1 ? '1 pendiente' : `${restantes} pendientes`, onClick: onOtra, recommended: true }]
                    : []),
                { label: 'Ver mis justificantes', description: 'Revisa su estado', onClick: verMisJustificantes, recommended: restantes === 0 },
            ]}
            actions={restantes === 0 ? [{ label: 'Listo', variant: 'secondary', onClick: onOtra }] : []}
        />
    );
}

// Modo alumno: carga las faltas/retardos justificables con misJustificables.
export default function RegistrarJustificanteForm({ idSesion = null, registros, onRegistrado }) {
    const q = useApiQuery(misJustificables, { limit: 50 }, { enabled: !registros });
    const [enviado, setEnviado] = useState(null); // el justificante recién enviado (id_sesion), o null
    const [inicial, setInicial] = useState(idSesion);
    const tituloRef = useRef(null);
    const lista = registros ?? q.data?.items ?? [];
    const restantes = enviado ? lista.filter((r) => r.id_sesion !== enviado.id_sesion).length : 0;

    const alRegistrar = (j, meta) => {
        setEnviado({ ...j, id_sesion: meta?.idSesion ?? j?.id_sesion });
        setInicial(null); // la sesión del enlace «Justificar» ya se usó: no se vuelve a preseleccionar
        onRegistrado?.(j);
    };
    const otra = () => {
        setEnviado(null);
        tituloRef.current?.focus({ preventScroll: true });
    };

    return (
        <section aria-labelledby="t-reg-just" className="rounded-xl border border-border bg-card p-5">
            <h3 id="t-reg-just" ref={tituloRef} tabIndex={-1} className="text-base font-semibold tracking-tight outline-none">
                Registrar justificante
            </h3>
            <div className="mt-3">
                {enviado ? (
                    <JustificanteEnviado restantes={restantes} onOtra={otra} />
                ) : registros ? (
                    <FormularioJustificante registros={registros} idSesionInicial={inicial} onRegistrado={alRegistrar} />
                ) : (
                    <DataState loading={q.loading} error={q.error} data={q.data} onRetry={q.refetch}
                        isEmpty={(d) => !(d.items || []).length}
                        empty={<p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FileCheck2 aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
                            No tienes faltas ni retardos por justificar.
                        </p>}>
                        {(d) => (
                            <FormularioJustificante
                                registros={d.items}
                                idSesionInicial={inicial}
                                onNoJustificable={q.refetch}
                                onRegistrado={(j, meta) => { q.refetch(); alRegistrar(j, meta); }}
                            />
                        )}
                    </DataState>
                )}
            </div>
        </section>
    );
}
