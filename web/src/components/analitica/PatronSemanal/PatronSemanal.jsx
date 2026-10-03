'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { datosPatron } from '../analitica.utils.js';

// Tasa de ausentismo por día de la semana; el día crítico se marca en rojo y con texto.
export default function PatronSemanal({ patronSemanal }) {
    const datos = useMemo(() => datosPatron(patronSemanal), [patronSemanal]);
    return (
        <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Patrón por día de la semana</h2>
            {datos.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Sin sesiones cerradas para calcular el patrón.</p>
            ) : (
                <>
                    <p className="text-xs text-muted-foreground">
                        {patronSemanal.nombreDiaCritico ? `Día crítico: ${patronSemanal.nombreDiaCritico}.` : 'Sin un día claramente crítico.'}
                    </p>
                    <div
                        role="img"
                        aria-label={`Ausentismo por día de la semana. ${patronSemanal.nombreDiaCritico ? `Día crítico: ${patronSemanal.nombreDiaCritico}.` : 'Sin día crítico.'}`}
                        className="mt-3 h-60 w-full"
                    >
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                                <XAxis dataKey="dia" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" unit=" %" />
                                <Tooltip formatter={(v) => (v == null ? '-' : `${v} %`)} />
                                <Bar dataKey="tasa" name="Ausentismo" isAnimationActive={false}>
                                    {datos.map((d) => (
                                        <Cell key={d.dia} fill={d.critico ? 'var(--ausente)' : 'var(--chart-1)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {datos.map((d) => (
                            <li key={d.dia}>
                                {d.dia}: {d.tasa == null ? '-' : `${d.tasa} %`} ({d.ausentes}/{d.sesiones})
                                {d.critico && <strong className="ml-1 text-ausente">Crítico</strong>}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}
