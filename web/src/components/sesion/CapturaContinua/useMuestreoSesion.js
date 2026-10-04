'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENTO_RELOJ_CAMBIO } from '@/hooks/data/eventos.js';
import { enviarCaptura } from '@/lib/http/captura.js';

const CODIGOS_FIN = ['FUERA_DE_VENTANA', 'SESION_NO_ABIERTA', 'CAPTURA_EN_OTRA_SESION'];

// Errores que hablan de LA HORA y no del fotograma: reintentar con la misma hora no los arregla, así que no se repiten en bucle.
// MARCA_FUTURA es el de svc_crear_captura (la marca excede la hora de negocio + 5 min); el resto son los del reloj de demostración.
const CODIGOS_RELOJ = ['MARCA_FUTURA', 'MARCA_INVALIDA', 'RELOJ_NO_ACTIVO', 'FUERA_DE_RANGO', 'FORMATO_INVALIDO'];

export const esServicioNoDisponible = (e) => e?.status === 503 || e?.code === 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE';
export const esFinMuestreo = (e) => e?.status === 409 && (e?.details?.fin_muestreo === true || CODIGOS_FIN.includes(e?.code));
export const esErrorDeReloj = (e) => CODIGOS_RELOJ.includes(e?.code);
export const esLimiteDeCapturas = (e) => e?.status === 429 || e?.code === 'DEMASIADOS_INTENTOS';

const ESTADO_INICIAL = { ultima: null, enviando: false, servicioNoDisponible: false, detenido: null, ciclos: 0, problemaReloj: null, limitado: false, repetidas: 0 };

/**
 * Bucle de muestreo de una sesion automatica abierta y en ventana. Un envio a la vez (el siguiente ciclo se
 * programa al terminar el anterior, no con setInterval), cada `intervaloSeg`.
 * - camara del navegador: toma un fotograma con `capturar()` (Blob) y lo envia;
 * - camaras IP activas: llama a enviarCaptura sin imagen (el servidor jala la instantanea).
 *
 * La hora de la captura NO se manda: la estampa el servidor con la hora de negocio (la real en produccion, la simulada con el reloj
 * de demostracion). Mandar la del equipo hacía que, con el reloj simulado, toda captura pareciera «del futuro» (MARCA_FUTURA).
 *
 * Errores:
 * - 503 del servicio de reconocimiento -> bandera `servicioNoDisponible` y sigue;
 * - 409 de fin de muestreo -> se detiene (`detenido` = el código) y avisa con onFin; si la ventana vuelve a abrirse (el bucle arranca de
 *   nuevo) `detenido` se limpia en el primer ciclo;
 * - MARCA_FUTURA y demas errores de hora -> `problemaReloj` ({ code, message }) y se DETIENE: un solo aviso claro, sin reintentos ni
 *   avisos repetidos. Se reanuda con `reanudar()` o solo cuando el reloj de demostracion cambia (evento global);
 * - 429 (demasiadas capturas) -> bandera `limitado`, sin aviso: el siguiente ciclo ya cumple la separacion que pide el servidor;
 * - cualquier otro -> onError y reintento en el siguiente ciclo. Un error igual al anterior seguido NO se vuelve a avisar (si el
 *   servidor falla durante minutos, un aviso por ciclo solo apila avisos).
 * `repetidas` cuenta capturas seguidas que el servidor ya tenia (ya_procesada): con el reloj de demostracion detenido todas llevan la
 * misma hora y no suman lecturas.
 * @param {{ idSesion: number, activo: boolean, intervaloSeg: number, camaraNavegadorId?: number | null,
 *   camarasIp?: number[], capturar?: () => Promise<Blob | null>, onFin?: (e: object) => void, onError?: (e: object) => void }} p
 */
export default function useMuestreoSesion({ idSesion, activo, intervaloSeg, camaraNavegadorId = null, camarasIp = [], capturar, onFin, onError }) {
    const [estado, setEstado] = useState(ESTADO_INICIAL);
    const [intento, setIntento] = useState(0);
    const vivo = useRef({});
    const errorPrevio = useRef(null);
    useEffect(() => {
        vivo.current = { camaraNavegadorId, camarasIp, capturar, onFin, onError };
    });

    useEffect(() => {
        if (!activo || !idSesion) return undefined;
        let cancelado = false;
        let temporizador = null;
        const intervaloMs = Math.max(Number(intervaloSeg) || 15, 1) * 1000;
        const parcial = (cambios) => {
            if (!cancelado) setEstado((p) => ({ ...p, ...(typeof cambios === 'function' ? cambios(p) : cambios) }));
        };
        const avisarError = (e) => {
            const clave = `${e?.code ?? ''}|${e?.message ?? ''}`;
            if (errorPrevio.current === clave) return;
            errorPrevio.current = clave;
            vivo.current.onError?.(e);
        };

        // Devuelve true si hay que detener el bucle.
        const enviar = async (idCamara, imagen) => {
            try {
                const r = await enviarCaptura({ idSesion, idCamara, imagen });
                errorPrevio.current = null;
                parcial((p) => ({
                    ultima: { ...r, recibida: Date.now() },
                    servicioNoDisponible: false,
                    limitado: false,
                    repetidas: r.ya_procesada ? p.repetidas + 1 : 0,
                }));
                return false;
            } catch (e) {
                if (cancelado) return true;
                if (esFinMuestreo(e)) {
                    parcial({ detenido: e.code || 'FIN_MUESTREO' });
                    vivo.current.onFin?.(e);
                    return true;
                }
                if (esErrorDeReloj(e)) {
                    parcial({ problemaReloj: { code: e.code, message: e.message } });
                    return true;
                }
                if (esServicioNoDisponible(e)) parcial({ servicioNoDisponible: true });
                else if (esLimiteDeCapturas(e)) parcial({ limitado: true });
                else avisarError(e);
                return false;
            }
        };

        const ciclo = async () => {
            temporizador = null;
            if (cancelado) return;
            // Cada arranque del bucle (la ventana volvió a abrirse, se reanudó, cambió el ritmo) empieza sin «detenido»: ese aviso hablaba
            // de la vuelta anterior y, si el servidor sigue diciendo que ya no hay captura, este ciclo lo vuelve a poner.
            parcial({ enviando: true, detenido: null });
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
    }, [activo, idSesion, intervaloSeg, intento]);

    // Vuelve a intentar tras un problema de hora. El aviso se limpia de una vez: si el problema sigue, el primer envio lo vuelve a poner.
    const reanudar = useCallback(() => {
        setEstado((p) => (p.problemaReloj ? { ...p, problemaReloj: null } : p));
        setIntento((n) => n + 1);
    }, []);

    // Mover el reloj de demostracion es justo lo que arregla un problema de hora: se reintenta solo, una vez por cambio.
    const hayProblemaReloj = estado.problemaReloj != null;
    useEffect(() => {
        if (!hayProblemaReloj || typeof window === 'undefined') return undefined;
        window.addEventListener(EVENTO_RELOJ_CAMBIO, reanudar);
        return () => window.removeEventListener(EVENTO_RELOJ_CAMBIO, reanudar);
    }, [hayProblemaReloj, reanudar]);

    // Un envío en camino al que se le apagó el bucle (la sesión salió de la ventana a media captura) ya no avisa cuando termina: sin
    // `activo`, «enviando» se quedaría encendido para siempre.
    return { ...estado, enviando: estado.enviando && activo, reanudar };
}
