'use client';

import clsx from 'clsx';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import Alert from '../Alert/Alert.jsx';
import Button from '../Button/Button.jsx';
import Select from '../Select/Select.jsx';
import Spinner from '../Spinner/Spinner.jsx';
import { periodoCaptura } from './cameraCapture.utils.js';
import useCameraCapture from './useCameraCapture.js';

// Captura de cámara: vista previa, foto única (botón o ref.capture()) y captura continua opcional.
// En continuo se invoca onFrame (o, si no existe, onCapture) y el siguiente disparo espera a que
// termine la promesa anterior, para no acumular trabajo (RNF-01).
export default function CameraCapture({
    onCapture,
    onFrame,
    facingMode = 'user',
    mirrored,
    intervalMs,
    active = true,
    ovalGuide = false,
    showShutter,
    quality = 0.9,
    maxWidth = 1280,
    maxHeight = 960,
    allowDeviceSelect = true,
    deviceId,
    onDeviceChange,
    onReady,
    onError,
    ref,
    className,
}) {
    const [deviceInterno, setDeviceInterno] = useState(undefined);
    const dispositivoActivo = deviceId ?? deviceInterno;
    const continuo = intervalMs != null;
    const espejo = mirrored ?? facingMode === 'user';
    const mostrarObturador = showShutter ?? !continuo;

    const { videoRef, capture, restart, estado, error: errorCamara, dispositivos } = useCameraCapture({ active, facingMode, deviceId: dispositivoActivo, maxWidth, maxHeight, quality, onReady, onError });

    const destinos = useRef({ onCapture, onFrame });
    useEffect(() => {
        destinos.current = { onCapture, onFrame };
    });

    useImperativeHandle(ref, () => ({ capture: async () => (await capture()).blob, restart }), [capture, restart]);

    const tomarFoto = async () => {
        try {
            const { blob, meta } = await capture();
            await destinos.current.onCapture?.(blob, meta);
        } catch {
            // El fotograma no estaba listo; el usuario puede intentarlo de nuevo.
        }
    };

    // Captura continua: setTimeout encadenado (no setInterval) para esperar a que termine cada envío.
    useEffect(() => {
        if (!continuo || !active || estado !== 'ready') return undefined;
        let cancelado = false;
        let temporizador;
        const ciclo = async () => {
            try {
                const { blob, meta } = await capture();
                const destino = destinos.current.onFrame ?? destinos.current.onCapture;
                await destino?.(blob, meta);
            } catch {
                // Un fotograma fallido no detiene la captura continua.
            }
            if (!cancelado) temporizador = setTimeout(ciclo, periodoCaptura(intervalMs));
        };
        temporizador = setTimeout(ciclo, periodoCaptura(intervalMs));
        return () => {
            cancelado = true;
            clearTimeout(temporizador);
        };
    }, [continuo, active, estado, intervalMs, capture]);

    const cambiarCamara = (e) => {
        setDeviceInterno(e.target.value);
        onDeviceChange?.(e.target.value);
    };

    return (
        <div className={clsx('flex flex-col gap-3', className)}>
            {errorCamara && (
                <Alert tone="danger" title="Cámara no disponible">
                    <p>{errorCamara.message}</p>
                    <Button variant="secondary" size="sm" onClick={restart} className="mt-2">
                        Reintentar
                    </Button>
                </Alert>
            )}
            <div className={clsx('relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-foreground shadow-soft', errorCamara && 'hidden')}>
                <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    aria-label="Vista previa de la cámara"
                    className={clsx('h-full w-full object-cover', espejo && '-scale-x-100')}
                />
                {estado === 'starting' && (
                    <div className="absolute inset-0 flex items-center justify-center text-primary-foreground">
                        <Spinner label="Iniciando cámara" />
                    </div>
                )}
                {ovalGuide && (
                    <>
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
                            <ellipse cx="50" cy="50" rx="24" ry="38" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 2" className="text-primary-foreground" />
                        </svg>
                        <p className="absolute inset-x-0 bottom-2 text-center text-sm text-primary-foreground">Centra el rostro en el óvalo</p>
                    </>
                )}
            </div>
            {allowDeviceSelect && dispositivos.length > 1 && (
                <Select
                    aria-label="Cámara"
                    value={dispositivoActivo ?? dispositivos[0].deviceId}
                    onChange={cambiarCamara}
                    options={dispositivos.map((d, i) => ({ value: d.deviceId, label: d.label || `Cámara ${i + 1}` }))}
                />
            )}
            {mostrarObturador && (
                <Button onClick={tomarFoto} disabled={estado !== 'ready'}>
                    Capturar foto
                </Button>
            )}
        </div>
    );
}
