'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENTO_RELOJ_CAMBIO } from '@/hooks/data/eventos.js';
import { cambiarRelojDemo, leerRelojDemo } from '@/lib/local/relojCliente.js';
import { instanteMostrado } from './relojDemo.utils.js';

// El reloj puede cambiar desde otra pestana o a mano (archivo): se vuelve a leer de vez en cuando. Es una lectura
// barata (un stat en el servidor) y se omite con la pestana oculta.
const SINCRONIA_MS = 20_000;

/**
 * Estado y acciones del reloj de demostracion. Tras cada cambio avisa a la pantalla (evento global que
 * useApiQuery escucha + router.refresh() para lo que se carga en el servidor) para que muestre la nueva hora de negocio.
 * @param {{ sincroniaMs?: number }} [opciones] `sincroniaMs: 0` apaga la relectura periodica
 */
export default function useRelojDemo({ sincroniaMs = SINCRONIA_MS } = {}) {
    const router = useRouter();
    const [estado, setEstado] = useState(null); // respuesta del servidor + recibidoEn (ms del navegador)
    const [error, setError] = useState(null);
    const [pendiente, setPendiente] = useState(false);
    const [marcha, setMarcha] = useState(null); // { de: estado, ms }: instante vivo mientras el reloj corre
    // Cada peticion toma un numero; solo la mas reciente puede escribir (una lectura lenta no pisa un cambio mas nuevo).
    const secuencia = useRef(0);
    // Último estado que ESTA tarjeta emitió con el evento global: se reconoce para no adoptarlo dos veces.
    const propio = useRef(null);

    // Otra pieza movió el reloj (la cámara simulada lo pone en marcha o lo adelanta) y lo avisó con el evento: se adopta el estado que
    // trae, sin esperar a la relectura periódica (20 s), para que la tarjeta nunca muestre una hora que ya no es la de la base.
    useEffect(() => {
        const alCambiar = (evento) => {
            const nuevo = evento.detail;
            if (!nuevo || nuevo === propio.current || typeof nuevo.ahora !== 'string') return;
            secuencia.current += 1; // una relectura que venía en camino es anterior a este cambio: no debe pisarlo
            setError(null);
            setEstado({ ...nuevo, recibidoEn: Date.now() });
        };
        window.addEventListener(EVENTO_RELOJ_CAMBIO, alCambiar);
        return () => window.removeEventListener(EVENTO_RELOJ_CAMBIO, alCambiar);
    }, []);

    useEffect(() => {
        let activo = true;
        let primera = true;
        const sincronizar = () => {
            const id = ++secuencia.current;
            return leerRelojDemo().then(
                (r) => {
                    if (!activo || id !== secuencia.current) return;
                    primera = false;
                    setError(null);
                    setEstado({ ...r, recibidoEn: Date.now() });
                },
                (e) => {
                    // Un fallo de relectura con datos ya en pantalla no los borra ni molesta.
                    if (activo && primera && id === secuencia.current) setError(e);
                },
            );
        };
        sincronizar();
        const temporizador = sincroniaMs > 0
            ? setInterval(() => { if (!document.hidden) sincronizar(); }, sincroniaMs)
            : null;
        return () => {
            activo = false;
            if (temporizador) clearInterval(temporizador);
        };
    }, [sincroniaMs]);

    // Corriendo: la hora que se ve avanza cada segundo a partir de la respuesta del servidor.
    useEffect(() => {
        if (!estado?.corre) return undefined;
        const temporizador = setInterval(() => {
            const vivo = instanteMostrado(estado, Date.now());
            if (vivo) setMarcha({ de: estado, ms: vivo.ms });
        }, 1000);
        return () => clearInterval(temporizador);
    }, [estado]);

    const cambiar = useCallback(async (cuerpo) => {
        const id = ++secuencia.current;
        setPendiente(true);
        setError(null);
        try {
            const r = await cambiarRelojDemo(cuerpo);
            if (id === secuencia.current) setEstado({ ...r, recibidoEn: Date.now() });
            propio.current = r;
            window.dispatchEvent(new CustomEvent(EVENTO_RELOJ_CAMBIO, { detail: r }));
            router.refresh();
            return true;
        } catch (e) {
            setError(e);
            return false;
        } finally {
            setPendiente(false);
        }
    }, [router]);

    const base = estado ? instanteMostrado(estado, estado.recibidoEn) : null;
    const mostrado = base && marcha?.de === estado ? { ms: marcha.ms, offsetMin: base.offsetMin } : base;

    return {
        estado,
        mostrado,
        error,
        pendiente,
        // Sin reloj de demostracion (apagado, o la ruta no existe fuera del modo local): la tarjeta no se muestra.
        apagado: estado ? !estado.activo : error?.code === 'NO_ENCONTRADO',
        avanzar: (min) => cambiar({ avanzarMin: min }),
        fijar: (texto) => cambiar({ fijar: texto }),
        restablecer: () => cambiar({ restablecer: true }),
        alternarCorrer: () => cambiar({ correr: !estado?.corre }),
    };
}
