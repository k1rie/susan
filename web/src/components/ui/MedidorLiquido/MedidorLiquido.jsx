'use client';

import clsx from 'clsx';
import { useId, useRef } from 'react';
import CountUp from '@/components/motion/CountUp';
import SloshGauge from '@/components/motion/SloshGauge';
import { formatoPct } from '@/lib/graficas.js';
import { useEnVista, usePrefersReducedMotion } from '@/lib/motion';
import { limiteMedidor, nivelMedidor } from './medidorLiquido.utils.js';

const TONOS = { presente: 'var(--g-presente)', retardo: 'var(--g-retardo)', ausente: 'var(--g-ausente)', azul: 'var(--g-azul)', violeta: 'var(--g-violeta)' };

// Medidor líquido (Slosh Gauge de React Bits): un tanque cuyo líquido sube con «chapoteo» al entrar en vista y se queda en `valor`
// (0-100). La cifra grande va al lado, no dentro, para que se lea bien (la animación es solo refuerzo). Con «reducir movimiento»
// el tanque aparece ya lleno y sin física. Si `valor` cambia después (sondeo de la sesión en vivo), el mismo tanque chapotea hacia el
// nuevo nivel (no se remonta ni baja a 0) y la cifra cuenta desde la anterior.
// Es un `role="meter"` con nombre «etiqueta: N %»; el lector de pantalla siempre recibe el valor real, aunque el líquido aún suba.
//   valor = 0-100 · tono = presente | retardo | ausente | azul | violeta · etiqueta = qué mide · descripcion = línea de apoyo opcional
//   limite = { valor, etiqueta } marca discontinua a esa altura del tanque con una etiqueta corta al lado (p. ej. «Mínimo 80 %»)
//   ancho / alto = tanque en px · className = clases extra del contenedor
export default function MedidorLiquido({ valor = 0, tono = 'presente', etiqueta, descripcion, limite, ancho = 84, alto = 168, className }) {
    const id = useId();
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const enVista = useEnVista(ref, { desactivado: reducido });
    const nivel = nivelMedidor(valor);
    const marca = limiteMedidor(limite);
    const idLimite = `${id}-limite`;
    const idDescripcion = `${id}-descripcion`;
    const describedBy = [marca && idLimite, descripcion && idDescripcion].filter(Boolean).join(' ') || undefined;
    return (
        // flex-wrap: en un contenedor muy angosto el texto baja debajo del tanque en lugar de salirse del ancho.
        <div ref={ref} className={clsx('flex flex-wrap items-center gap-x-5 gap-y-3', className)}>
            <div className="relative flex shrink-0" style={{ height: alto }}>
                <SloshGauge
                    value={reducido || enVista ? nivel : 0}
                    ariaValue={nivel}
                    showValue={false}
                    liquidColor={TONOS[tono] ?? TONOS.presente}
                    glassColor="var(--muted)"
                    width={ancho}
                    height={alto}
                    radius={24}
                    ticks={5}
                    unit="%"
                    viscosity={0.2}
                    tilt={0.35}
                    splash={0.3}
                    ariaLabel={`${etiqueta ?? 'Nivel'}: ${formatoPct(nivel)}`}
                    ariaDescribedBy={describedBy}
                />
                {marca && (
                    <>
                        {/* Reserva el ancho de la etiqueta en el flujo (la etiqueta real es absoluta, a la altura del límite y por eso no lo
                            ocupa): el pseudo-elemento invisible copia el texto de data-etiqueta, así no se duplica en el DOM. */}
                        <span
                            aria-hidden="true"
                            data-etiqueta={marca.etiqueta}
                            className="block h-full after:invisible after:block after:h-0 after:max-w-28 after:overflow-hidden after:whitespace-nowrap after:pl-3 after:text-[11px] after:font-medium after:content-[attr(data-etiqueta)]"
                        />
                        {/* Marca: línea discontinua que cruza el tanque (sale 6 px por la derecha) y la etiqueta justo a su lado, en su propia
                            columna: no pisa la cifra ni la descripción. Se centra en la altura del límite (bottom = valor %). */}
                        <div
                            data-limite={marca.valor}
                            className="pointer-events-none absolute -left-1 right-0 flex items-center"
                            style={{ bottom: `${marca.valor}%`, transform: 'translateY(50%)' }}
                        >
                            <span aria-hidden="true" className="h-0 shrink-0 border-t border-dashed border-foreground/70" style={{ width: ancho + 10 }} />
                            <span id={idLimite} className="min-w-0 pl-1.5 text-[11px] font-medium leading-tight text-muted-foreground">
                                {marca.etiqueta}
                            </span>
                        </div>
                    </>
                )}
            </div>
            <div className="min-w-[6.5rem] flex-1">
                <p className="text-4xl font-semibold leading-none tracking-tight tabular-nums">
                    <CountUp to={nivel} suffix=" %" duration={1.3} />
                </p>
                {etiqueta && <p className="mt-2 text-sm font-medium">{etiqueta}</p>}
                {descripcion && (
                    <p id={idDescripcion} className="mt-1 text-sm text-muted-foreground">
                        {descripcion}
                    </p>
                )}
            </div>
        </div>
    );
}
