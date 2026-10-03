import { useCallback, useEffect, useRef, useState } from 'react';
import { construirConstraints, crearError, dimensionesCaptura, traducirError } from './cameraCapture.utils.js';

// Maneja el ciclo de vida del flujo de la cámara: pedir permiso, reproducir, listar dispositivos,
// capturar un JPEG y liberar las pistas al desmontar, desactivar o cambiar de cámara.
export default function useCameraCapture({ active = true, facingMode = 'user', deviceId, maxWidth = 1280, maxHeight = 960, quality = 0.9, onReady, onError }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const callbacks = useRef({ onReady, onError });
    const [estado, setEstado] = useState('idle'); // idle | starting | ready | error
    const [error, setError] = useState(null);
    const [dispositivos, setDispositivos] = useState([]);
    const [reinicio, setReinicio] = useState(0);

    useEffect(() => {
        callbacks.current = { onReady, onError };
    });

    useEffect(() => {
        if (!active) return undefined;
        let cancelado = false;
        const video = videoRef.current;

        const fallar = (err) => {
            setError(err);
            setEstado('error');
            callbacks.current.onError?.(err);
        };

        const iniciar = async () => {
            if (typeof window !== 'undefined' && window.isSecureContext === false) return fallar(crearError('INSEGURO'));
            if (!navigator.mediaDevices?.getUserMedia) return fallar(crearError('NO_SOPORTADO'));
            setError(null);
            setEstado('starting');
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(construirConstraints({ facingMode, deviceId }));
            } catch (e) {
                if (!cancelado) fallar(traducirError(e));
                return undefined;
            }
            if (cancelado) {
                stream.getTracks().forEach((t) => t.stop());
                return undefined;
            }
            streamRef.current = stream;
            if (video) {
                video.srcObject = stream;
                try {
                    await video.play?.();
                } catch {
                    // Algunos navegadores rechazan play() si el elemento se desmonta; no es un fallo de cámara.
                }
            }
            if (cancelado) return undefined;
            setEstado('ready');
            callbacks.current.onReady?.();
            try {
                // Las etiquetas de dispositivos solo están disponibles tras conceder el permiso.
                const lista = await navigator.mediaDevices.enumerateDevices?.();
                if (!cancelado && lista) setDispositivos(lista.filter((d) => d.kind === 'videoinput'));
            } catch {
                // Sin lista de dispositivos simplemente no se muestra el selector.
            }
            return undefined;
        };
        iniciar();

        return () => {
            cancelado = true;
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            if (video) video.srcObject = null;
        };
    }, [active, facingMode, deviceId, reinicio]);

    // Captura el fotograma actual como JPEG. El video espejado es solo visual: el canvas no se espeja.
    const capture = useCallback(async () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight) throw new Error('La cámara aún no está lista.');
        const { width, height } = dimensionesCaptura(video.videoWidth, video.videoHeight, maxWidth, maxHeight);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(video, 0, 0, width, height);
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))), 'image/jpeg', quality);
        });
        const actual = streamRef.current?.getVideoTracks?.()[0]?.getSettings?.().deviceId ?? deviceId ?? null;
        return { blob, meta: { width, height, capturedAt: new Date().toISOString(), deviceId: actual } };
    }, [maxWidth, maxHeight, quality, deviceId]);

    const restart = useCallback(() => setReinicio((n) => n + 1), []);

    return { videoRef, estado: active ? estado : 'idle', error: active ? error : null, dispositivos, capture, restart };
}
