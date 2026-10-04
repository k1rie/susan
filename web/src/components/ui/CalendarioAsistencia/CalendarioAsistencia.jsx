'use client';

import clsx from 'clsx';
import { Fragment, useRef } from 'react';
import { CONFIG_ASISTENCIA, colorGrafica } from '@/lib/graficas.js';
import { useEnVista, usePrefersReducedMotion } from '@/lib/motion';
import { construirCalendario, contarEstados, diaLargo } from './calendarioAsistencia.utils.js';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// Solo se rotulan los días alternos (lun, mié, vie…): como en el calendario de contribuciones, no hace falta escribirlos todos.
const ROTULADOS = new Set([0, 2, 4, 6]);
const ESTADOS_LEYENDA = ['presente', 'retardo', 'ausente', 'justificado', 'pendiente'];

const ETIQUETA_ESTADO = {
    ...Object.fromEntries(Object.entries(CONFIG_ASISTENCIA).map(([k, v]) => [k, v.label])),
    sin_registro: 'Sin registro',
    suspendida: 'Suspendida',
};

// Calendario de asistencia (referencia: la «Listening Streak» de Mobbin): una columna por semana y una fila por día; cada cuadro es una
// sesión coloreada por su estado. Los días sin sesión quedan en gris tenue. Con más de `maxSemanas` se muestran las más recientes.
//   sesiones = [{ fecha: 'YYYY-MM-DD', estado: presente | retardo | ausente | justificado | pendiente | null, estatus?: 'suspendida' }]
//              (es la forma de `items` de api_alumno_historial: `estatus_sesion` también se entiende)
//   leyenda = cifras por estado debajo del calendario · maxSemanas = 26 · etiqueta = texto alternativo (si no, se arma con las cifras)
// La cuadrícula es decorativa (aria-hidden): quien usa lector de pantalla recibe el resumen de `etiqueta` y el historial en texto de
// la pantalla. Cada cuadro lleva `title` con su fecha y estado para quien pasa el cursor.
export default function CalendarioAsistencia({ sesiones, maxSemanas = 26, leyenda = true, etiqueta, vacio = 'Aún no hay sesiones registradas', className }) {
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const enVista = useEnVista(ref, { desactivado: reducido });
    const visible = reducido || enVista;
    const { semanas, filas, meses, total, recortado } = construirCalendario(sesiones, { maxSemanas });

    if (!semanas.length) {
        return (
            <div ref={ref} className={className}>
                <p className="rounded-xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">{vacio}</p>
            </div>
        );
    }

    const cuentas = contarEstados(sesiones);
    const color = (clave) => {
        if (clave === 'sin_registro') return 'transparent';
        if (clave === 'suspendida') return 'var(--muted)';
        return colorGrafica(CONFIG_ASISTENCIA[clave]?.color);
    };
    const resumen =
        etiqueta ??
        `Calendario de asistencia: ${total} ${total === 1 ? 'sesión' : 'sesiones'}${
            Object.keys(cuentas).length ? ` (${Object.entries(cuentas).map(([k, n]) => `${ETIQUETA_ESTADO[k] ?? k} ${n}`).join(', ')})` : ''
        }${recortado ? '; se muestran las semanas más recientes' : ''}`;
    const columnas = `1.75rem repeat(${semanas.length}, minmax(0, 1fr))`;
    const mesPorSemana = new Map(meses.map((m) => [m.semana, m.etiqueta]));

    return (
        <div ref={ref} className={className}>
            <p className="sr-only">{resumen}</p>
            <div aria-hidden="true" className="grid gap-[3px]" style={{ gridTemplateColumns: columnas }}>
                {/* Fila de meses: cada etiqueta nace en la columna de su primer lunes y puede desbordar hacia las siguientes. */}
                <span />
                {semanas.map((_, w) => (
                    <span key={`m-${w}`} className="relative h-4">
                        {mesPorSemana.has(w) && <span className="absolute left-0 top-0 whitespace-nowrap text-[11px] leading-4 text-muted-foreground">{mesPorSemana.get(w)}</span>}
                    </span>
                ))}
                {filas.map((d) => (
                    <Fragment key={`d-${d}`}>
                        <span className="self-center pr-1 text-[10px] leading-none text-muted-foreground">{ROTULADOS.has(d) ? DIAS[d] : ''}</span>
                        {semanas.map((semana, w) => {
                            const dia = semana.dias[d];
                            const hay = dia.clave !== null;
                            const retraso = Math.min(w, 30) * 18;
                            return (
                                <span
                                    key={`c-${w}-${d}`}
                                    data-fecha={hay ? dia.fecha : undefined}
                                    data-estado={hay ? dia.clave : undefined}
                                    title={hay ? `${diaLargo(dia.t)}: ${ETIQUETA_ESTADO[dia.clave] ?? dia.clave}` : undefined}
                                    className={clsx('aspect-square rounded-[3px]', !hay && 'bg-muted/70', hay && dia.clave === 'sin_registro' && 'border-[1.5px] border-dashed border-muted-foreground/60')}
                                    style={{
                                        backgroundColor: hay ? color(dia.clave) : undefined,
                                        opacity: visible ? 1 : 0,
                                        transform: visible ? 'none' : 'scale(0.6)',
                                        transition: reducido ? undefined : `opacity 0.4s ease ${retraso}ms, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${retraso}ms`,
                                    }}
                                />
                            );
                        })}
                    </Fragment>
                ))}
            </div>
            {leyenda && (
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    {[...ESTADOS_LEYENDA, 'sin_registro', 'suspendida'].filter((k) => cuentas[k]).map((k) => (
                        <li key={k} className="flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className={clsx('size-2.5 rounded-[3px]', k === 'sin_registro' && 'border-[1.5px] border-dashed border-muted-foreground/60')}
                                style={{ backgroundColor: color(k) }}
                            />
                            {ETIQUETA_ESTADO[k]}
                            <span className="font-medium tabular-nums text-foreground">{cuentas[k]}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
