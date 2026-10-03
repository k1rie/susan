'use client';

import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Checkbox from '@/components/ui/Checkbox';
import { construirSerieSemanal, MENSAJE_INSUFICIENTE, resumenTextoSerie } from '../analitica.utils.js';

const fmt = (v) => (Array.isArray(v) ? `${v[0]} a ${v[1]}` : v == null ? '-' : `${v} %`);

// Tasa semanal observada, ajuste de regresión, suavizado y proyección con banda (valores en %).
export default function GraficaSerie({ tendencia, suavizado, proyeccion, resumen, limitePct = 20 }) {
    const [ver, setVer] = useState({ sma: false, ema: true, wma: false });
    const datos = useMemo(() => construirSerieSemanal({ tendencia, suavizado, proyeccion }), [tendencia, suavizado, proyeccion]);
    const alternar = (k) => setVer((v) => ({ ...v, [k]: !v[k] }));
    if (!tendencia?.disponible) {
        return (
            <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold">Ausentismo semanal</h2>
                <p className="mt-2 text-sm text-muted-foreground">{MENSAJE_INSUFICIENTE}</p>
            </section>
        );
    }
    return (
        <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Ausentismo semanal</h2>
            <p className="text-xs text-muted-foreground">Tasa de ausentes sobre inscritos por semana, con ajuste lineal, suavizado y proyección.</p>
            <div role="img" aria-label={resumenTextoSerie({ tendencia, resumen })} className="mt-3 h-60 w-full">
                <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis dataKey="semana" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                        <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" unit=" %" />
                        <Tooltip formatter={fmt} labelFormatter={(s) => `Semana ${s}`} />
                        <Legend />
                        <Area dataKey="banda" name="Intervalo 95 %" stroke="none" fill="var(--chart-1)" fillOpacity={0.15} isAnimationActive={false} />
                        <Line dataKey="observada" name="Observada" stroke="var(--foreground)" strokeWidth={0} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
                        <Line dataKey="ajuste" name="Ajuste" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                        <Line dataKey="proyeccion" name="Proyección" stroke="var(--chart-1)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
                        {ver.sma && <Line dataKey="sma" name="SMA" stroke="var(--presente)" dot={false} isAnimationActive={false} connectNulls />}
                        {ver.ema && <Line dataKey="ema" name="EMA" stroke="var(--retardo)" dot={false} isAnimationActive={false} connectNulls />}
                        {ver.wma && <Line dataKey="wma" name="WMA" stroke="var(--ausente)" dot={false} isAnimationActive={false} connectNulls />}
                        <ReferenceLine y={limitePct} stroke="var(--destructive)" strokeDasharray="2 2" />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <fieldset className="mt-2 flex flex-wrap gap-x-4">
                <legend className="text-xs text-muted-foreground">Medias móviles</legend>
                <Checkbox label="SMA" checked={ver.sma} onChange={() => alternar('sma')} />
                <Checkbox label="EMA" checked={ver.ema} onChange={() => alternar('ema')} />
                <Checkbox label="WMA" checked={ver.wma} onChange={() => alternar('wma')} />
            </fieldset>
        </section>
    );
}
