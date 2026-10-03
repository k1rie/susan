'use client';

import { useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import CameraCapture from '@/components/ui/CameraCapture';
import Checkbox from '@/components/ui/Checkbox';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import useMuestreoSesion from './useMuestreoSesion.js';

// Muestreo en el cliente de una sesion automatica abierta y en ventana: camara del navegador (si el docente la
// usa) + camaras IP activas. El reconocimiento y la atribucion de lecturas ocurren en el servidor.
export default function CapturaContinua({ sesion, camaras = [], activo, onFin }) {
    const { toast } = useToast();
    const camarasNavegador = camaras.filter((c) => c.tipo === 'navegador' && c.estatus === 'activa');
    const camarasIp = camaras.filter((c) => c.tipo === 'ip' && c.estatus === 'activa').map((c) => c.id_camara);
    const [idElegido, setIdElegido] = useState(null);
    const [usarNavegador, setUsarNavegador] = useState(true);
    const [camaraLista, setCamaraLista] = useState(false);
    const [errorCamara, setErrorCamara] = useState(null);
    const camaraRef = useRef(null);

    const idNavegador = camarasNavegador.find((c) => c.id_camara === idElegido)?.id_camara ?? camarasNavegador[0]?.id_camara ?? null;
    const navegadorEnUso = usarNavegador && idNavegador != null;

    const muestreo = useMuestreoSesion({
        idSesion: sesion.id_sesion,
        activo,
        intervaloSeg: sesion.intervalo_muestreo_seg,
        camaraNavegadorId: navegadorEnUso && camaraLista ? idNavegador : null,
        camarasIp,
        capturar: () => camaraRef.current.capture(),
        onFin,
        onError: (e) => toast({ tone: 'danger', title: 'Error al enviar la captura', message: `${e.message} Se reintentará en el siguiente ciclo.` }),
    });

    const { ultima } = muestreo;
    const sinFuentes = !navegadorEnUso && camarasIp.length === 0;

    return (
        <section aria-label="Captura continua" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Captura de asistencia</h2>
                <Badge tone={activo ? 'success' : 'neutral'}>{activo ? 'Muestreando' : 'En pausa'}</Badge>
            </div>

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
            {errorCamara && (
                <Alert tone="warning" title="Sin acceso a la cámara del navegador">
                    {errorCamara} Continúa con cámaras IP o registra manualmente.
                    <div className="mt-2">
                        <Checkbox label="Continuar sin la cámara de este dispositivo" checked={!usarNavegador} onChange={(e) => setUsarNavegador(!e.target.checked)} />
                    </div>
                </Alert>
            )}

            {camarasNavegador.length > 0 && (
                <div className="flex flex-col gap-2">
                    <Checkbox label="Usar la cámara de este dispositivo" checked={usarNavegador} onChange={(e) => setUsarNavegador(e.target.checked)} />
                    {usarNavegador && camarasNavegador.length > 1 && (
                        <Select aria-label="Cámara del aula a usar" value={idNavegador ?? ''} onChange={(e) => setIdElegido(Number(e.target.value))} options={camarasNavegador.map((c) => ({ value: c.id_camara, label: `Cámara ${c.posicion}` }))} />
                    )}
                    {usarNavegador && (
                        <div className="max-w-md">
                            <CameraCapture
                                ref={camaraRef}
                                active={activo}
                                showShutter={false}
                                facingMode="environment"
                                allowDeviceSelect
                                onReady={() => {
                                    setCamaraLista(true);
                                    setErrorCamara(null);
                                }}
                                onError={(e) => {
                                    setCamaraLista(false);
                                    setErrorCamara(e?.message ?? 'No se pudo iniciar la cámara.');
                                }}
                            />
                        </div>
                    )}
                </div>
            )}
            {camarasIp.length > 0 && <p className="text-sm text-muted-foreground">Cámaras IP activas: {camarasIp.length}.</p>}
            {sinFuentes && <p className="text-sm text-muted-foreground">Sin fuentes de captura activas.</p>}

            <div aria-live="polite" className="text-sm">
                {!activo ? (
                    <p className="text-muted-foreground">Fuera de la ventana de tolerancia.</p>
                ) : ultima ? (
                    <p>
                        Última: <strong>{ultima.rostros}</strong> rostros · <strong>{ultima.validas}</strong> válidas · <strong>{ultima.cambios?.length ?? 0}</strong> cambios
                        {muestreo.enviando ? ' · enviando…' : ''}
                    </p>
                ) : (
                    <p className="text-muted-foreground">{muestreo.enviando ? 'Enviando la primera captura…' : 'Esperando la primera captura…'}</p>
                )}
            </div>
        </section>
    );
}
