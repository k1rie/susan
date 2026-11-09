'use client';

import clsx from 'clsx';
import { CameraOff, ListChecks, UserPen } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import CameraCapture from '@/components/ui/CameraCapture';
import Checkbox from '@/components/ui/Checkbox';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import AccionesPaseLista from '../AccionesPaseLista';
import { enfocarPanel } from '../enfocarPanel.js';
import ResumenPaseLista from '../ResumenPaseLista';
import LienzoSimulado from '../LienzoSimulado';
import SimuladorCamara, { useSimuladorCamara } from '../SimuladorCamara';
import SinAccesoCamara from '../SinAccesoCamara';
import VistaCamara from '../VistaCamara';
import { estadoVista, fuentesDeCaptura, nombreCamara } from './capturaContinua.utils.js';
import useMuestreoSesion from './useMuestreoSesion.js';

// La vista es 16:9 (la cámara del aula es ancha). CameraCapture recibe la caja 16:9 por `claseVista` y su aviso de error se oculta: lo da
// SinAccesoCamara, con las salidas.
const CLASE_CAMARA = '[&>[role=alert]]:hidden';
// Con la cámara en error, CameraCapture esconde su caja (hidden) y su aviso: sin esto la vista quedaría en alto 0 y los chips de estado
// (posicionados arriba) flotarían sobre los controles de abajo. Se conserva el marco 16:9 y se pone el motivo dentro.
const MARCO_VISTA = 'aspect-video overflow-hidden rounded-xl bg-foreground';
// Desde `md` la cámara es lo que más se ve. La fila (cámara | cifra y acciones) es un contenedor de ancho y el escenario de la cámara mide
//   alto = mín(alto disponible del viewport, (ancho de la fila - columna derecha) * 9/16 + barra)
// es decir, el mayor 16:9 que cabe sin recortar la imagen, sin scroll de la página y sin dejar blanco bajo el video. El escenario es a su
// vez contenedor de tamaño: la vista + su barra miden ancho = mín(ancho, (alto - barra) * 16/9) y se centran (pantallas muy anchas).
// 17.25rem = columna derecha (w-64) + separación (gap-5). 3.5rem = barra de controles bajo el video (casilla de 44 px + separación).
// Alto disponible: en el modo automático (llenarAlto) el viewport menos su encabezado (~10rem); en la pantalla de la sesión, menos el
// encabezado de la página y la franja de pasos (~21rem); con un mínimo para ventanas bajas. Las clases van completas (Tailwind no ve
// clases armadas en tiempo de ejecución); `_` = espacio dentro de calc().
const ALTO_ESCENARIO = {
    pagina: {
        barra: 'md:h-[min(max(24rem,calc(100dvh_-_21rem)),calc((100cqw_-_17.25rem)*9/16_+_3.5rem))]',
        sola: 'md:h-[min(max(24rem,calc(100dvh_-_21rem)),calc((100cqw_-_17.25rem)*9/16))]',
    },
    llenar: {
        barra: 'md:h-[min(max(20rem,calc(100dvh_-_10rem)),calc((100cqw_-_17.25rem)*9/16_+_3.5rem))]',
        sola: 'md:h-[min(max(20rem,calc(100dvh_-_10rem)),calc((100cqw_-_17.25rem)*9/16))]',
    },
};
const ESCENARIO = 'md:flex md:min-w-0 md:flex-1 md:flex-col md:items-center md:[container-type:size]';
const ENCUADRE = {
    barra: 'flex w-full flex-col gap-2 md:w-[min(100cqw,calc((100cqh_-_3.5rem)*16/9))]',
    sola: 'flex w-full flex-col gap-2 md:w-[min(100cqw,calc(100cqh*16/9))]',
};

