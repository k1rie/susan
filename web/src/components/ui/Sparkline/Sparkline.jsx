'use client';

import { useId, useRef } from 'react';
import { colorGrafica } from '@/lib/graficas.js';
import { puntosSerie, trazoSuave } from '@/lib/graficasGeometria.js';
import { EASE, useEnVista, usePrefersReducedMotion } from '@/lib/motion';
import { dominioSerie, idSvg, limpiarSerie } from './sparkline.utils.js';

const MARGEN = 3;

// Línea de tendencia mínima (sin ejes) para colgar de una cifra: curva suave, área con degradado y punto final; el trazo se dibuja al
// entrar en vista (con "reducir movimiento" aparece ya dibujada). Decorativa (aria-hidden): la tendencia ya está escrita junto a la cifra.
//   valores = serie REAL en orden (se descartan null/NaN/no numéricos; con menos de 2 puntos no dibuja nada)
//   min / max = dominio fijo del eje y (para comparar varias series); sin ellos usa el rango de los datos y, si son todos iguales,
//   dibuja una línea plana al centro · color = token (var(--ausente), var(--chart-5)…; se traduce al tono vivo de gráfica)
//   ancho / alto = lienzo en px (el svg escala con CSS si se le da className, p. ej. "h-auto w-full")
export default function Sparkline({ valores = [], ancho = 120, alto = 36, color = 'var(--g-azul)', min, max, className }) {
    const id = useId();
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const nums = limpiarSerie(valores);
    const dibujable = nums.length >= 2;
    // Si la serie llega después (p. ej. tras cargar), `desactivado` cambia y el observador se vuelve a armar sobre el svg ya montado.
    const enVista = useEnVista(ref, { desactivado: reducido || !dibujable });
    if (!dibujable) return null;
    const visible = reducido || enVista;
    const [lo, hi] = dominioSerie(nums, min, max);
    // Con dominio fijo un valor fuera de rango se pega al borde en lugar de salirse del lienzo.
    const puntos = puntosSerie(nums, ancho, alto, { margen: MARGEN, min: lo, max: hi }).map(([x, y]) => [x, Math.min(alto - MARGEN, Math.max(MARGEN, y))]);
    const trazo = trazoSuave(puntos);
    const [xf, yf] = puntos[puntos.length - 1];
    const area = `${trazo} L${xf} ${alto} L${puntos[0][0]} ${alto} Z`;
    const idDegradado = idSvg(id, 'g');
    return (
        <svg
            ref={ref}
            viewBox={`0 0 ${ancho} ${alto}`}
            width={ancho}
            height={alto}
            className={className}
            aria-hidden="true"
            focusable="false"
            style={{ color: colorGrafica(color), overflow: 'visible' }}
        >
            <defs>
                <linearGradient id={idDegradado} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${idDegradado})`} style={{ opacity: visible ? 1 : 0, transition: reducido ? undefined : 'opacity 0.9s ease 0.2s' }} />
            <path
                d={trazo}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="1"
                strokeDasharray="1"
                strokeDashoffset={visible ? 0 : 1}
                // La opacidad oculta el punto que dejan los extremos redondeados del trazo mientras está "sin dibujar".
                style={{ opacity: visible ? 1 : 0, transition: reducido ? undefined : `stroke-dashoffset 1.1s ${EASE.salida}, opacity 0.15s ease` }}
            />
            <circle cx={xf} cy={yf} r="3" fill="currentColor" style={{ opacity: visible ? 1 : 0, transition: reducido ? undefined : 'opacity 0.4s ease 0.9s' }} />
        </svg>
    );
}
