'use client';

import { useEffect, useRef } from 'react';
import MarcosRostros from '../MarcosRostros/MarcosRostros.jsx';
import useDeteccionRostros from './useDeteccionRostros.js';

// Capa de detección de rostros de una vista de cámara: corre el detector sobre el <video> y dibuja un recuadro por rostro.
// Vive dentro de la caja del video (`relative`, mismo tamaño). Es solo retroalimentación para quien mira la pantalla: no cambia lo que se
// captura ni lo que reconoce el servidor.
//   videoRef = ref del <video> · activo = la cámara ya entrega imagen · espejo = el video se muestra volteado
//   onCambio({ estado, cantidad }) = cuando cambia el estado del detector o el número de rostros (para el chip de VistaCamara)
export default function DeteccionRostros({ videoRef, activo, espejo = false, onCambio }) {
    const { estado, marcos } = useDeteccionRostros({ videoRef, activo, espejo });
    const cantidad = marcos.length;

    const destino = useRef(onCambio);
    useEffect(() => {
        destino.current = onCambio;
    });
    useEffect(() => {
        destino.current?.({ estado, cantidad });
    }, [estado, cantidad]);

    return <MarcosRostros marcos={marcos} />;
}