// Mensaje dentro del marco de la vista cuando no hay imagen que mostrar (sin cámara activa, solo IP o cámara en error).
function SinVista({ texto, className }) {
    return (
        <div className={clsx('flex flex-col items-center justify-center gap-2 p-4 text-center text-primary-foreground', className)}>
            <CameraOff aria-hidden="true" className="size-8 opacity-80" strokeWidth={1.5} />
            <p className="max-w-xs text-sm">{texto}</p>
        </div>
    );
}

// PANEL DE PASE DE LISTA de una sesión automática abierta (P-03), paso 2 «Pasar lista»: lo primero que ve el docente. Muestrea (cámara del
// navegador, cámaras IP o la cámara simulada del desarrollo local) y junta en un solo lugar la vista de cámara con su estado, la cifra
// «N de M presentes», la última captura y las acciones: «Revisar y cerrar» (pasa al paso 3, no cierra nada) y registrar manualmente. El
// cierre en sí vive en RevisionCierre. El reconocimiento y la atribución de lecturas ocurren en el servidor; aquí solo se toman y envían
// los fotogramas.
//   sesion, camaras, alumnos, totales = de api_sesion_monitor · activo = la sesión está en ventana de tolerancia (sesion.en_ventana)
//   simulado = api_ahora().reloj_simulado: habilita el simulador de cámara (solo desarrollo; en producción siempre es false)
//   onFin = el servidor dijo «deja de muestrear» · onRevisar = pasa a la revisión · onRegistrarManual = abre el diálogo que vive en MonitorSesion
//   enfocar = se llegó con ?pasar-lista=1: al montarse el panel recibe el foco y, si hace falta, se desplaza hasta verlo
//   llenarAlto = la pantalla es solo este panel (modo automático, a pantalla completa): desde `md` la cámara toma casi todo el alto del
//                viewport; sin él se descuenta el encabezado y la franja de pasos de la sesión (ALTO_ESCENARIO)
export default function CapturaContinua({ sesion, camaras = [], alumnos = [], totales = {}, activo, simulado = false, onFin, onRevisar, onRegistrarManual, enfocar = false, llenarAlto = false }) {
    const { toast } = useToast();
    const idTitulo = useId();
    const fuentes = fuentesDeCaptura(camaras);
    const camarasIp = fuentes.ip;
    const [idElegido, setIdElegido] = useState(null);
    const [usarNavegador, setUsarNavegador] = useState(true);
    const [camaraLista, setCamaraLista] = useState(false);
    const [errorCamara, setErrorCamara] = useState(null);
    // Detector de rostros del navegador sobre la vista: recuadros en cada cara y el recuento en un chip. Solo retroalimentación para el
    // grupo (que vean que la cámara los encuentra); lo que cuenta para la asistencia sigue siendo el reconocimiento del servidor.
    const [deteccion, setDeteccion] = useState(null);
    const camaraRef = useRef(null);
    const panelRef = useRef(null);

    const camaraElegida = fuentes.navegador.find((c) => c.id_camara === idElegido) ?? fuentes.navegador[0] ?? null;
    const idNavegador = camaraElegida?.id_camara ?? null;

    // Cámara simulada: reemplaza a la real mientras está encendida (la real se apaga, no se pide su permiso).
    const simulador = useSimuladorCamara({ habilitado: simulado, camaraDisponible: idNavegador != null, sesion, alumnos });
    const simulacionEncendida = simulador.habilitado && simulador.camaraDisponible && simulador.encendido;
    const simulando = simulador.activo;
    const navegadorEnUso = usarNavegador && idNavegador != null && !simulacionEncendida;
    const camaraConError = navegadorEnUso && errorCamara != null;

    const muestreo = useMuestreoSesion({
        idSesion: sesion.id_sesion,
        activo,
        // Con la simulación el ritmo es el mínimo que el limitador del servidor admite (ver intervaloDemoSeg): 5 s recibiría 429.
        intervaloSeg: simulando ? simulador.intervaloSeg : sesion.intervalo_muestreo_seg,
        camaraNavegadorId: simulando ? idNavegador : navegadorEnUso && camaraLista ? idNavegador : null,
        camarasIp,
        capturar: () => (simulando ? simulador.capturar() : camaraRef.current?.capture()),
        onFin,
        onError: (e) => toast({ tone: 'danger', title: 'Error al enviar la captura', message: `${e.message} Se reintentará en el siguiente ciclo.` }),
    });

    // Llegar con ?pasar-lista=1: el panel recibe el foco (los lectores de pantalla aterrizan en él) y solo se desplaza si no se ve.
    useEffect(() => {
        if (enfocar) enfocarPanel(panelRef.current);
    }, [enfocar]);

    const fuenteLista = simulando || (navegadorEnUso && camaraLista) || camarasIp.length > 0;
    const estado = estadoVista({
        activo,
        fuenteLista,
        detenido: muestreo.detenido,
        problemaReloj: muestreo.problemaReloj,
        servicioNoDisponible: muestreo.servicioNoDisponible,
        simulacionTerminada: simulando && simulador.terminado && camarasIp.length === 0,
    });
    const sinFuentes = !navegadorEnUso && !simulacionEncendida && camarasIp.length === 0;

    let medio;
    let enmarcar = true;
    if (simulacionEncendida) {
        // El lienzo es la vista previa Y lo que se envía: así se ven los rostros que reconoce el servidor.
        medio = <LienzoSimulado alMontar={simulador.ponerLienzo} descripcion={simulador.descripcion} />;
    } else if (navegadorEnUso) {
        enmarcar = false;
        medio = (
            <>
                <CameraCapture
                    ref={camaraRef}
                    active={activo}
                    showShutter={false}
                    facingMode="environment"
                    allowDeviceSelect
                    selectorSuperpuesto
                    claseVista="aspect-video"
                    detectarRostros
                    onDeteccion={setDeteccion}
                    className={CLASE_CAMARA}
                    onReady={() => {
                        setCamaraLista(true);
                        setErrorCamara(null);
                    }}
                    onError={(e) => {
                        setCamaraLista(false);
                        setErrorCamara(e?.message ?? 'No se pudo iniciar la cámara.');
                    }}
                />
                {camaraConError && <SinVista texto="Sin imagen: la cámara no está disponible." className="absolute inset-0" />}
            </>
        );
    } else {
        medio = <SinVista texto={camarasIp.length > 0 ? 'Sin vista previa: se toman fotogramas de las cámaras IP del aula.' : 'No hay una cámara activa en este dispositivo.'} className="size-full" />;
    }

    const controles = [];
    if (!simulacionEncendida && fuentes.navegador.length > 0) {
        controles.push(<Checkbox key="usar" label="Usar la cámara de este dispositivo" checked={usarNavegador} onChange={(e) => setUsarNavegador(e.target.checked)} />);
        if (usarNavegador && fuentes.navegador.length > 1) {
            controles.push(
                <Select
                    key="aula"
                    aria-label="Cámara del aula a usar"
                    className="w-auto max-w-full sm:max-w-64"
                    value={idNavegador ?? ''}
                    onChange={(e) => setIdElegido(Number(e.target.value))}
                    options={fuentes.navegador.map((c) => ({ value: c.id_camara, label: nombreCamara(c) }))}
                />,
            );
        }
    }
    const notas = [
        camarasIp.length > 0 && `Cámaras IP activas: ${camarasIp.length}.`,
        sinFuentes && 'Sin fuentes de captura activas: registra manualmente a los alumnos.',
        muestreo.limitado && 'El servidor pidió espaciar las capturas; se reintenta en el siguiente ciclo.',
    ].filter(Boolean);
    const hayBarra = controles.length > 0 || notas.length > 0;

    return (
        <section
            ref={panelRef}
            tabIndex={-1}
            aria-labelledby={idTitulo}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 outline-none focus-visible:ring-4 focus-visible:ring-ring/30 sm:p-4"
        >
            <h2 id={idTitulo} className="sr-only">
                Pase de lista con cámara
            </h2>

            {muestreo.problemaReloj && (
                <Alert tone="warning" title="La hora de la captura no es válida">
                    <p>{muestreo.problemaReloj.message}</p>
                    <p className="mt-1">{simulado ? 'Con el reloj de demostración: usa Restablecer o Correr en su tarjeta, y reintenta.' : 'Revisa que la hora del servidor sea la del plantel y reintenta.'}</p>
                    <Button variant="secondary" onClick={muestreo.reanudar} className="mt-3 w-full sm:w-auto">
                        Reintentar
                    </Button>
                </Alert>
            )}
            {muestreo.servicioNoDisponible && (
                <Alert tone="warning" title="Reconocimiento no disponible">
                    Registra manualmente a quien falte. Se reintentará en cada ciclo.
                </Alert>
            )}
            {muestreo.detenido && (
                <Alert tone="info" title="Muestreo detenido">
                    La sesión ya no admite capturas ({muestreo.detenido}).
                </Alert>
            )}
            {simulado && muestreo.repetidas >= 2 && !muestreo.problemaReloj && (
                <Alert tone="warning" title="Las capturas no suman">
                    <p>El servidor ya tenía estas capturas: el reloj de demostración está detenido y todas llevan la misma hora.</p>
                    <Button variant="secondary" onClick={simulador.ponerRelojEnMarcha} className="mt-3 w-full sm:w-auto">
                        Poner en marcha el reloj
                    </Button>
                </Alert>
            )}
            {errorCamara && navegadorEnUso && (
                <SinAccesoCamara
                    mensaje={errorCamara}
                    onReintentar={() => {
                        setErrorCamara(null);
                        camaraRef.current?.restart();
                    }}
                    camarasIp={camarasIp.length}
                    onSoloIp={() => setUsarNavegador(false)}
                    onManual={onRegistrarManual}
                    onSimulada={simulado && simulador.camaraDisponible ? simulador.encender : undefined}
                />
            )}

            {/* Desde `md` (tableta horizontal y escritorio): cámara a la izquierda con todo el alto; a la derecha, la cifra y las acciones en una columna angosta. Teléfono: la
                cámara primero a todo el ancho, debajo la cifra y las acciones (a la vista sin desplazarse en 360 x 740). */}
            <div className="flex flex-col gap-4 md:flex-row md:gap-5 md:[container-type:inline-size]">
                <div className={clsx('min-w-0', ESCENARIO, ALTO_ESCENARIO[llenarAlto ? 'llenar' : 'pagina'][hayBarra ? 'barra' : 'sola'])}>
                    <div className={ENCUADRE[hayBarra ? 'barra' : 'sola']}>
                        <VistaCamara
                            estado={estado}
                            etiquetaFuente={nombreCamara(camaraElegida)}
                            simulada={simulacionEncendida}
                            enmarcar={enmarcar}
                            rostros={navegadorEnUso && !camaraConError && deteccion?.estado === 'listo' ? deteccion.cantidad : null}
                            className={camaraConError ? MARCO_VISTA : undefined}
                        >
                            {medio}
                        </VistaCamara>
                        {hayBarra && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                {controles}
                                {notas.map((n) => (
                                    <p key={n} className="text-sm text-muted-foreground">
                                        {n}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-4 md:w-64 md:shrink-0 md:justify-between md:overflow-y-auto">
                    <ResumenPaseLista totales={totales} ultima={muestreo.ultima} enviando={muestreo.enviando} activo={activo} />
                    <AccionesPaseLista
                        apilado
                        primaria={{ etiqueta: 'Revisar y cerrar', onClick: onRevisar, icono: <ListChecks aria-hidden="true" className="size-5" strokeWidth={1.75} /> }}
                        secundarias={[{ etiqueta: 'Registrar manualmente', onClick: onRegistrarManual, icono: <UserPen aria-hidden="true" className="size-5" strokeWidth={1.75} /> }]}
                    />
                </div>
            </div>

            <SimuladorCamara simulador={simulador} />
        </section>
    );
}
