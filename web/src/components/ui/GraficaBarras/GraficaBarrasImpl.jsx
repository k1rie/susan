'use client';

import { Bar, BarChart, CartesianGrid, Rectangle, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/shadcn/chart.jsx';
import useDatosEstables from '@/lib/useDatosEstables.js';

const RADIO = 4;

// En barras apiladas solo el extremo EXTERIOR de cada barra se redondea: el de la última serie con valor > 0 de esa fila (no siempre
// la última de la lista). `payload` trae la fila; `indice` es la posición de la serie.
function formaApilada(claves, indice, horizontal) {
    return function FormaBarra(props) {
        const { payload, x, y, width, height, fill } = props;
        const hayDespues = claves.slice(indice + 1).some((k) => Number(payload?.[k]) > 0);
        const r = hayDespues ? 0 : RADIO;
        return <Rectangle x={x} y={y} width={width} height={height} fill={fill} radius={horizontal ? [0, r, r, 0] : [r, r, 0, 0]} />;
    };
}

// Barras (shadcn chart). `datos` = filas con la clave de categoría `ejeX` y una propiedad por serie; `series` = [{ clave }]
// (etiqueta y color salen de `config`). `horizontal` pone las categorías en vertical (útil con nombres largos: alumnos, grupos).
// `apilado` apila las series. `limite` = { valor, etiqueta } dibuja una línea de referencia (p. ej. el 20 % de faltas).
// `unidad` se añade a los valores de eje y tooltip (' %'). `dominio` = [min, max] del eje numérico. `anchoEjeY` = ancho de las
// etiquetas de categoría cuando `horizontal` (110 por defecto).
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
    anchoEjeY = 110,
    leyenda = series.length > 1,
    vacio = 'Sin datos para graficar',
    className,
}) {
    const estables = useDatosEstables(datos);
    if (!estables?.length) {
        return <p className="flex items-center justify-center rounded-lg bg-muted/60 text-sm text-muted-foreground" style={{ height: alto }}>{vacio}</p>;
    }
    const formato = (v) => `${v}${unidad}`;
    const ejeNumerico = { type: 'number', domain: dominio ?? [0, 'auto'], tickFormatter: formato, tickLine: false, axisLine: false, tickMargin: 8, allowDecimals: false };
    const ejeCategoria = { dataKey: ejeX, type: 'category', tickLine: false, axisLine: false, tickMargin: 8, interval: 0 };
    const claves = series.map((s) => s.clave);
    // Con unidad, el tooltip debe mostrarla: shadcn exige que el formatter pinte la fila completa.
    const formatter = unidad
        ? (valor, nombre, item) => (
              <>
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px]" style={{ background: item?.color ?? item?.payload?.fill }} />
                  <span className="flex flex-1 items-center justify-between gap-4 leading-none">
                      <span className="text-muted-foreground">{config[nombre]?.label ?? nombre}</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">{valor}{unidad}</span>
                  </span>
              </>
          )
        : undefined;
    return (
        <ChartContainer config={config} className={className ?? 'w-full'} style={{ height: alto, aspectRatio: 'auto' }}>
            <BarChart accessibilityLayer data={estables} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ left: horizontal ? 8 : 0, right: 12, top: limite?.etiqueta ? 24 : 8 }}>
                <CartesianGrid horizontal={!horizontal} vertical={horizontal} strokeDasharray="3 3" />
                {horizontal ? <XAxis {...ejeNumerico} /> : <XAxis {...ejeCategoria} />}
                {horizontal ? <YAxis {...ejeCategoria} width={anchoEjeY} /> : <YAxis {...ejeNumerico} width={44} />}
                <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent indicator="dot" formatter={formatter} />} />
                {leyenda && <ChartLegend itemSorter={null} content={<ChartLegendContent />} />}
                {series.map((s, i) => (
                    <Bar
                        key={s.clave}
                        dataKey={s.clave}
                        fill={`var(--color-${s.clave})`}
                        stackId={apilado ? 'a' : undefined}
                        shape={apilado ? formaApilada(claves, i, horizontal) : undefined}
                        radius={apilado ? undefined : horizontal ? [0, RADIO, RADIO, 0] : [RADIO, RADIO, 0, 0]}
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
