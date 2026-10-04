'use client';

import clsx from 'clsx';
import { CameraOff, ClipboardCheck, UserPen } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import CameraCapture from '@/components/ui/CameraCapture';
import Checkbox from '@/components/ui/Checkbox';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import AccionesPaseLista from '../AccionesPaseLista';
import { enfocarPanel } from '../enfocarPanel.js';
import { cierreHabilitado, motivoCierre } from '../MonitorSesion/monitorSesion.utils.js';
import ResumenPaseLista from '../ResumenPaseLista';
import LienzoSimulado from '../LienzoSimulado';
import SimuladorCamara, { useSimuladorCamara } from '../SimuladorCamara';
import SinAccesoCamara from '../SinAccesoCamara';
import VistaCamara from '../VistaCamara';
import { estadoVista, fuentesDeCaptura, nombreCamara } from './capturaContinua.utils.js';
import useMuestreoSesion from './useMuestreoSesion.js';

// El video de CameraCapture es 4:3 y trae su propio aviso de error. Aquí la vista es 16:9 (la cámara del aula es ancha) y el aviso de error
// lo da SinAccesoCamara, con las salidas: se fuerza el 16:9 sobre su caja (`div.relative`, la única con esa clase) y se oculta su aviso.
const CLASES_CAMARA = '[&>div.relative]:aspect-video [&>[role=alert]]:hidden';
// Con la cámara en error, CameraCapture esconde su caja (hidden) y su aviso: sin esto la vista quedaría en alto 0 y los chips de estado
// (posicionados arriba) flotarían sobre los controles de abajo. Se conserva el marco 16:9 y se pone el motivo dentro.
const MARCO_VISTA = 'aspect-video overflow-hidden rounded-xl bg-foreground';

// Mensaje dentro del marco de la vista cuando no hay imagen que mostrar (sin cámara activa, solo IP o cámara en error).
function SinVista({ texto, className }) {
    return (
        <div className={clsx('flex flex-col items-center justify-center gap-2 p-4 text-center text-primary-foreground', className)}>
            <CameraOff aria-hidden="true" className="size-8 opacity-80" strokeWidth={1.5} />
            <p className="max-w-xs text-sm">{texto}</p>
        </div>
    );
}

// PANEL DE PASE DE LISTA de una sesión automática abierta (P-03): lo primero que ve el docente. Muestrea (cámara del navegador, cámaras IP
// o la cámara simulada del desarrollo local) y junta en un solo lugar la vista de cámara con su estado, la cifra «N de M presentes», la
// última captura y las acciones (cerrar el pase de lista, registrar manualmente). El reconocimiento y la atribución de lecturas ocurren en
// el servidor; aquí solo se toman y envían los fotogramas.
//   sesion, camaras, alumnos, totales = de api_sesion_monitor · activo = la sesión está en ventana de tolerancia (sesion.en_ventana)
//   simulado = api_ahora().reloj_simulado: habilita el simulador de cámara (solo desarrollo; en producción siempre es false)
//   onFin = el servidor dijo «deja de muestrear» · onCerrar / onRegistrarManual = abren los diálogos que vive en MonitorSesion
//   enfocar = se llegó con ?pasar-lista=1: al montarse el panel recibe el foco y, si hace falta, se desplaza hasta verlo
export default function CapturaContinua({ sesion, camaras = [], alumnos = [], totales = {}, activo, simulado = false, onFin, onCerrar, onRegistrarManual, enfocar = false }) {
    const { toast } = useToast();
    const idTitulo = useId();
    const fuentes = fuentesDeCaptura(camaras);
    const camarasIp = fuentes.ip;
    const [idElegido, setIdElegido] = useState(null);
    const [usarNavegador, setUsarNavegador] = useState(true);
    const [camaraLista, setCamaraLista] = useState(false);
    const [errorCamara, setErrorCamara] = useState(null);
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
    const puedeCerrar = cierreHabilitado(sesion);
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
                    className={CLASES_CAMARA}
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

    return (
        <section ref={panelRef} tabIndex={-1} aria-labelledby={idTitulo} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 outline-none focus-visible:ring-4 focus-visible:ring-ring/30 sm:p-5">
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

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6">
                <div className="flex min-w-0 flex-col gap-3 lg:col-span-3">
                    <VistaCamara estado={estado} etiquetaFuente={nombreCamara(camaraElegida)} simulada={simulacionEncendida} enmarcar={enmarcar} className={camaraConError ? MARCO_VISTA : undefined}>
                        {medio}
                    </VistaCamara>
                    {!simulacionEncendida && fuentes.navegador.length > 0 && (
                        <div className="flex flex-col gap-1">
                            {usarNavegador && fuentes.navegador.length > 1 && (
                                <Select aria-label="Cámara del aula a usar" value={idNavegador ?? ''} onChange={(e) => setIdElegido(Number(e.target.value))} options={fuentes.navegador.map((c) => ({ value: c.id_camara, label: nombreCamara(c) }))} />
                            )}
                            <Checkbox label="Usar la cámara de este dispositivo" checked={usarNavegador} onChange={(e) => setUsarNavegador(e.target.checked)} />
                        </div>
                    )}
                    {camarasIp.length > 0 && <p className="text-sm text-muted-foreground">Cámaras IP activas: {camarasIp.length}.</p>}
                    {sinFuentes && <p className="text-sm text-muted-foreground">Sin fuentes de captura activas: registra manualmente a los alumnos.</p>}
                    {muestreo.limitado && <p className="text-sm text-muted-foreground">El servidor pidió espaciar las capturas; se reintenta en el siguiente ciclo.</p>}
                </div>

                <div className="flex min-w-0 flex-col gap-5 lg:col-span-2 lg:justify-between">
                    <ResumenPaseLista totales={totales} ultima={muestreo.ultima} enviando={muestreo.enviando} activo={activo} />
                    <AccionesPaseLista
                        apilado
                        primaria={{ etiqueta: 'Cerrar pase de lista', onClick: onCerrar, disabled: !puedeCerrar, icono: <ClipboardCheck aria-hidden="true" className="size-5" strokeWidth={1.75} /> }}
                        secundarias={[{ etiqueta: 'Registrar manualmente', onClick: onRegistrarManual, icono: <UserPen aria-hidden="true" className="size-5" strokeWidth={1.75} /> }]}
                        nota={puedeCerrar ? 'La tolerancia terminó: ya puedes cerrar. Quien no tenga registro quedará como ausente.' : motivoCierre(sesion)}
                    />
                </div>
            </div>

            <SimuladorCamara simulador={simulador} />
        </section>
    );
}
