// Medidor de tanque con líquido físico. Adaptado de React Bits (https://reactbits.dev, componente «Slosh Gauge») para SUSAN:
// colores solo por tokens (sin hex; `onLiquidColor` se indica a mano), "reducir movimiento" sin chapoteo ni inclinación (el nivel salta al
// objetivo), `matchMedia`/rAF protegidos, la referencia `live` se actualiza en un efecto (no durante el render) y la física vive en
// `sloshGauge.utils.js` (funciones puras). Sin dependencias. Es solo un medidor (`role="meter"`): se quitó el modo interactivo
// (slider por puntero/teclado) del original porque ninguna pantalla lo usa, no tenía pruebas de arrastre y aumentaba el JS de las vistas.
'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/motion';
import { avanzarFisica, clamp, desnivelSuperficie, DT_MAX, nivelValido, PASO_FIJO, recorteLiquido } from './sloshGauge.utils.js';

// `ariaValue` = lo que lee el lector de pantalla como valor del medidor (por defecto, el nivel del tanque): sirve cuando el líquido
// sube desde 0 al entrar en vista pero el valor real ya es otro. `ariaDescribedBy` = id de un texto que lo complementa.
export default function SloshGauge({
    value,
    showValue = true,
    liquidColor = 'var(--primary)',
    onLiquidColor = 'var(--primary-foreground)',
    glassColor = 'var(--muted)',
    width = 88,
    height = 180,
    radius = 20,
    ticks = 4,
    viscosity = 0.15,
    tilt = 0.45,
    splash = 0.42,
    unit = '%',
    ariaLabel = 'Level',
    ariaValue,
    ariaDescribedBy,
    className = '',
}) {
    const root = useRef(null);
    const liquid = useRef(null);
    const textA = useRef(null);
    const textB = useRef(null);
    const reducido = usePrefersReducedMotion();
    const start = nivelValido(value, 0);
    const sim = useRef({ x: start, v: 0, L: start, raf: 0, last: 0 });
    const reduce = useRef(false);
    const live = useRef({ viscosity, tilt, splash, width, value, unit, ariaValue });
    // Debe ir antes de los demás efectos: sus lecturas de `live` esperan los props de este render.
    useLayoutEffect(() => {
        live.current = { viscosity, tilt, splash, width, value, unit, ariaValue };
    });

    const paint = () => {
        const { x, v } = sim.current;
        const { tilt: t, width: W } = live.current;
        if (liquid.current) {
            liquid.current.style.clipPath = recorteLiquido(x, desnivelSuperficie(v, t, W, reduce.current));
        }
    };

    const say = () => {
        const n = Math.round(sim.current.L);
        const s = `${n}${live.current.unit}`;
        root.current?.setAttribute('aria-valuenow', String(live.current.ariaValue ?? n));
        if (textA.current) textA.current.textContent = s;
        if (textB.current) textB.current.textContent = s;
    };

    const tick = now => {
        const s = sim.current;
        const { viscosity: vis, splash: give } = live.current;
        const dt = s.last ? clamp((now - s.last) / 1000, 0, DT_MAX) : PASO_FIJO;
        s.last = now;
        const quieto = avanzarFisica(s, dt, { viscosity: vis, splash: give, reducido: reduce.current });
        paint();
        // En reposo se aparca el requestAnimationFrame: un tanque quieto no cuesta nada.
        if (quieto) {
            s.raf = 0;
            s.last = 0;
        } else {
            s.raf = requestAnimationFrame(tick);
        }
    };
    const wake = () => {
        if (!sim.current.raf) sim.current.raf = requestAnimationFrame(tick);
    };
    const setLevel = L => {
        const s = sim.current;
        s.L = clamp(L, 0, 100);
        // Con "reducir movimiento" el nivel salta al objetivo y se pinta ya: sin resorte, sin cuadros pendientes.
        const salta = reduce.current;
        if (salta) {
            s.x = s.L;
            s.v = 0;
            paint();
        }
        say();
        if (!salta) wake();
    };

    // Valor que fija el padre (null = no controlado o inválido).
    const objetivoControlado = () => {
        const v = live.current.value;
        return v === undefined || v === null ? null : nivelValido(v, null);
    };

    // Sigue la preferencia del sistema (usePrefersReducedMotion ya protege `matchMedia` ausente): al activarse, el líquido se asienta
    // en su nivel y se quita la inclinación. Va antes del efecto de `value` para que el primer `setLevel` ya la vea.
    useLayoutEffect(() => {
        reduce.current = reducido;
        if (reducido) {
            sim.current.x = sim.current.L;
            sim.current.v = 0;
        }
        paint();
    }, [reducido]);

    useLayoutEffect(() => {
        const n = objetivoControlado();
        if (n === null) return;
        setLevel(n);
        // setLevel y objetivoControlado solo tocan refs: el efecto debe depender únicamente de `value`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    useLayoutEffect(() => {
        say();
        paint();
        const s = sim.current;
        return () => {
            // También reinicia `raf`: en StrictMode (montaje doble) un id viejo y truthy impediría volver a despertar la animación.
            cancelAnimationFrame(s.raf);
            s.raf = 0;
            s.last = 0;
        };
    }, []);

    useEffect(() => {
        paint();
    }, [width, height, tilt, showValue]);

    const r = Math.min(radius, width / 2, height / 2);
    const label = `${Math.round(start)}${unit}`;

    return (
        <div
            ref={root}
            className={`relative isolate box-border inline-block overflow-clip leading-none font-semibold tabular-nums select-none [width:var(--sg-w)] [height:var(--sg-h)] [border-radius:var(--sg-r)] [background:var(--sg-glass)] [font-size:var(--sg-font)] [-webkit-tap-highlight-color:transparent]${className ? ` ${className}` : ''}`}
            role="meter"
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ariaValue ?? Math.round(start)}
            style={{
                '--sg-w': `${width}px`,
                '--sg-h': `${height}px`,
                '--sg-r': `${r}px`,
                '--sg-glass': glassColor,
                '--sg-liquid': liquidColor,
                '--sg-on-liquid': onLiquidColor,
                '--sg-ticks': ticks,
                '--sg-font': `${clamp(Math.round(width * 0.16), 12, 20)}px`,
            }}
        >
            {showValue ? (
                <span
                    ref={textA}
                    className="pointer-events-none absolute inset-0 grid place-items-center [color:color-mix(in_srgb,currentColor_65%,transparent)]"
                    aria-hidden="true"
                >
                    {label}
                </span>
            ) : null}
            <div
                ref={liquid}
                className="absolute inset-0 [background:var(--sg-liquid)] [clip-path:polygon(0_100%,100%_100%,100%_100%,0_100%)]"
                aria-hidden="true"
            >
                {showValue ? (
                    <span
                        ref={textB}
                        className="pointer-events-none absolute inset-0 grid place-items-center [color:var(--sg-on-liquid)]"
                    >
                        {label}
                    </span>
                ) : null}
            </div>
            {ticks > 0 ? (
                <div
                    className="pointer-events-none absolute right-0 bottom-0 h-full w-[22%] bg-bottom bg-repeat-y [background-image:linear-gradient(to_top,color-mix(in_srgb,currentColor_22%,transparent)_0_1px,transparent_1px)] [background-size:100%_calc(100%/var(--sg-ticks))]"
                    aria-hidden="true"
                />
            ) : null}
        </div>
    );
}
