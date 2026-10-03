'use client';

import { useEffect, useRef } from 'react';
import { salidaCubica, useEnVista, usePrefersReducedMotion } from '@/lib/motion';
import { decimalesDe, formatearNumero } from './countUp.utils.js';

// Contador animado (basado en CountUp de ReactBits) con un tween por requestAnimationFrame y easeOutCubic. Escribe
// directo en el nodo de texto: cero re-renders de React durante la animación. Arranca al entrar al viewport.
// El HTML del servidor ya trae el valor final (sin parpadeo de "0" ni dependencia de JS) y los lectores de
// pantalla leen siempre el valor final (aria-label). Con "reducir movimiento" no anima.
//   to  valor final    from  valor inicial    duration  segundos    delay  segundos
export default function CountUp({ to, from = 0, duration = 1.4, delay = 0, locale = 'es-MX', separador = true, prefix = '', suffix = '', className }) {
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const enVista = useEnVista(ref, { desactivado: reducido });
    const decimales = decimalesDe(from, to);
    const formato = { decimales, locale, separador };
    const textoFinal = `${prefix}${formatearNumero(to, formato)}${suffix}`;

    // Antes de entrar al viewport muestra el valor inicial; al entrar, anima hacia el final.
    useEffect(() => {
        const nodo = ref.current;
        if (!nodo || reducido) return undefined;
        const pintar = (v) => {
            nodo.textContent = `${prefix}${formatearNumero(v, { decimales, locale, separador })}${suffix}`;
        };
        if (!enVista) {
            pintar(from);
            return undefined;
        }
        let cuadro = 0;
        let inicio = null;
        const arrancar = setTimeout(() => {
            const paso = (ahora) => {
                if (inicio === null) inicio = ahora;
                const t = duration > 0 ? (ahora - inicio) / (duration * 1000) : 1;
                pintar(from + (to - from) * salidaCubica(t));
                if (t < 1) cuadro = requestAnimationFrame(paso);
            };
            cuadro = requestAnimationFrame(paso);
        }, delay * 1000);
        return () => {
            clearTimeout(arrancar);
            cancelAnimationFrame(cuadro);
            nodo.textContent = textoFinal;
        };
    }, [enVista, reducido, from, to, duration, delay, decimales, locale, separador, prefix, suffix, textoFinal]);

    return (
        <span aria-label={textoFinal} className={className}>
            <span ref={ref} aria-hidden="true">{textoFinal}</span>
        </span>
    );
}
