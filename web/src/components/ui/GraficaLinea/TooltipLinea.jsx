'use client';

import { useLayoutEffect, useRef } from 'react';
import { posicionTooltip } from '@/lib/graficasGeometria.js';
import MuestraForma from './MuestraForma.jsx';
import { textoValor, valorSerie } from './graficaLinea.utils.js';

// Tooltip de la fila activa: borde, rounded-lg y fondo de tarjeta, sin sombra. Se coloca junto a la guía vertical, voltea al otro lado
// cerca del borde y nunca se sale del contenedor (se mide el tooltip real tras pintarlo y se corrige antes del primer cuadro). Es
// aria-hidden: lo que lee un lector de pantalla es la región aria-live del contenedor.
export default function TooltipLinea({ modelo, series, fila, titulo, x, renderFila, formatoY, ocultarVacios }) {
    const ref = useRef(null);

    useLayoutEffect(() => {
        const nodo = ref.current;
        if (!nodo) return;
        const { left, top } = posicionTooltip({ x, y: modelo.arriba, ancho: modelo.ancho, alto: modelo.alto, anchoTooltip: nodo.offsetWidth, altoTooltip: nodo.offsetHeight });
        nodo.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    });

    const filas = modelo.series.map((serie, i) => ({ original: series[i], serie, valor: valorSerie(fila, serie) })).filter((f) => !ocultarVacios || f.valor != null);

    return (
        <div ref={ref} data-slot="tooltip-linea" aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-10 min-w-40 rounded-lg border border-border bg-card px-3 py-2 text-xs" style={{ maxWidth: Math.max(0, modelo.ancho - 8) }}>
            <p className="m-0 mb-1.5 font-medium text-foreground">{titulo}</p>
            <ul className="m-0 grid list-none gap-1 p-0">
                {filas.map(({ original, serie, valor }) => (
                    <li key={serie.clave}>
                        {renderFila ? renderFila({ serie: original, valor, fila }) : (
                            <div className="flex items-center gap-2">
                                <MuestraForma forma={serie.forma} color={serie.color} />
                                <span className="min-w-0 flex-1 text-muted-foreground">{serie.etiqueta}</span>
                                <span className="whitespace-nowrap font-medium tabular-nums text-foreground">{textoValor(valor, formatoY)}</span>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
