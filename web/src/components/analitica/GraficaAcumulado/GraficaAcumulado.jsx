'use client';

import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { construirSerieAcumulado, MENSAJE_INSUFICIENTE } from '../analitica.utils.js';

const fmt = (v) => (Array.isArray(v) ? `${v[0]} a ${v[1]}` : v == null ? '-' : `${v} %`);

// Faltas equivalentes acumuladas (promedio por alumno, % de las sesiones programadas) frente al límite.
export default function GraficaAcumulado({ cruceLimite, limitePct = 20 }) {
    const datos = useMemo(() => construirSerieAcumulado(cruceLimite), [cruceLimite]);
    const sinDatos = !cruceLimite || cruceLimite.estado === 'insuficiente' || datos.length === 0;
    return (
        <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-base font-semibold">Faltas acumuladas frente al límite</h2>
            {sinDatos ? (
                <p className="mt-2 text-sm text-muted">{MENSAJE_INSUFICIENTE}</p>
            ) : (
                <>
                    <p className="text-xs text-muted">{cruceLimite.mensaje}. Línea roja: límite de {limitePct} %.</p>
                    <div
                        role="img"
                        aria-label={`Faltas equivalentes acumuladas del grupo frente al límite de ${limitePct} por ciento. ${cruceLimite.mensaje}.`}
                        className="mt-3 h-60 w-full"
                    >
                        <ResponsiveContainer width="100%" height={240}>
                            <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                                <XAxis dataKey="semana" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" unit=" %" />
                                <Tooltip formatter={fmt} labelFormatter={(s) => `Semana ${s}`} />
                                <Legend />
                                <Area dataKey="banda" name="Intervalo 95 %" stroke="none" fill="var(--primary)" fillOpacity={0.15} isAnimationActive={false} />
                                <Line dataKey="acumulado" name="Acumulado" stroke="var(--foreground)" strokeWidth={0} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
                                <Line dataKey="ajuste" name="Ajuste" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                                <Line dataKey="proyeccion" name="Proyección" stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
                                <ReferenceLine y={limitePct} stroke="var(--danger)" strokeDasharray="2 2" />
                                {cruceLimite.estado === 'cruza' && cruceLimite.semana != null && <ReferenceLine x={cruceLimite.semana} stroke="var(--danger)" />}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </>
            )}
        </section>
    );
}
