import { useEffect, useRef, useState } from 'react';
import { cargarDetector } from './detectorRostros.js';
import { FALLOS_MAXIMOS, INTERVALO_DETECCION_MS, marcosDeDetecciones, RETENCION_MS } from './deteccionRostros.utils.js';

// Detecta rostros en el <video> en vivo y devuelve sus recuadros (fracciones del marco visible).
//   videoRef = ref del <video> · activo = la cámara ya entrega imagen · espejo = el video se muestra volteado
// estado: 'cargando' (bajando el modelo la primera vez) | 'listo' | 'no-disponible' (sin WASM o fallos seguidos; la cámara sigue igual)
//         | 'inactivo' (cámara apagada). Esto es solo la retroalimentación visual: quién es cada rostro lo decide el servidor.
export default function useDeteccionRostros({ videoRef, activo, espejo = false }) {
    const [estado, setEstado] = useState('cargando');
    const [marcos, setMarcos] = useState([]);
    const espejoRef = useRef(espejo);
    useEffect(() => {
        espejoRef.current = espejo;
    });

    useEffect(() => {
        if (!activo) return undefined;
        let cancelado = false;
        let temporizador = null;
        let ultimoCuadro = -1;
        let ultimaVista = 0;
        let fallos = 0;

        const detener = () => {
            cancelado = true;
            clearTimeout(temporizador);
        };

        cargarDetector()
            .then((detector) => {
                if (cancelado) return;
                setEstado('listo');
                const ciclo = () => {
                    if (cancelado) return;
                    const video = videoRef.current;
                    // Solo con cuadro nuevo y la pestaña a la vista: detectar sobre un cuadro repetido o en segundo plano es gastar batería.
                    if (video && video.readyState >= 2 && video.videoWidth > 0 && !document.hidden && video.currentTime !== ultimoCuadro) {
                        ultimoCuadro = video.currentTime;
                        try {
                            const { detections } = detector.detectForVideo(video, performance.now());
                            const nuevos = marcosDeDetecciones(detections, {
                                videoAncho: video.videoWidth,
                                videoAlto: video.videoHeight,
                                cajaAncho: video.clientWidth,
                                cajaAlto: video.clientHeight,
                                espejo: espejoRef.current,
                            });
                            fallos = 0;
                            const ahora = performance.now();
                            if (nuevos.length > 0) {
                                ultimaVista = ahora;
                                setMarcos(nuevos);
                            } else if (ahora - ultimaVista > RETENCION_MS) {
                                setMarcos((previos) => (previos.length > 0 ? [] : previos));
                            }
                        } catch {
                            fallos += 1;
                            if (fallos >= FALLOS_MAXIMOS) {
                                setEstado('no-disponible');
                                setMarcos([]);
                                return; // sin más ciclos: el detector no funciona en este equipo
                            }
                        }
                    }
                    temporizador = setTimeout(ciclo, INTERVALO_DETECCION_MS);
                };
                ciclo();
            })
            .catch(() => {
                if (!cancelado) setEstado('no-disponible');
            });

        return detener;
    }, [activo, videoRef]);

    return { estado: activo ? estado : 'inactivo', marcos: activo ? marcos : [] };
}
