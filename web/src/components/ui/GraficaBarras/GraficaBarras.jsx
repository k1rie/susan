'use client';

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/shadcn/chart.jsx';

// Barras (shadcn chart). `datos` = filas con la clave de categoría `ejeX` y una propiedad por serie; `series` = [{ clave }]
// (etiqueta y color salen de `config`). `horizontal` pone las categorías en vertical (útil con nombres largos: alumnos, grupos).
// `apilado` apila las series. `limite` = { valor, etiqueta } dibuja una línea de referencia (p. ej. el 20 % de faltas).
// `unidad` se añade a los valores de eje y tooltip (' %'). `dominio` = [min, max] del eje numérico.
export default function GraficaBarras({
    datos,
    ejeX,
    series,
    config,
    horizontal = false,
    apilado = false,
    limite,
    unidad = '',
    dominio,
    alto = 260,
    leyenda = series.length > 1,
    vacio = 'Sin datos para graficar',
    className,
}) {
    if (!datos?.length) {
        return <p className="flex items-center justify-center rounded-lg bg-muted/60 text-sm text-muted-foreground" style={{ height: alto }}>{vacio}</p>;
    }
    const formato = (v) => `${v}${unidad}`;
    const ejeNumerico = { type: 'number', domain: dominio ?? [0, 'auto'], tickFormatter: formato, tickLine: false, axisLine: false, tickMargin: 8, allowDecimals: false };
    const ejeCategoria = { dataKey: ejeX, type: 'category', tickLine: false, axisLine: false, tickMargin: 8, interval: 0 };
    return (
        <ChartContainer config={config} className={className ?? 'w-full'} style={{ height: alto, aspectRatio: 'auto' }}>
            <BarChart accessibilityLayer data={datos} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ left: horizontal ? 8 : 0, right: 12, top: limite?.etiqueta ? 24 : 8 }}>
                <CartesianGrid horizontal={!horizontal} vertical={horizontal} strokeDasharray="3 3" />
                {horizontal ? <XAxis {...ejeNumerico} /> : <XAxis {...ejeCategoria} />}
                {horizontal ? <YAxis {...ejeCategoria} width={110} /> : <YAxis {...ejeNumerico} width={44} />}
                <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent indicator="dot" formatter={undefined} />} />
                {leyenda && <ChartLegend content={<ChartLegendContent />} />}
                {series.map((s, i) => (
                    <Bar
                        key={s.clave}
                        dataKey={s.clave}
                        fill={`var(--color-${s.clave})`}
                        stackId={apilado ? 'a' : undefined}
                        radius={apilado ? (i === series.length - 1 ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0) : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                        maxBarSize={horizontal ? 22 : 44}
                    />
                ))}
                {limite && (
                    <ReferenceLine
                        {...(horizontal ? { x: limite.valor } : { y: limite.valor })}
                        stroke="var(--destructive)"
                        strokeDasharray="4 4"
                        label={limite.etiqueta ? { value: limite.etiqueta, position: horizontal ? 'top' : 'insideTopRight', fill: 'var(--destructive)', fontSize: 11 } : undefined}
                    />
                )}
            </BarChart>
        </ChartContainer>
    );
}
