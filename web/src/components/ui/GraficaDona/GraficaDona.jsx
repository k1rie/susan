'use client';

import { Label, Pie, PieChart } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/shadcn/chart.jsx';
import { sumar } from '@/lib/graficas.js';

// Dona con total al centro y leyenda (shadcn chart). `datos` = [{ clave, valor }]; `config` = configuración de ChartContainer
// (etiquetas y colores por clave; ver CONFIG_ASISTENCIA). Los valores 0 no dibujan sector pero siguen en la leyenda.
// `centro` = { valor, etiqueta } sobrescribe el total del centro (p. ej. un porcentaje). Sin datos muestra un aviso, no un hueco.
export default function GraficaDona({ datos, config, centro, alto = 240, vacio = 'Sin datos para graficar', className }) {
    const total = sumar(datos);
    if (!datos?.length || total <= 0) {
        return <p className="flex items-center justify-center rounded-lg bg-muted/60 text-sm text-muted-foreground" style={{ height: alto }}>{vacio}</p>;
    }
    const filas = datos.map((d) => ({ ...d, fill: `var(--color-${d.clave})` }));
    const principal = centro?.valor ?? total;
    const etiqueta = centro?.etiqueta ?? 'Total';
    return (
        <ChartContainer config={config} className={className ?? 'mx-auto w-full'} style={{ height: alto, aspectRatio: 'auto' }}>
            <PieChart accessibilityLayer>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="clave" />} />
                <Pie data={filas.filter((f) => f.valor > 0)} dataKey="valor" nameKey="clave" innerRadius="58%" outerRadius="86%" strokeWidth={3} paddingAngle={2} cornerRadius={4}>
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
                <ChartLegend content={<ChartLegendContent nameKey="clave" />} />
            </PieChart>
        </ChartContainer>
    );
}
