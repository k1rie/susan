'use client';

import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/shadcn/chart.jsx';
import Checkbox from '@/components/ui/Checkbox';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { construirSerieSemanal, CONFIG_SERIE, descripcionTendencia, MENSAJE_INSUFICIENTE, resumenTextoSerie } from '../analitica.utils.js';
import { formatterSerie } from '../FilaTooltipSerie';
import { conIconos } from '../MuestraSerie';

// La leyenda lleva la forma de cada serie (línea, discontinua, banda) además del color.
const CONFIG = conIconos(CONFIG_SERIE);

// Tasa semanal observada, ajuste de regresión, suavizado y proyección con banda (valores en %), con shadcn chart.
export default function GraficaSerie({ tendencia, suavizado, proyeccion, resumen, cruceLimite, limitePct = 20 }) {
    const [ver, setVer] = useState({ sma: false, ema: true, wma: false });
    const datos = useMemo(() => construirSerieSemanal({ tendencia, suavizado, proyeccion }), [tendencia, suavizado, proyeccion]);
    const alternar = (k) => setVer((v) => ({ ...v, [k]: !v[k] }));
    const textoResumen = resumenTextoSerie({ tendencia, resumen, proyeccion, cruceLimite, limitePct });
    const formatter = useMemo(() => formatterSerie(CONFIG_SERIE), []);

    if (!tendencia?.disponible) {
        return (
            <TarjetaGrafica titulo="Ausentismo semanal" resumen={textoResumen}>
                <p className="flex min-h-40 items-center justify-center rounded-lg bg-muted/60 px-4 text-center text-sm text-muted-foreground">{MENSAJE_INSUFICIENTE}</p>
            </TarjetaGrafica>
        );
    }
    return (
        <TarjetaGrafica
            titulo="Ausentismo semanal"
            descripcion={descripcionTendencia(tendencia)}
            resumen={textoResumen}
            pie={
                <fieldset className="flex flex-wrap items-center gap-x-4">
                    <legend className="sr-only">Medias móviles visibles</legend>
                    <span aria-hidden="true">Medias móviles</span>
                    <Checkbox label="SMA" checked={ver.sma} onChange={() => alternar('sma')} />
                    <Checkbox label="EMA" checked={ver.ema} onChange={() => alternar('ema')} />
                    <Checkbox label="WMA" checked={ver.wma} onChange={() => alternar('wma')} />
                </fieldset>
            }
        >
            <ChartContainer config={CONFIG} className="w-full" style={{ height: 280, aspectRatio: 'auto' }}>
                <ComposedChart accessibilityLayer data={datos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(s) => `S${s}`} />
                    <YAxis width={44} tickLine={false} axisLine={false} tickMargin={4} domain={[0, 'auto']} allowDecimals={false} tickFormatter={(v) => `${v} %`} />
                    <ChartTooltip content={<ChartTooltipContent formatter={formatter} labelFormatter={(_v, payload) => `Semana ${payload?.[0]?.payload?.semana ?? ''}`} />} />
                    <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />} />
                    <Area dataKey="banda" stroke="none" fill="var(--color-banda)" fillOpacity={0.15} isAnimationActive={false} />
                    <Line dataKey="observada" stroke="var(--color-observada)" strokeWidth={0} dot={{ r: 3.5, fill: 'var(--color-observada)', stroke: 'var(--color-observada)', strokeWidth: 1 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls />
                    <Line dataKey="ajuste" stroke="var(--color-ajuste)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                    <Line dataKey="proyeccion" stroke="var(--color-proyeccion)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
                    {ver.sma && <Line dataKey="sma" stroke="var(--color-sma)" strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls />}
                    {ver.ema && <Line dataKey="ema" stroke="var(--color-ema)" strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls />}
                    {ver.wma && <Line dataKey="wma" stroke="var(--color-wma)" strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls />}
                    <ReferenceLine
                        y={limitePct}
                        ifOverflow="extendDomain"
                        stroke="var(--destructive)"
                        strokeDasharray="4 4"
                        label={{ value: `Límite ${limitePct} %`, position: 'insideTopRight', fill: 'var(--destructive)', fontSize: 11 }}
                    />
                </ComposedChart>
            </ChartContainer>
        </TarjetaGrafica>
    );
}
