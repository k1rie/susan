'use client';

import clsx from 'clsx';
import { useRef } from 'react';
import { colorGrafica, formatoNumero, textoPct } from '@/lib/graficas.js';
import { EASE, useEnVista, usePrefersReducedMotion } from '@/lib/motion';
import { anchoMinimoSegmento, DURACION_ACTUALIZACION, normalizarSegmentos, resumenSegmentos } from './barraSegmentada.utils.js';

// Una barra de segmentos proporcionales con esquinas redondeadas y 2 px entre ellos (el «progreso por fichas» de la pantalla de
// acceso de SchoolAI), con leyenda de cifras debajo. Es la alternativa al anillo cuando falta espacio y, sin leyenda (`leyenda={false}`),
// cabe en la celda de una tabla para mostrar la composición de cada fila.
//   datos    = [{ clave, valor }] · valor 0, negativo o no numérico no dibuja segmento (sí sale en la leyenda, atenuado)
//   config   = { clave: { label, color } } · token de texto o de gráfica; sin config usa la clave y el azul
//   alto     = grosor en px (12) · leyenda = false para usarla dentro de una tabla · vacio = texto cuando no hay datos o la suma es 0
//   etiqueta = texto alternativo propio (por defecto «Presentes 309 (76 %); …»)
// Accesibilidad: sin leyenda la barra es role="img" con aria-label y title con las cifras; con leyenda la barra se oculta a los
// lectores (la leyenda ya lleva las mismas cifras en texto, y leerlas dos veces sobra).
// Proporción: un segmento con valor nunca mide menos de la mitad del grosor (ver anchoMinimoSegmento): se ve aunque sea pequeño, a costa
// de sobredimensionarlo un poco; es un compromiso documentado, no un error de cálculo.
// Datos vivos: la entrada (revelado con clip-path) ocurre una vez; después cada segmento cambia de ancho con una transición corta de
// flex-grow (solo al actualizar, en un elemento diminuto), y un segmento que aparece o desaparece se desvanece. Con «reducir
// movimiento» no hay transiciones.
export default function BarraSegmentada({ datos = [], config = {}, alto = 12, leyenda = true, vacio = 'Sin datos', etiqueta, className }) {
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const enVista = useEnVista(ref, { desactivado: reducido });
    const visible = reducido || enVista;
    const items = normalizarSegmentos(datos);
    const total = items.reduce((suma, d) => suma + d.valor, 0);
    const color = (clave) => colorGrafica(config?.[clave]?.color ?? 'var(--g-azul)');
    const nombre = (clave) => config?.[clave]?.label ?? clave;

    // El contenedor con `ref` existe SIEMPRE (si no, una fila de tabla que pasa de «sin datos» a «con datos» nunca se revelaría).
    if (!items.length || total <= 0) {
        return (
            <div ref={ref} className={className}>
                <div className="rounded-full bg-muted" style={{ height: alto }} {...(leyenda ? { 'aria-hidden': true } : { role: 'img', 'aria-label': vacio })} />
                {leyenda && <p className="mt-3 text-sm text-muted-foreground">{vacio}</p>}
            </div>
        );
    }

    const resumen = etiqueta ?? resumenSegmentos(items, nombre);
    const minimo = anchoMinimoSegmento(alto);
    return (
        <div ref={ref} className={className}>
            <div
                className="flex gap-0.5"
                style={{ height: alto }}
                title={resumen}
                {...(leyenda ? { 'aria-hidden': true } : { role: 'img', 'aria-label': resumen })}
            >
                {items.map((d, i) => {
                    const dibujado = d.valor > 0;
                    return (
                        <span
                            key={d.clave}
                            data-segmento={d.clave}
                            className="rounded-full"
                            style={{
                                // flex-grow como porcentaje del total (suma 100): con fracciones (0,2 + 0,1) un flex-grow < 1 repartiría solo una parte del espacio.
                                flexGrow: dibujado ? (d.valor * 100) / total : 0,
                                flexShrink: 1,
                                flexBasis: '0%',
                                minWidth: dibujado ? minimo : 0,
                                // Un segmento colapsado no debe dejar su hueco de 2 px entre vecinos: el margen negativo lo compensa.
                                marginLeft: dibujado ? 0 : -2,
                                background: color(d.clave),
                                opacity: dibujado ? 1 : 0,
                                clipPath: visible ? 'inset(0 0 0 0 round 999px)' : 'inset(0 100% 0 0 round 999px)',
                                transition: reducido
                                    ? undefined
                                    : `clip-path 0.8s ${EASE.salida} ${i * 80}ms, flex-grow ${DURACION_ACTUALIZACION}s ${EASE.salida}, margin-left ${DURACION_ACTUALIZACION}s ${EASE.salida}, opacity 0.3s ease`,
                            }}
                        />
                    );
                })}
            </div>
            {leyenda && (
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                    {items.map((d) => (
                        <li key={d.clave} className={clsx('flex items-center gap-1.5', !(d.valor > 0) && 'opacity-55')}>
                            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color(d.clave) }} />
                            <span className="text-muted-foreground">{nombre(d.clave)}</span>
                            <span className="font-medium tabular-nums">{formatoNumero(d.valor)}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{textoPct(d.valor, total)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
