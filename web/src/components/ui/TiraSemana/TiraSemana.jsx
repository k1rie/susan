'use client';

import clsx from 'clsx';
import { useRef } from 'react';
import { formatoNumero } from '@/lib/graficas.js';
import { EASE, useEnVista, usePrefersReducedMotion } from '@/lib/motion';
import {
    ANCHO_CASILLA_REM,
    COLUMNAS_MAX,
    ESCALA_UNIDAD,
    escalaTira,
    estadoLimite,
    intensidadCasilla,
    mezclaCasilla,
    normalizarCasillas,
    SEPARACION,
    tamanoEtiquetaCss,
    tamanoValorCss,
    textoLimite,
} from './tiraSemana.utils.js';

// Mapa de calor de una fila de casillas (días de la semana): cada casilla se tiñe con el color de ausencia en proporción a su
// valor; las que alcanzan el límite llevan un contorno y un texto accesible. La cifra va siempre escrita: el color no es la única señal.
//   datos  = [{ etiqueta, valor }] · de 1 a 7 casillas por fila (más pasan a otra fila) · valor null, '' o no numérico = «sin dato»:
//            casilla neutra con «-» y sin color de ausencia (no es lo mismo que un 0); un negativo cuenta como 0
//   limite = número > 0 (p. ej. 20) · con límite, el color se mide contra 1,25 x el límite; quien lo iguala o rebasa lleva anillo y
//            «(en el límite de 20 %)» / «(sobre el límite de 20 %)» solo para lectores de pantalla; sin límite, el color se escala por el
//            mayor valor (la casilla más alta es la más intensa)
//   unidad = ' %' (por defecto) se escribe junto a la cifra, más pequeña · vacio = texto sin datos · className = clases del contenedor
//            (que mide como mucho 7 rem por casilla: una sola casilla no se estira por toda la tarjeta)
// La cifra (11-16 px) y el nombre (10-12 px) se achican según el ancho para no desbordar la casilla; si aun así no cabe, el nombre se
// corta con puntos suspensivos y el title lo trae completo.
// Al cambiar los datos el color se mueve con una transición corta y la entrada (aparecer con escala) solo ocurre una vez.
export default function TiraSemana({ datos = [], limite, unidad = ' %', vacio = 'Sin datos', className }) {
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const enVista = useEnVista(ref, { desactivado: reducido });
    const visible = reducido || enVista;
    const casillas = normalizarCasillas(datos);

    // El contenedor con `ref` existe SIEMPRE: así una tira que pasa de «sin datos» a «con datos» también se anima al aparecer.
    if (!casillas.length) {
        return (
            <div ref={ref} className={className}>
                <p className="rounded-xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">{vacio}</p>
            </div>
        );
    }

    const columnas = Math.min(casillas.length, COLUMNAS_MAX);
    const escala = escalaTira(casillas.map((c) => c.valor), limite);
    const textos = casillas.map((c) => (c.valor === null ? '-' : formatoNumero(c.valor)));
    const unidadCorta = String(unidad ?? '').trim();
    const tamano = tamanoValorCss(columnas, textos, unidadCorta);
    const tamanoEtiqueta = tamanoEtiquetaCss(columnas, casillas.map((c) => c.etiqueta));

    return (
        // Es contenedor de consultas para que la cifra pueda medirse contra el ancho real (cqw); su ancho máximo evita que una sola
        // casilla se estire por toda la tarjeta.
        <div ref={ref} className={clsx('@container', className)} style={{ maxWidth: `${columnas * ANCHO_CASILLA_REM}rem` }}>
            <ul className="grid" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`, gap: SEPARACION }}>
                {casillas.map((c, i) => {
                    const sinDato = c.valor === null;
                    const estado = estadoLimite(c.valor, limite);
                    const retraso = Math.min(i, 8) * 70;
                    return (
                        <li
                            key={`${c.etiqueta}-${i}`}
                            data-casilla={c.etiqueta}
                            title={`${c.etiqueta}: ${sinDato ? 'sin datos' : `${formatoNumero(c.valor)}${unidad}`}`}
                            className={clsx(
                                'flex min-h-[4.5rem] flex-col-reverse items-center justify-center rounded-xl px-1 py-3 text-center',
                                sinDato && 'bg-muted',
                                estado && 'ring-2 ring-destructive/70',
                            )}
                            style={{
                                backgroundColor: sinDato ? undefined : `color-mix(in oklab, var(--g-ausente) ${mezclaCasilla(intensidadCasilla(c.valor, escala))}%, var(--muted))`,
                                opacity: visible ? 1 : 0,
                                transform: visible ? 'none' : 'scale(0.92)',
                                transition: reducido
                                    ? undefined
                                    : `opacity 0.5s ease ${retraso}ms, transform 0.5s ${EASE.salida} ${retraso}ms, background-color 0.5s ease, box-shadow 0.3s ease`,
                            }}
                        >
                            {/* En el DOM la etiqueta va primero (se lee «Vie 19,7 %»); la cifra se pinta encima con flex-col-reverse.
                                Etiqueta y unidad van a opacidad plena: sobre la casilla más intensa (72 % de color de ausencia) cualquier
                                atenuación baja el contraste de 4,5:1 (WCAG 1.4.3); la jerarquía la dan el tamaño y el peso. */}
                            <span className="mt-1.5 max-w-full truncate leading-4 text-foreground" style={{ fontSize: tamanoEtiqueta }}>{c.etiqueta}</span>
                            <span className="whitespace-nowrap font-semibold leading-none tabular-nums" style={{ fontSize: tamano }}>
                                {sinDato ? (
                                    <>
                                        <span aria-hidden="true" className="text-muted-foreground">-</span>
                                        <span className="sr-only">sin datos</span>
                                    </>
                                ) : (
                                    <>
                                        {formatoNumero(c.valor)}
                                        {unidadCorta && (
                                            <span className="ml-px font-medium text-foreground" style={{ fontSize: `${ESCALA_UNIDAD}em` }}>{unidadCorta}</span>
                                        )}
                                    </>
                                )}
                            </span>
                            {estado && <span className="sr-only">{textoLimite(estado, limite, unidad)}</span>}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
