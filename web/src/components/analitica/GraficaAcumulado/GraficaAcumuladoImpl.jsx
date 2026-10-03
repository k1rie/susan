'use client';

import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/shadcn/chart.jsx';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_ACUMULADO, construirSerieAcumulado, MENSAJE_INSUFICIENTE, resumenTextoAcumulado } from '../analitica.utils.js';
import { formatterSerie } from '../FilaTooltipSerie';
import { conIconos } from '../MuestraSerie';

// La leyenda lleva la forma de cada serie (línea, discontinua, banda) además del color.
const CONFIG = conIconos(CONFIG_ACUMULADO);

// Faltas equivalentes acumuladas (promedio por alumno, % de las sesiones programadas) frente al límite.
export default function GraficaAcumulado({ cruceLimite, limitePct = 20 }) {
    const datos = useMemo(() => construirSerieAcumulado(cruceLimite), [cruceLimite]);
    const formatter = useMemo(() => formatterSerie(CONFIG_ACUMULADO), []);
    const sinDatos = !cruceLimite || cruceLimite.estado === 'insuficiente' || datos.length === 0;
    return (
        <TarjetaGrafica
            titulo="Faltas acumuladas y límite"
            descripcion={sinDatos ? undefined : `Cruce: ${cruceLimite.mensaje}`}
            resumen={resumenTextoAcumulado(cruceLimite, limitePct)}
        >
            {sinDatos ? (
                <p className="flex min-h-40 items-center justify-center rounded-lg bg-muted/60 px-4 text-center text-sm text-muted-foreground">{MENSAJE_INSUFICIENTE}</p>
            ) : (
                <ChartContainer config={CONFIG} className="w-full" style={{ height: 280, aspectRatio: 'auto' }}>
                    <ComposedChart accessibilityLayer data={datos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(s) => `S${s}`} />
                        <YAxis width={44} tickLine={false} axisLine={false} tickMargin={4} domain={[0, 'auto']} allowDecimals={false} tickFormatter={(v) => `${v} %`} />
                        <ChartTooltip content={<ChartTooltipContent formatter={formatter} labelFormatter={(_v, payload) => `Semana ${payload?.[0]?.payload?.semana ?? ''}`} />} />
                        <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />} />
                        <Area dataKey="banda" stroke="none" fill="var(--color-banda)" fillOpacity={0.15} isAnimationActive={false} />
                        <Line dataKey="acumulado" stroke="var(--color-acumulado)" strokeWidth={0} dot={{ r: 3.5, fill: 'var(--color-acumulado)', stroke: 'var(--color-acumulado)', strokeWidth: 1 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls />
                        <Line dataKey="ajuste" stroke="var(--color-ajuste)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                        <Line dataKey="proyeccion" stroke="var(--color-proyeccion)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
                        <ReferenceLine
                            y={limitePct}
                            ifOverflow="extendDomain"
                            stroke="var(--destructive)"
                            strokeDasharray="4 4"
                            label={{ value: `Límite ${limitePct} %`, position: 'insideTopRight', fill: 'var(--destructive)', fontSize: 11 }}
                        />
                        {cruceLimite.estado === 'cruza' && cruceLimite.semana != null && (
                            <ReferenceLine x={cruceLimite.semana} stroke="var(--destructive)" label={{ value: `S${cruceLimite.semana}`, position: 'top', fill: 'var(--destructive)', fontSize: 11 }} />
                        )}
                    </ComposedChart>
                </ChartContainer>
            )}
        </TarjetaGrafica>
    );
}
