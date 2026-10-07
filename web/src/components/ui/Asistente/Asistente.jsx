'use client';

import clsx from 'clsx';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useCambiosSinGuardar } from '@/hooks/ui/useCambiosSinGuardar.js';
import { useCierreContenedor } from '@/hooks/ui/useCierreContenedor.js';
import Alert from '../Alert/Alert.jsx';
import Button from '../Button/Button.jsx';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx';
import FormActions from '../FormActions/FormActions.jsx';
import Stepper from '../Stepper/Stepper.jsx';
import SuccessState from '../SuccessState/SuccessState.jsx';
import { ID_REVISION, normalizarSecciones, pasosParaStepper, resultadoDeValidacion } from './asistente.utils.js';
import { Revision, ResumenLateral } from './RevisionPaso.jsx';

// Cascarón de asistente de N pasos para altas con dependencias o más de ~6 campos (grupo, alumno, justificante). Referencias de Mobbin:
// pasos con palomitas y revisión editable de Stripe, «Paso N de M» con resumen vivo de Zillow, pie con Atrás/Siguiente de Klaviyo y el
// cierre con siguientes pasos. NO guarda el estado de los campos: eso lo hace `useFormulario` en la pantalla (el asistente solo recibe
// `valores`), y al final se llama a la MISMA RPC de siempre con `onFinalizar`.
//
//   pasos            [{ id, titulo, descripcion?, contenido, opcional?, etiquetaSiguiente? }]. `contenido` es un nodo o una función
//                    `({ irAPaso, indice, total }) => nodo`. No metas un <form> dentro: el asistente ya envuelve cada paso en uno
//                    (Enter avanza al siguiente paso).
//   valores          los valores actuales (para el resumen y para `onFinalizar`).
//   validarPaso(id)  se llama al pulsar «Siguiente»: true/undefined = bien; false, un texto o { campo: 'mensaje' } = mal (el asistente se
//                    queda en el paso, enfoca el primer campo con aria-invalid y muestra un resumen de errores). Con useFormulario:
//                    `(id) => f.validarCampos(CAMPOS[id]) || f.erroresDe(CAMPOS[id])`. El botón NUNCA se apaga por datos inválidos.
//   resumen(valores) => [{ id?, titulo, paso?, filas: [{ etiqueta, valor }] }]  Si se da, hay un paso final de revisión con una tarjeta por
//                    sección; `paso` es el id al que vuelve su «Editar». Sin `resumen` no hay revisión y el último paso ya crea.
//   onFinalizar(valores) => Promise  Si lanza, se muestra el error y se conserva todo lo capturado.
//   exito            props de SuccessState (o `(resultado) => props`, con lo que devolvió onFinalizar) para el paso de éxito.
//   etiquetaFinalizar  verbo + objeto: «Crear grupo». sucio  hay cambios sin guardar (beforeunload y confirmación al cancelar).
//   resumenLateral   resumen vivo a la derecha en pantallas anchas (solo en páginas; dentro de un panel o modal déjalo apagado).
//   onCancelar       muestra «Cancelar» en el primer paso. Dentro de Modal/PanelLateral usa el cierre del contenedor (respeta su `dirty`).
//   ref              manejador imperativo para saltar de paso DESDE FUERA (p. ej. volver al paso del dato duplicado cuando `onFinalizar` falla):
//                    `ref.current.irAPaso(id)` -> true si fue (id de un paso, o 'revision' para el paso final); false si el id no existe o el
//                    asistente ya terminó. No valida: es una decisión de quien llama. El `contenido` de un paso también recibe `irAPaso`.
// Al cambiar de paso el foco va al título y un texto aria-live dice «Paso N de M».
export default function Asistente({
    pasos,
    valores,
    validarPaso,
    onFinalizar,
    resumen,
    exito,
    etiquetaFinalizar = 'Guardar',
    sucio = false,
    resumenLateral = false,
    onCancelar,
    tituloRevision = 'Revisión',
    descripcionRevision = 'Comprueba los datos antes de continuar. Con «Editar» vuelves al paso para corregir cualquier sección.',
    label = 'Asistente',
    sticky,
    className,
    ref,
}) {
    const { enContenedor, cerrar } = useCierreContenedor();
    const conRevision = typeof resumen === 'function';
    const total = pasos.length;
    const totalVisibles = total + (conRevision ? 1 : 0);

    const [indice, setIndice] = useState(0);
    const [maxAlcanzado, setMaxAlcanzado] = useState(0);
    const [omitidos, setOmitidos] = useState(() => new Set());
    const [errores, setErrores] = useState(null);
    const [intento, setIntento] = useState(0);
    const [finalizando, setFinalizando] = useState(false);
    const [errorFinal, setErrorFinal] = useState(null);
    const [hecho, setHecho] = useState(null);
    const [saliendo, setSaliendo] = useState(false);

    const tituloRef = useRef(null);
    const cuerpoRef = useRef(null);
    const alertaRef = useRef(null);
    const previo = useRef(indice);
    const finalizandoRef = useRef(false);
    const montado = useRef(true);

    useCambiosSinGuardar(Boolean(sucio) && !hecho);

    useEffect(() => {
        montado.current = true;
        return () => {
            montado.current = false;
        };
    }, []);

    // Al cambiar de paso el foco pasa al título (no al montar: la página no debe robar el foco al abrirse).
    useEffect(() => {
        if (previo.current === indice) return;
        previo.current = indice;
        tituloRef.current?.focus();
    }, [indice]);

    // Tras un intento fallido: al primer campo inválido del paso o, si no hay, al resumen de errores.
    useEffect(() => {
        if (intento === 0) return;
        const campo = cuerpoRef.current?.querySelector('[aria-invalid="true"]');
        (campo ?? alertaRef.current)?.focus();
    }, [intento]);

    const esRevision = conRevision && indice === total;
    const paso = esRevision ? null : pasos[indice];
    const esUltimo = indice === totalVisibles - 1;
    const esFinal = esRevision || (!conRevision && esUltimo);
    const deVueltaARevision = conRevision && maxAlcanzado >= total && !esRevision;
    const secciones = useMemo(() => (conRevision ? normalizarSecciones(resumen(valores)) : []), [conRevision, resumen, valores]);

    const irA = (i) => {
        const destino = Math.min(Math.max(i, 0), totalVisibles - 1);
        setIndice(destino);
        setMaxAlcanzado((m) => Math.max(m, destino));
        setErrores(null);
        setErrorFinal(null);
    };

    const fallar = (mensajes) => {
        setErrores({ mensajes });
        setIntento((n) => n + 1);
    };

    const validarPasoActual = () => {
        if (!paso) return true;
        const r = resultadoDeValidacion(validarPaso?.(paso.id));
        if (!r.ok) fallar(r.mensajes);
        return r.ok;
    };

    const finalizar = async (omitidosAhora = omitidos) => {
        if (finalizandoRef.current) return;
        // Se revalida todo por si se editó un paso anterior desde la revisión.
        for (let i = 0; i < total; i += 1) {
            if (omitidosAhora.has(pasos[i].id)) continue;
            const r = resultadoDeValidacion(validarPaso?.(pasos[i].id));
            if (!r.ok) {
                irA(i);
                fallar(r.mensajes);
                return;
            }
        }
        finalizandoRef.current = true;
        setFinalizando(true);
        setErrorFinal(null);
        try {
            const resultado = await onFinalizar?.(valores);
            if (montado.current) setHecho({ resultado });
        } catch (error) {
            if (montado.current) setErrorFinal(error ?? new Error());
        } finally {
            finalizandoRef.current = false;
            if (montado.current) setFinalizando(false);
        }
    };

    const quitarOmitido = (id) =>
        setOmitidos((prev) => {
            if (!prev.has(id)) return prev;
            const n = new Set(prev);
            n.delete(id);
            return n;
        });

    const siguiente = () => {
        if (finalizando) return;
        if (esRevision) {
            finalizar();
            return;
        }
        if (!validarPasoActual()) return;
        quitarOmitido(paso.id);
        if (deVueltaARevision) irA(total);
        else if (esUltimo) finalizar();
        else irA(indice + 1);
    };

    const omitir = () => {
        const siguientes = new Set(omitidos).add(paso.id);
        setOmitidos(siguientes);
        if (esUltimo) finalizar(siguientes);
        else irA(deVueltaARevision ? total : indice + 1);
    };

    const atras = () => {
        setErrores(null);
        setErrorFinal(null);
        setIndice((i) => Math.max(0, i - 1));
    };

    const irAPaso = (id) => {
        const i = pasos.findIndex((p) => p.id === id);
        if (i !== -1) irA(i);
    };

    // Salto desde fuera (`ref.current.irAPaso(id)`): también al paso de revisión con 'revision'. Sin lista de dependencias a propósito: el
    // manejador se renueva en cada render para ver siempre los `pasos` y el estado vigentes (es una asignación barata).
    useImperativeHandle(ref, () => ({
        irAPaso: (id) => {
            if (hecho) return false;
            const i = id === ID_REVISION ? (conRevision ? total : -1) : pasos.findIndex((p) => p.id === id);
            if (i === -1) return false;
            irA(i);
            return true;
        },
    }));

    // El Stepper: volver atrás no valida; saltar adelante (solo a pasos ya recorridos) exige que el paso actual esté bien.
    const alSeleccionar = (id) => {
        const j = id === ID_REVISION ? total : pasos.findIndex((p) => p.id === id);
        if (j === -1 || j === indice) return;
        if (j < indice) {
            irA(j);
            return;
        }
        if (j > maxAlcanzado) return;
        if (!validarPasoActual()) return;
        irA(j);
    };

    const puedeCancelar = enContenedor || Boolean(onCancelar);
    const cancelar = () => {
        if (enContenedor) cerrar?.();
        else if (sucio) setSaliendo(true);
        else onCancelar?.();
    };

    if (hecho && exito) {
        const propsExito = typeof exito === 'function' ? exito(hecho.resultado) : exito;
        return <SuccessState className={className} {...propsExito} />;
    }

    const titulo = esRevision ? tituloRevision : paso.titulo;
    const descripcion = esRevision ? descripcionRevision : paso.descripcion;
    const etiquetaPrimaria = esFinal ? etiquetaFinalizar : deVueltaARevision ? 'Volver a la revisión' : (paso.etiquetaSiguiente ?? 'Siguiente');
    const conLateral = resumenLateral && conRevision && !esRevision;
    const idActual = esRevision ? ID_REVISION : paso.id;
    const contenido = esRevision ? <Revision secciones={secciones} onEditar={irAPaso} /> : typeof paso.contenido === 'function' ? paso.contenido({ irAPaso, indice, total }) : paso.contenido;
    const pasosStepper = pasosParaStepper(pasos, conRevision, { indice, maxAlcanzado, omitidos, tituloRevision });

    return (
        <section aria-label={label} className={clsx('flex flex-col gap-6', className)}>
            <Stepper steps={pasosStepper} current={indice} onSelect={alSeleccionar} />
            <p aria-live="polite" className="sr-only">{`Paso ${indice + 1} de ${totalVisibles}: ${titulo}`}</p>

            <div className={clsx(conLateral && 'lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8')}>
                <form
                    noValidate
                    onSubmit={(e) => {
                        e.preventDefault();
                        siguiente();
                    }}
                    className="flex min-w-0 flex-col gap-5"
                >
                    <div key={idActual} className="flex animate-in flex-col gap-4 duration-200 fade-in-0">
                        <header className="flex flex-col gap-1">
                            <h2 ref={tituloRef} tabIndex={-1} className="text-lg font-semibold tracking-tight outline-none">
                                {titulo}
                            </h2>
                            {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
                        </header>
                        {errores && (
                            <div ref={alertaRef} tabIndex={-1} className="outline-none">
                                <Alert tone="danger" compact title="Revisa este paso antes de continuar">
                                    {errores.mensajes.length > 0 ? (
                                        <ul className="list-disc pl-4">
                                            {errores.mensajes.map((m, i) => (
                                                <li key={`${m}-${i}`}>{m}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        'Completa los campos marcados.'
                                    )}
                                </Alert>
                            </div>
                        )}
                        <div ref={cuerpoRef}>{contenido}</div>
                    </div>

                    {errorFinal && (
                        <Alert tone="danger" compact title="No se pudo completar">
                            {errorFinal.message || 'Inténtalo de nuevo.'}
                        </Alert>
                    )}

                    <FormActions sticky={sticky ?? (enContenedor ? 'contenedor' : 'movil')}>
                        {indice === 0 ? (
                            puedeCancelar && (
                                <Button variant="ghost" onClick={cancelar} disabled={finalizando}>
                                    Cancelar
                                </Button>
                            )
                        ) : (
                            <Button variant="ghost" onClick={atras} disabled={finalizando} icon={<ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
                                Atrás
                            </Button>
                        )}
                        {paso?.opcional && (
                            <Button variant="ghost" onClick={omitir} disabled={finalizando}>
                                Omitir por ahora
                            </Button>
                        )}
                        <Button type="submit" loading={finalizando} arrow={!esFinal}>
                            {etiquetaPrimaria}
                        </Button>
                    </FormActions>
                </form>
                {conLateral && <ResumenLateral secciones={secciones} />}
            </div>

            <ConfirmDialog
                open={saliendo}
                title="¿Salir sin guardar?"
                message="Lo que capturaste todavía no se ha guardado y se perderá."
                confirmLabel="Salir"
                cancelLabel="Seguir editando"
                variant="danger"
                onConfirm={() => {
                    setSaliendo(false);
                    onCancelar?.();
                }}
                onCancel={() => setSaliendo(false)}
            />
        </section>
    );
}
