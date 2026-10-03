'use client';

import clsx from 'clsx';
import { Label, Pie, PieChart } from 'recharts';
import { ChartContainer, ChartLegend, ChartTooltip, ChartTooltipContent } from '@/components/shadcn/chart.jsx';
import { sumar } from '@/lib/graficas.js';
import useDatosEstables from '@/lib/useDatosEstables.js';

// Dona con total al centro y leyenda con cifras (shadcn chart). `datos` = [{ clave, valor }]; `config` = configuración de
// ChartContainer (etiquetas y colores por clave; ver CONFIG_ASISTENCIA). Los valores 0 no dibujan sector pero SÍ salen en la leyenda
// (atenuados), en el orden de `datos`. `centro` = { valor, etiqueta } sobrescribe el total del centro (p. ej. un porcentaje).
// Sin datos muestra un aviso, no un hueco.
export default function GraficaDona({ datos, config, centro, alto = 240, vacio = 'Sin datos para graficar', className }) {
    const estables = useDatosEstables(datos);
    const total = sumar(estables ?? []);
    if (!estables?.length || total <= 0) {
        return <p className="flex items-center justify-center rounded-lg bg-muted/60 text-sm text-muted-foreground" style={{ height: alto }}>{vacio}</p>;
    }
    const filas = estables.filter((d) => d.valor > 0).map((d) => ({ ...d, fill: `var(--color-${d.clave})` }));
    const principal = centro?.valor ?? total;
    const etiqueta = centro?.etiqueta ?? 'Total';
    return (
        <ChartContainer config={config} className={className ?? 'mx-auto w-full'} style={{ height: alto, aspectRatio: 'auto' }}>
            <PieChart accessibilityLayer>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="clave" />} />
                <Pie data={filas} dataKey="valor" nameKey="clave" innerRadius="58%" outerRadius="86%" strokeWidth={3} paddingAngle={2} cornerRadius={4}>
                    <Label
                        content={({ viewBox }) => {
                            if (!viewBox || !('cx' in viewBox)) return null;
                            return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 4} className="fill-foreground text-3xl font-semibold">{principal}</tspan>
                                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">{etiqueta}</tspan>
                                </text>
                            );
                        }}
                    />
                </Pie>
                <ChartLegend
                    itemSorter={null}
                    content={() => (
                        <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
                            {estables.map((d) => (
                                <li key={d.clave} className={clsx('flex items-center gap-1.5', !(d.valor > 0) && 'opacity-60')}>
                                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px]" style={{ background: `var(--color-${d.clave})` }} />
                                    <span className="text-muted-foreground">{config[d.clave]?.label ?? d.clave}</span>
                                    <span className="font-medium tabular-nums text-foreground">{d.valor}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                />
            </PieChart>
        </ChartContainer>
    );
}
