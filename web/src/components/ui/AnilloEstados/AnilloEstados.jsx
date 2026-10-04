'use client';

import clsx from 'clsx';
import { useRef, useState } from 'react';
import { colorGrafica, formatoNumero, textoPct, valorNoNegativo } from '@/lib/graficas.js';
import { EASE, useEnVista, usePrefersReducedMotion } from '@/lib/motion';
import { arcosEstables, CIRCUNFERENCIA as C, GROSOR, ladoAnillo, RADIO, tamanoCentro } from './anilloEstados.utils.js';

// Anillo fino de estados (SVG, sin librerías): segmentos de extremos redondeados que se «dibujan» al entrar en vista, total (o un
// valor propio) al centro y leyenda con cifra y porcentaje. Props:
//   datos  = [{ clave, valor }] · el orden de `datos` es el de arcos y leyenda; valor 0, negativo o no numérico no dibuja arco pero SÍ
//            sale en la leyenda (atenuado, con 0); un valor pequeño se dibuja como punto (ver arcosEstables)
//   config = { clave: { label, color } } · color = token de texto (--presente…) o de gráfica (--g-*); sin config usa la clave y el azul
//   centro = { valor, etiqueta } · sobrescribe el total del centro (p. ej. '82 %' / 'Asistencia'); sin `valor` muestra el total
//   alto   = altura de referencia (240) que dimensiona el anillo; la altura real suma la leyenda y depende del ancho
//   vacio  = texto cuando no hay datos o el total es 0 · className = clases del contenedor
// Datos vivos (la sesión sondea cada 5 s): la entrada se anima UNA vez; después, cada arco se desplaza y cambia de largo con una
// transición corta (stroke-dasharray + stroke-dashoffset) y un estado que aparece o desaparece se desvanece, sin reiniciar nada.
// Con «reducir movimiento» no hay transiciones. El anillo es decorativo (aria-hidden): todas las cifras están en la leyenda y el centro.
export default function AnilloEstados({ datos = [], config = {}, centro, alto = 240, vacio = 'Sin datos para graficar', className }) {
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const enVista = useEnVista(ref, { desactivado: reducido });
    const visible = reducido || enVista;
    const [activo, setActivo] = useState(null);
    // Pasa a true cuando termina la primera transición: desde ahí se quita el retraso escalonado de la entrada (que solo tiene sentido al
    // aparecer) para que una actualización mueva todos los arcos a la vez y no queden huecos o solapes pasajeros entre vecinos.
    const [entrado, setEntrado] = useState(false);

    const items = (datos ?? []).map((d) => ({ clave: d.clave, valor: valorNoNegativo(d.valor) }));
    const total = items.reduce((suma, d) => suma + d.valor, 0);
    // El contenedor con `ref` existe SIEMPRE: si solo se montara con datos, el observador de entrada nunca vería el nodo y un anillo que
    // pasa de «sin datos» a «con datos» (sesión que recibe su primer registro) se quedaría invisible.
    if (!items.length || total <= 0) {
        return (
            <div ref={ref} className={className}>
                <p className="flex items-center justify-center rounded-xl bg-muted/60 text-sm text-muted-foreground" style={{ height: alto }}>{vacio}</p>
            </div>
        );
    }

    const arcos = arcosEstables(items);
    const lado = ladoAnillo(alto);
    const color = (clave) => colorGrafica(config?.[clave]?.color ?? 'var(--g-azul)');
    const etiqueta = (clave) => config?.[clave]?.label ?? clave;
    // Solo un estado con valor puede quedar «elegido»: si una actualización lo deja en 0 el centro vuelve a mostrar el total.
    const elegido = activo ? items.find((d) => d.clave === activo && d.valor > 0) : null;
    const principal = elegido ? formatoNumero(elegido.valor) : (centro?.valor ?? formatoNumero(total));
    const secundaria = elegido ? etiqueta(elegido.clave) : (centro?.etiqueta ?? 'Total');
    const dur = entrado ? 0.5 : 0.9;

    return (
        <div ref={ref} className={clsx('@container', className)}>
            <div className="flex flex-col items-center gap-5">
                <div className="relative" style={{ width: lado, height: lado }}>
                    <svg
                        viewBox="0 0 120 120"
                        className="size-full -rotate-90"
                        aria-hidden="true"
                        onTransitionEnd={(e) => {
                            if (e.propertyName === 'stroke-dasharray') setEntrado(true);
                        }}
                    >
                        <circle cx="60" cy="60" r={RADIO} fill="none" stroke="var(--muted)" strokeWidth={GROSOR} />
                        {arcos.map((a, i) => {
                            const dibujado = visible && a.valor > 0;
                            const atenuado = elegido && elegido.clave !== a.clave;
                            return (
                                <circle
                                    key={a.clave}
                                    cx="60"
                                    cy="60"
                                    r={RADIO}
                                    fill="none"
                                    stroke={color(a.clave)}
                                    strokeWidth={GROSOR}
                                    strokeLinecap="round"
                                    // Igual a la longitud geométrica real (2 pi r), así que las medidas no cambian; sin él Chrome no pinta un
                                    // punto de 0.01 pegado al final del trazo (el último estado con menos de ~0.3 % del total).
                                    pathLength={C}
                                    strokeDasharray={dibujado ? `${a.largo} ${C - a.largo}` : `0 ${C}`}
                                    strokeDashoffset={-a.inicio}
                                    style={{
                                        // Un trazo de largo 0 con extremos redondeados se dibuja como un punto: hay que ocultarlo (antes de
                                        // entrar en vista y cuando el estado vale 0).
                                        opacity: !dibujado ? 0 : atenuado ? 0.22 : 1,
                                        transition: reducido
                                            ? undefined
                                            : `stroke-dasharray ${dur}s ${EASE.salida} ${entrado ? 0 : i * 0.09}s, stroke-dashoffset ${dur}s ${EASE.salida}, opacity 0.2s ease`,
                                    }}
                                />
                            );
                        })}
                    </svg>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-semibold leading-none tracking-tight tabular-nums" style={{ fontSize: tamanoCentro(principal, lado) }}>{principal}</span>
                        <span className="mt-1.5 max-w-[72%] truncate text-xs text-muted-foreground" title={secundaria}>{secundaria}</span>
                    </div>
                </div>
                {/* Una columna en tarjetas angostas (las etiquetas no se truncan); dos cuando el contenedor da para ~180 px por columna. */}
                <ul className="grid w-full max-w-sm grid-cols-1 gap-x-5 gap-y-1.5 text-sm @md:grid-cols-2">
                    {items.map((d) => (
                        <li
                            key={d.clave}
                            onMouseEnter={() => d.valor > 0 && setActivo(d.clave)}
                            onMouseLeave={() => setActivo(null)}
                            className={clsx('flex items-center gap-2 rounded-md px-1.5 py-0.5 transition-opacity', !(d.valor > 0) && 'opacity-55')}
                        >
                            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color(d.clave) }} />
                            <span className="min-w-0 flex-1 truncate text-muted-foreground" title={etiqueta(d.clave)}>{etiqueta(d.clave)}</span>
                            <span className="font-medium tabular-nums">{formatoNumero(d.valor)}</span>
                            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{textoPct(d.valor, total)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
