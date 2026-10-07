'use client';

import clsx from 'clsx';
import { ArrowRight, Check, ChevronRight, CircleCheck } from 'lucide-react';
import { createElement, isValidElement, useEffect, useRef } from 'react';
import Button from '../Button/Button.jsx';
import TarjetaFila from '../TarjetaFila/TarjetaFila.jsx';
import { esComponente, varianteAccion } from './successState.utils.js';

const ICONO_POR_OMISION = <CircleCheck aria-hidden="true" className="size-7" strokeWidth={1.75} />;

// Pantalla de éxito, hermana de EmptyState y ErrorState. Referencias de Mobbin: el cierre de Klaviyo (tres tarjetas con la siguiente
// acción), fal (confirmación breve) y el anti-patrón de Dropbox Dash y Shopify (un «todo listo» sin siguiente paso).
// REGLA: ofrece siempre 2 o 3 siguientes pasos entre `steps` y `actions`; nunca una pantalla sin salidas.
//
//   title, description   qué se creó, en una línea.
//   steps                [{ label, description?, href | onClick, icon?: ComponenteLucide, tone?, recommended?, done? }]: tarjetas de «qué sigue»
//                        (TarjetaFila). `recommended` marca la más probable; `done` la muestra como hecha y sin acción.
//   actions              [{ label, href | onClick, variant?, icon? }]: botones de salida corta («Ir a la lista», «Crear otro»). El primero es primario.
//   icon                 nodo o componente de Lucide; por omisión `CircleCheck`.
//   focusOnMount         true (por omisión): al aparecer, el foco va al título (reemplaza a un formulario y no debe perderse el contexto).
//   wrap                 false (por omisión): título y descripción de cada paso van en UNA línea con «…». true: hasta 2 líneas (`line-clamp-2`,
//                        sin cortar palabras sueltas) para textos como «Registrar el consentimiento firmado» a 360 px. Cada paso puede traer
//                        su propio `wrap` (tiene prioridad).
export default function SuccessState({ title, description, steps = [], actions = [], icon, stepsLabel = 'Siguientes pasos', focusOnMount = true, wrap = false, className, ...rest }) {
    const tituloRef = useRef(null);
    useEffect(() => {
        if (focusOnMount) tituloRef.current?.focus();
    }, [focusOnMount]);

    const nodoIcono = icon == null ? ICONO_POR_OMISION : esComponente(icon) ? createElement(icon, { 'aria-hidden': 'true', className: 'size-7', strokeWidth: 1.75 }) : isValidElement(icon) ? icon : ICONO_POR_OMISION;

    return (
        <div role={focusOnMount ? undefined : 'status'} className={clsx('mx-auto flex w-full max-w-md flex-col items-center gap-2 px-4 py-8 text-center', className)} {...rest}>
            <div aria-hidden="true" className="mb-1 flex size-14 items-center justify-center rounded-full bg-presente-bg text-presente">
                {nodoIcono}
            </div>
            <h2 ref={tituloRef} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
                {title}
            </h2>
            {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}

            {steps.length > 0 && (
                <section aria-label={stepsLabel} className="mt-4 flex w-full flex-col gap-2 text-left">
                    <p className="px-1 text-xs font-medium text-muted-foreground">{stepsLabel}</p>
                    <ul className="flex flex-col gap-2">
                        {steps.map((s, i) => {
                            const enlace = !s.done && s.href;
                            const boton = !s.done && !s.href && s.onClick;
                            return (
                                <li key={s.id ?? `${s.label}-${i}`}>
                                    <TarjetaFila
                                        icono={s.done ? Check : (s.icon ?? ArrowRight)}
                                        tono={s.done ? 'verde' : s.tone ?? 'azul'}
                                        titulo={s.label}
                                        subtitulo={s.description}
                                        lineas={(s.wrap ?? wrap) ? 2 : 1}
                                        href={enlace || undefined}
                                        as={boton ? 'button' : undefined}
                                        type={boton ? 'button' : undefined}
                                        onClick={boton ? s.onClick : undefined}
                                        className={clsx(boton && 'w-full transition-colors duration-150 hover:border-input hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30')}
                                        accion={
                                            s.done ? (
                                                <span className="text-xs font-medium text-presente">Hecho</span>
                                            ) : enlace || boton ? (
                                                <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" strokeWidth={1.75} />
                                            ) : null
                                        }
                                    >
                                        {s.recommended && !s.done && (
                                            <span className="mt-1 inline-flex rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">Recomendado</span>
                                        )}
                                    </TarjetaFila>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            {actions.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {actions.map((a, i) => (
                        <Button key={a.id ?? `${a.label}-${i}`} variant={varianteAccion(a, i)} href={a.href} onClick={a.onClick} icon={a.icon}>
                            {a.label}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );
}
