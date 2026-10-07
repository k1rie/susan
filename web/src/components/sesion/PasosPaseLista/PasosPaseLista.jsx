'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';
import { estadoPaso, pasosDe } from './pasosPaseLista.utils.js';

const MARCA = {
    hecho: 'bg-presente-bg text-presente',
    actual: 'bg-foreground text-background',
    pendiente: 'bg-muted text-muted-foreground',
};
const LECTOR = { hecho: 'Hecho: ', actual: 'Paso actual: ', pendiente: 'Pendiente: ' };

// Dónde va el docente en el pase de lista: «Abrir -> Pasar lista -> Revisar y cerrar» (referencias: el check-in de Luma y el estado de
// pasos de Partiful, en docs/design/REFERENCIAS.md). Sustituye a la guía descartable de tres tarjetas: es una sola franja, siempre
// visible, que dice en qué paso se está y qué sigue en una línea. En teléfono caben los tres pasos en una fila (el rótulo baja a dos líneas).
//   modo     = 'automatico' | 'manual' (cambia el texto de los pasos)
//   actual   = 1 | 2 | 3
//   onIrA    = si se pasa, los pasos 2 y 3 son botones que llevan a esa vista (el 1 ya está hecho); si no, solo informa
//   conDetalle = muestra bajo la franja la línea del paso actual (se apaga donde la propia pantalla ya lo explica)
export default function PasosPaseLista({ modo = 'automatico', actual = 2, onIrA, conDetalle = true, className }) {
    const pasos = pasosDe(modo);
    const paso = pasos.find((p) => p.id === actual);
    return (
        <nav aria-label="Pasos para pasar lista" className={clsx('rounded-xl border border-border bg-card px-4 py-4 sm:px-5', className)}>
            <ol className="grid grid-cols-3 gap-x-2">
                {pasos.map((p) => {
                    const estado = estadoPaso(p.id, actual);
                    const contenido = (
                        <>
                            <span aria-hidden="true" className={clsx('grid size-7 place-items-center rounded-full text-[13px] font-semibold tabular-nums', MARCA[estado])}>
                                {estado === 'hecho' ? <Check className="size-4" strokeWidth={2} /> : p.id}
                            </span>
                            <span className={clsx('mt-2 block text-[13px] leading-snug', estado === 'actual' ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
                                <span className="sr-only">{LECTOR[estado]}</span>
                                {p.titulo}
                            </span>
                        </>
                    );
                    const alActual = estado === 'actual' ? 'step' : undefined;
                    return (
                        <li key={p.id} className="relative min-w-0">
                            {p.id < pasos.length && <span aria-hidden="true" className={clsx('absolute -right-1 left-9 top-3.5 h-px', estado === 'hecho' ? 'bg-presente' : 'bg-border')} />}
                            {onIrA && p.id > 1 ? (
                                <button
                                    type="button"
                                    aria-current={alActual}
                                    onClick={() => onIrA(p.id)}
                                    className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                                >
                                    {contenido}
                                </button>
                            ) : (
                                <div aria-current={alActual}>{contenido}</div>
                            )}
                        </li>
                    );
                })}
            </ol>
            {conDetalle && paso && <p className="mt-3.5 border-t border-border pt-3.5 text-sm text-muted-foreground">{paso.detalle}</p>}
        </nav>
    );
}
