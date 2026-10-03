'use client';

import { useEffect, useRef, useState } from 'react';
import { enviarCaptura } from '@/lib/http/captura.js';

const CODIGOS_FIN = ['FUERA_DE_VENTANA', 'SESION_NO_ABIERTA', 'CAPTURA_EN_OTRA_SESION'];

export const esServicioNoDisponible = (e) => e?.status === 503 || e?.code === 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE';
export const esFinMuestreo = (e) => e?.status === 409 && (e?.details?.fin_muestreo === true || CODIGOS_FIN.includes(e?.code));

/**
 * Bucle de muestreo de una sesion automatica abierta y en ventana. Un envio a la vez (el siguiente ciclo se
 * programa al terminar el anterior, no con setInterval), cada `intervaloSeg`.
 * - camara del navegador: toma un fotograma con `capturar()` (Blob) y lo envia;
 * - camaras IP activas: llama a enviarCaptura sin imagen (el servidor jala la instantanea).
 * Errores: 503 del servicio de reconocimiento -> bandera `servicioNoDisponible` y sigue; 409 de fin de muestreo
 * -> se detiene y avisa con onFin; cualquier otro -> onError y reintento en el siguiente ciclo.
 * @param {{ idSesion: number, activo: boolean, intervaloSeg: number, camaraNavegadorId?: number | null,
 *   camarasIp?: number[], capturar?: () => Promise<Blob>, onFin?: (e: object) => void, onError?: (e: object) => void }} p
 */
export default function useMuestreoSesion({ idSesion, activo, intervaloSeg, camaraNavegadorId = null, camarasIp = [], capturar, onFin, onError }) {
    const [estado, setEstado] = useState({ ultima: null, enviando: false, servicioNoDisponible: false, detenido: null, ciclos: 0 });
    const vivo = useRef({});
    useEffect(() => {
        vivo.current = { camaraNavegadorId, camarasIp, capturar, onFin, onError };
    });

    useEffect(() => {
        if (!activo || !idSesion) return undefined;
        let cancelado = false;
        let temporizador = null;
        const intervaloMs = Math.max(Number(intervaloSeg) || 15, 1) * 1000;
        const parcial = (cambios) => {
            if (!cancelado) setEstado((p) => ({ ...p, ...cambios }));
        };

        // Devuelve true si hay que detener el bucle.
        const enviar = async (idCamara, imagen) => {
            try {
                const r = await enviarCaptura({ idSesion, idCamara, imagen, marcaTiempo: new Date() });
                parcial({ ultima: { ...r, recibida: Date.now() }, servicioNoDisponible: false });
                return false;
            } catch (e) {
                if (cancelado) return true;
                if (esFinMuestreo(e)) {
                    parcial({ detenido: e.code || 'FIN_MUESTREO' });
                    vivo.current.onFin?.(e);
                    return true;
                }
                if (esServicioNoDisponible(e)) parcial({ servicioNoDisponible: true });
                else vivo.current.onError?.(e);
                return false;
            }
        };

        const ciclo = async () => {
            temporizador = null;
            if (cancelado) return;
            parcial({ enviando: true });
            let detener = false;
            const { camaraNavegadorId: navegador, camarasIp: ips, capturar: tomar } = vivo.current;
            if (navegador != null && tomar) {
                let blob = null;
                try {
                    blob = await tomar();
                } catch {
                    blob = null; // fotograma aun no listo: se omite este ciclo
                }
                if (blob && !cancelado) detener = await enviar(navegador, blob);
            }
            for (const idCamara of ips || []) {
                if (detener || cancelado) break;
                detener = await enviar(idCamara, null);
            }
            if (cancelado) return;
            setEstado((p) => ({ ...p, enviando: false, ciclos: p.ciclos + 1 }));
            if (!detener) temporizador = setTimeout(ciclo, intervaloMs);
        };

        temporizador = setTimeout(ciclo, 0);
        return () => {
            cancelado = true;
            if (temporizador) clearTimeout(temporizador);
        };
    }, [activo, idSesion, intervaloSeg]);

    return estado;
}
