'use client';

import clsx from 'clsx';
import { ArrowLeft, ArrowRight, ArrowUp, Camera, CameraOff, Check, RotateCcw, ScanSearch, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import { IS_LOCAL } from '@/config';
import { PASOS_TOMA } from '../CapturaGuiadaPlantilla/capturaGuiada.utils.js';
import { mensajeErrorPlantilla } from '../PlantillaFacialPanel/plantillaFacial.utils.js';
import AnilloRostro from './AnilloRostro.jsx';
import { Cuerpo, Pie } from './Estructura.jsx';
import Fotograma from './Fotograma.jsx';
import PanelPose from './PanelPose.jsx';
import { evaluarPose, RANGOS_POSE, SIGNO } from './registroGuiado.pose.js';
import { estadosDePasos, motivoDeCalidad, siguientePaso, textosDeVista, vistaDePaso } from './registroGuiado.utils.js';

const CAMARA_NO_LISTA = 'La cámara aún no está lista; espera un momento e inténtalo de nuevo.';
// Una comprobación de calidad que tarda más que esto se da por fallida: no debe congelar el muestreo.
const LIMITE_COMPROBACION_MS = 8000;
// El panel de pose (ángulos, latencia, copiar muestras) solo existe en desarrollo local.
const DEPURAR_POSE = IS_LOCAL && process.env.NODE_ENV !== 'production';
const MUESTRAS_MAX = 600;

// Flecha que empuja hacia donde hay que girar. La vista es un espejo: «izquierda» es la izquierda de la persona y de la pantalla.
const FLECHAS = {
    izquierda: { Icono: ArrowLeft, lugar: 'left-2 top-1/2 -translate-y-1/2', empuje: '-8px 0px' },
    derecha: { Icono: ArrowRight, lugar: 'right-2 top-1/2 -translate-y-1/2', empuje: '8px 0px' },
    arriba: { Icono: ArrowUp, lugar: 'top-2 left-1/2 -translate-x-1/2', empuje: '0px -8px' },
};

function FlechaDeGiro({ clave }) {
    const f = FLECHAS[clave];
    if (!f) return null;
    const [x, y] = f.empuje.split(' ');
    return (
        <span aria-hidden="true" className={clsx('pointer-events-none absolute', f.lugar)}>
            <span
                className="flex size-11 items-center justify-center rounded-full bg-foreground/55 text-primary-foreground"
                style={{ '--guia-x': x, '--guia-y': y, animation: 'registro-guia-empuja 1.3s ease-in-out infinite' }}
            >
                <f.Icono className="size-6" strokeWidth={1.75} />
            </span>
        </span>
    );
}

// La foto de cada paso se toma SOLA: con la cámara lista se muestrea un fotograma, se pasa por el control de calidad de una foto y,
// tras `ritmo.aciertos` muestras buenas seguidas (la persona se queda quieta ~1 s), la última se entrega como toma. Mientras no
// pasa, el texto dice el motivo en vivo («Hay poca luz…») y el aro se llena con cada acierto. La toma entregada se verifica contra
// las anteriores (consistencia de identidad) como siempre; si ahí se rechaza, se lee el motivo y se reintenta sola.
// La cámara y su <video> viven en el contenedor: aquí no se desmontan entre pasos para no reiniciar el permiso ni el flujo.
export default function PantallaCaptura({
    p, paso, omitidos, videoRef, capturar, reiniciar, estadoCamara, errorCamara, dispositivos, ritmo, dispositivo, onDispositivo,
    onPasoListo, onOmitir, onIrAArchivo, depuracion = DEPURAR_POSE,
}) {
    const info = PASOS_TOMA[paso];
    const toma = p.tomas.find((t) => t.paso === paso) ?? null;
    const [aciertos, setAciertos] = useState(0); // muestras buenas seguidas de la toma en curso
    const [guia, setGuia] = useState(null); // motivo en vivo de la última muestra rechazada
    const [fallos, setFallos] = useState(0); // intentos sin éxito del paso: al acumularse se ofrece la toma manual
    const [servicioCaido, setServicioCaido] = useState(false);
    const [aviso, setAviso] = useState(null);
    // Depuración de la pose (solo local): control, muestras acumuladas y última medición para el panel.
    const [control, setControl] = useState({ pausa: false, etiqueta: 'libre' });
    const [ultima, setUltima] = useState(null);
    const [totalMuestras, setTotalMuestras] = useState(0);
    const muestras = useRef([]);
    const duraciones = useRef([]);
    // Lo que el muestreo lee en cada ciclo sin reiniciarse cuando cambian las props.
    const actual = useRef({
        capturar, ritmo, agregar: p.agregarToma, verificarUna: p.verificarUna, alListo: onPasoListo, control, depuracion, registrarMuestra: null,
    });

    const errorVerificacion = p.verificacion.error;
    const vista = vistaDePaso({ toma, fallo: Boolean(errorVerificacion) });
    const estados = estadosDePasos({ tomas: p.tomas, omitidos, actual: paso });
    const ultimo = siguientePaso(paso, p.tomas, omitidos) === null;
    const lista = estadoCamara === 'ready';
    const lleno = p.tomas.length >= p.maximo;
    const reteniendo = aciertos > 0;
    const { titulo, detalle } = textosDeVista({
        vista, paso: info, toma, ultimo, guia, reteniendo, detalleFallo: mensajeErrorPlantilla(errorVerificacion),
    });

    const reiniciarMuestreo = () => {
        setAciertos(0);
        setGuia(null);
        setFallos(0);
        setServicioCaido(false);
    };

    // Panel de pose: una fila por comprobación (con la etiqueta que puso quien calibra) y la última medición para mostrarla.
    const registrarMuestra = ({ resultado, pose, eva, ms, motivo, calidadOk }) => {
        duraciones.current = [...duraciones.current.slice(-19), ms];
        muestras.current.push({
            t: Math.round(performance.now()), paso: info.clave, etiqueta: actual.current.control.etiqueta, ms: Math.round(ms),
            rostros: resultado.rostros, calidadOk, motivo, pose, angulos: eva.angulos, enRango: eva.ok,
        });
        if (muestras.current.length > MUESTRAS_MAX) muestras.current.shift();
        const d = duraciones.current;
        setTotalMuestras(muestras.current.length);
        setUltima({
            pose, angulos: eva.angulos, evaluacion: calidadOk && pose ? eva : null, ms, motivo, rostros: resultado.rostros,
            resumen: { n: d.length, promedioMs: d.reduce((a, b) => a + b, 0) / d.length, maxMs: Math.max(...d) },
        });
    };
    const copiarMuestras = async () => {
        const datos = { generado: new Date().toISOString(), signo: SIGNO, rangos: RANGOS_POSE, muestras: muestras.current };
        try {
            await navigator.clipboard.writeText(JSON.stringify(datos));
            return true;
        } catch {
            return false;
        }
    };
    const limpiarMuestras = () => {
        muestras.current = [];
        duraciones.current = [];
        setTotalMuestras(0);
        setUltima(null);
    };

    useEffect(() => {
        actual.current = {
            capturar, ritmo, agregar: p.agregarToma, verificarUna: p.verificarUna, alListo: onPasoListo, control, depuracion, registrarMuestra,
        };
    });

    // Muestreo: solo mientras se busca la foto del paso. Cada ciclo espera a que termine el anterior (no se apilan peticiones).
    const muestreando = vista === 'espera' && lista && !lleno && !errorCamara;
    useEffect(() => {
        if (!muestreando) return undefined;
        let cancelado = false;
        let temporizador;
        const control = new AbortController();
        let buenas = 0;
        let malas = 0;

        const ciclo = async () => {
            const { capturar: tomar, ritmo: r, agregar, verificarUna } = actual.current;
            let blob = null;
            try {
                ({ blob } = await tomar());
            } catch {
                // El fotograma aún no está listo: se reintenta en el siguiente ciclo, sin ruido.
            }
            if (cancelado) return;
            if (blob) {
                let resultado = null;
                const limite = setTimeout(() => control.abort(), LIMITE_COMPROBACION_MS);
                const inicio = performance.now();
                try {
                    resultado = await verificarUna(blob, { signal: control.signal });
                } catch {
                    resultado = null;
                } finally {
                    clearTimeout(limite);
                }
                const ms = performance.now() - inicio;
                if (cancelado) return;
                if (resultado === null) {
                    buenas = 0;
                    malas += 1;
                    setServicioCaido(true);
                    setAciertos(0);
                    setFallos(malas);
                } else {
                    const calidadOk = resultado.un_solo_rostro === true && (resultado.motivo_rechazo ?? null) === null;
                    // La pose se exige solo si el servicio la manda (embedder real); sin ella solo cuenta la calidad.
                    const pose = resultado.calidad?.pose ?? null;
                    const eva = calidadOk ? evaluarPose(info.clave, pose) : { ok: false, guia: null, angulos: null };
                    const motivoCalidad = calidadOk ? null : motivoDeCalidad({ codigo: resultado.motivo_codigo, frase: resultado.motivo_rechazo, clavePaso: info.clave });
                    if (actual.current.depuracion) actual.current.registrarMuestra({ resultado, pose, eva: calidadOk ? eva : evaluarPose(info.clave, pose), ms, motivo: motivoCalidad, calidadOk });
                    setServicioCaido(false);
                    if (calidadOk && eva.ok) {
                        buenas += 1;
                        setGuia(null);
                        setAciertos(buenas);
                        if (buenas >= r.aciertos && !actual.current.control.pausa) {
                            // La foto buena se entrega como toma; el muestreo se detiene solo porque el paso ya tiene toma.
                            setAciertos(0);
                            setFallos(0);
                            agregar(blob, 'camara', { paso });
                            return;
                        }
                    } else {
                        buenas = 0;
                        malas += 1;
                        setAciertos(0);
                        setFallos(malas);
                        setGuia(motivoCalidad ?? eva.guia);
                    }
                }
            }
            temporizador = setTimeout(ciclo, r.intervalo);
        };

        temporizador = setTimeout(ciclo, paso === 0 ? actual.current.ritmo.esperaPrimero : actual.current.ritmo.esperaPaso);
        return () => {
            cancelado = true;
            clearTimeout(temporizador);
            control.abort();
        };
    }, [muestreando, paso, info.clave]);

    // Una toma aceptada se deja ver un instante y se pasa a la siguiente.
    const idAceptada = vista === 'aceptada' ? (toma?.id ?? null) : null;
    useEffect(() => {
        if (idAceptada === null) return undefined;
        const espera = setTimeout(() => actual.current.alListo(), ritmo.demoraAceptada);
        return () => clearTimeout(espera);
    }, [idAceptada, ritmo.demoraAceptada]);

    // `?.` no es decorativo: el compilador de React lee las dependencias del cierre al renderizar y, sin toma, `toma.id` reventaba.
    const repetir = () => {
        const id = toma?.id;
        setAviso(null);
        reiniciarMuestreo();
        if (id != null) p.repetirToma(id);
    };

    // Una toma rechazada tras el control de conjunto (otra persona, casi igual a otra…) se lee y se reintenta sola.
    const idRechazada = vista === 'rechazada' ? (toma?.id ?? null) : null;
    const alRechazar = useRef(repetir);
    useEffect(() => {
        alRechazar.current = repetir;
    });
    useEffect(() => {
        if (idRechazada === null) return undefined;
        const espera = setTimeout(() => alRechazar.current(), ritmo.demoraRechazo);
        return () => clearTimeout(espera);
    }, [idRechazada, ritmo.demoraRechazo]);

    // Respaldo manual: sin él, un servicio de calidad caído o una luz imposible dejarían a la persona sin salida.
    const disparar = async () => {
        try {
            const { blob } = await capturar();
            setAviso(null);
            reiniciarMuestreo();
            p.agregarToma(blob, 'camara', { paso });
        } catch {
            // capture() lanza si el fotograma aún no está listo.
            setAviso(CAMARA_NO_LISTA);
        }
    };
    const ofrecerManual = lista && (servicioCaido || fallos >= ritmo.manualTrasFallos);

    const opcional = info.opcional;
    const omitir = opcional && (vista === 'espera' || vista === 'rechazada') && !errorCamara;
    const conGuia = vista === 'espera' && guia !== null && !reteniendo;

    return (
        <>
            <Cuerpo>
                <div className="flex flex-col items-center gap-5 py-1">
                    <AnilloRostro clave={info.clave} estado={estados[paso]} progreso={aciertos / ritmo.aciertos}>
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            autoPlay
                            aria-label="Vista previa de la cámara"
                            className={clsx('size-full -scale-x-100 object-cover', (toma || errorCamara) && 'invisible')}
                        />
                        {toma && (
                            <div className="absolute inset-0">
                                <Fotograma key={toma.id} blob={toma.blob} espejo alt={`Toma ${paso + 1}: ${info.titulo}`} />
                            </div>
                        )}
                        {estadoCamara === 'starting' && (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                <Spinner size="lg" label="Iniciando cámara" />
                            </div>
                        )}
                        {errorCamara && (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                <CameraOff aria-hidden="true" className="size-1/4" strokeWidth={1.25} />
                            </div>
                        )}
                        {vista === 'espera' && lista && <FlechaDeGiro clave={info.clave} />}
                        {vista === 'verificando' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-foreground/45 text-primary-foreground">
                                <Spinner size="lg" label="Verificando la toma" />
                            </div>
                        )}
                        {vista === 'aceptada' && (
                            <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-foreground/35">
                                <span className="flex size-16 animate-in items-center justify-center rounded-full bg-presente text-primary-foreground duration-300 fade-in-0 zoom-in-50">
                                    <Check className="size-9" strokeWidth={2} />
                                </span>
                            </div>
                        )}
                        {(vista === 'rechazada' || vista === 'fallo') && (
                            <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-foreground/45">
                                <span className="flex size-16 animate-in items-center justify-center rounded-full bg-retardo text-primary-foreground duration-300 fade-in-0 zoom-in-50">
                                    <TriangleAlert className="size-8" strokeWidth={1.75} />
                                </span>
                            </div>
                        )}
                    </AnilloRostro>

                    <div aria-live="polite" aria-atomic="true" className="flex min-h-[4.5rem] flex-col items-center gap-1.5 text-center">
                        {errorCamara ? (
                            <>
                                <h2 className="text-xl font-semibold tracking-tight">No pudimos abrir la cámara</h2>
                                <p className="max-w-sm text-sm text-muted-foreground">{errorCamara.message}</p>
                            </>
                        ) : (
                            <>
                                <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                                    {vista === 'espera' && <info.Icono aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />}
                                    {titulo}
                                </h2>
                                <p className={clsx('max-w-sm text-sm', conGuia ? 'font-medium text-retardo' : 'text-muted-foreground')}>{detalle}</p>
                            </>
                        )}
                    </div>

                    {aviso && (
                        <p role="alert" className="text-sm text-destructive">
                            {aviso}
                        </p>
                    )}
                    {depuracion && !errorCamara && (
                        <PanelPose
                            clave={info.clave}
                            ultima={ultima}
                            resumen={ultima?.resumen}
                            control={control}
                            onControl={(parcial) => setControl((c) => ({ ...c, ...parcial }))}
                            onCopiar={copiarMuestras}
                            onLimpiar={limpiarMuestras}
                            total={totalMuestras}
                        />
                    )}
                    {!errorCamara && dispositivos.length > 1 && vista === 'espera' && (
                        <Select
                            aria-label="Cámara"
                            className="max-w-xs"
                            value={dispositivo ?? dispositivos[0].deviceId}
                            onChange={(e) => onDispositivo(e.target.value)}
                            options={dispositivos.map((d, i) => ({ value: d.deviceId, label: d.label || `Cámara ${i + 1}` }))}
                        />
                    )}
                </div>
            </Cuerpo>
            <Pie>
                {errorCamara ? (
                    <>
                        <Button size="lg" fullWidth onClick={reiniciar}>
                            Reintentar
                        </Button>
                        {onIrAArchivo && (
                            <Button variant="secondary" fullWidth onClick={onIrAArchivo}>
                                Subir fotos en lugar de usar la cámara
                            </Button>
                        )}
                    </>
                ) : (
                    <>
                        {vista === 'rechazada' ? (
                            <Button size="lg" fullWidth onClick={repetir} icon={<RotateCcw aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
                                Intentar de nuevo
                            </Button>
                        ) : vista === 'fallo' ? (
                            <Button size="lg" fullWidth onClick={p.verificacion.reintentar} icon={<RotateCcw aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
                                Reintentar verificación
                            </Button>
                        ) : vista === 'verificando' ? (
                            <Button size="lg" fullWidth disabled>
                                Verificando…
                            </Button>
                        ) : vista === 'aceptada' ? (
                            <Button size="lg" fullWidth disabled icon={<Check aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
                                Toma aceptada
                            </Button>
                        ) : ofrecerManual ? (
                            <>
                                {servicioCaido && (
                                    <p role="status" className="text-center text-sm text-muted-foreground">
                                        No se pudo comprobar la calidad en vivo. Puedes tomar la foto tú.
                                    </p>
                                )}
                                <Button size="lg" fullWidth onClick={disparar} icon={<Camera aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
                                    Tomar foto ahora
                                </Button>
                            </>
                        ) : (
                            <p role="status" className="flex min-h-12 items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                                <ScanSearch aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                                {lista ? 'La foto se toma sola cuando todo esté bien.' : 'Esperando la cámara…'}
                            </p>
                        )}
                        {omitir && (
                            <Button variant="ghost" fullWidth onClick={onOmitir}>
                                Omitir esta toma (opcional)
                            </Button>
                        )}
                    </>
                )}
            </Pie>
        </>
    );
}
