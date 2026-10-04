'use client';

import { useEffect, useRef, useState } from 'react';
import { salidaCubica, useEnVista, usePrefersReducedMotion } from '@/lib/motion';
import { decimalesDe, formatearNumero } from './countUp.utils.js';

// Contador animado (basado en CountUp de ReactBits) con un tween por requestAnimationFrame y easeOutCubic. Escribe
// directo en el nodo de texto: cero re-renders de React durante la animación. Arranca al entrar al viewport.
// El HTML del servidor ya trae el valor final (sin parpadeo de "0" ni dependencia de JS) y los lectores de
// pantalla leen siempre el valor final (texto sr-only). Con "reducir movimiento" no anima.
// Si `to` cambia después (datos en vivo por sondeo), la cuenta sigue desde la cifra que se ve en ese momento hacia la nueva, sin
// reiniciar desde `from` ni esperar `delay` otra vez.
//   to  valor final    from  valor inicial (solo de la primera animación)    duration  segundos    delay  segundos
export default function CountUp({ to, from = 0, duration = 1.4, delay = 0, locale = 'es-MX', separador = true, prefix = '', suffix = '', className }) {
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const enVista = useEnVista(ref, { desactivado: reducido });
    const decimales = decimalesDe(from, to);
    const formato = { decimales, locale, separador };
    const textoFinal = `${prefix}${formatearNumero(to, formato)}${suffix}`;
    // El nodo visible lo escribe solo el efecto. Su hijo en JSX queda fijo en el texto del primer render (el que trae el servidor):
    // si cambiara con `to`, React escribiría la cifra nueva en el commit y habría un cuadro con el final antes de que el efecto
    // vuelva a la cifra anterior para animar desde ella.
    const [textoInicial] = useState(textoFinal);
    // Cifra que se ve ahora y si ya hubo una animación: de ahí arranca la siguiente.
    const mostrado = useRef(from);
    const yaAnimo = useRef(false);

    // Antes de entrar al viewport muestra el valor inicial; al entrar, anima hacia el final.
    useEffect(() => {
        const nodo = ref.current;
        if (!nodo) return undefined;
        const pintar = (v) => {
            mostrado.current = v;
            nodo.textContent = `${prefix}${formatearNumero(v, { decimales, locale, separador })}${suffix}`;
        };
        if (reducido) {
            pintar(to);
            return undefined;
        }
        if (!enVista) {
            pintar(from);
            return undefined;
        }
        const origen = yaAnimo.current ? mostrado.current : from;
        const espera = yaAnimo.current ? 0 : delay;
        yaAnimo.current = true;
        pintar(origen);
        let cuadro = 0;
        let inicio = null;
        const paso = (ahora) => {
            if (inicio === null) inicio = ahora;
            const t = duration > 0 ? (ahora - inicio) / (duration * 1000) : 1;
            pintar(t >= 1 ? to : origen + (to - origen) * salidaCubica(t));
            if (t < 1) cuadro = requestAnimationFrame(paso);
        };
        const arrancar = setTimeout(() => {
            cuadro = requestAnimationFrame(paso);
        }, espera * 1000);
        return () => {
            clearTimeout(arrancar);
            cancelAnimationFrame(cuadro);
        };
    }, [enVista, reducido, from, to, duration, delay, decimales, locale, separador, prefix, suffix]);

    return (
        <span className={className}>
            <span className="sr-only">{textoFinal}</span>
            <span ref={ref} aria-hidden="true">{textoInicial}</span>
        </span>
    );
}
