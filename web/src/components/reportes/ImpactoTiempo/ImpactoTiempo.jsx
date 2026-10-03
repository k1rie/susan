'use client';

import { ChevronDown, Timer } from 'lucide-react';
import clsx from 'clsx';
import { useId, useState } from 'react';

// Impacto: minutos de pase de lista recuperados. Cifra grande y una línea; SIEMPRE se declara como estimación, y el cálculo
// completo queda plegado (no es lo primero que el docente necesita leer).
export default function ImpactoTiempo({ impacto }) {
    const i = impacto || {};
    const [abierto, setAbierto] = useState(false);
    const id = useId();
    const base = i.minutos_pase_lista_base ?? 5;
    return (
        <section aria-labelledby={`${id}-t`} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-3">
                    <Timer aria-hidden="true" className="size-6 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <div>
                        <h2 id={`${id}-t`} className="text-sm font-medium text-muted-foreground">Impacto en tiempo de clase</h2>
                        <p className="text-3xl font-semibold leading-tight tracking-tight tabular-nums">{i.minutos_recuperados ?? 0} min</p>
                    </div>
                </div>
                <p className="min-w-0 flex-1 basis-56 text-sm text-muted-foreground">
                    Unas {Number(i.horas_recuperadas ?? 0).toFixed(1)} h recuperadas.{' '}
                    <span className="font-medium text-foreground">Estimación, no una medición.</span>
                </p>
                <button
                    type="button"
                    aria-expanded={abierto}
                    aria-controls={`${id}-c`}
                    onClick={() => setAbierto((v) => !v)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                >
                    Cómo se calcula
                    <ChevronDown aria-hidden="true" className={clsx('size-4 transition-transform duration-200', abierto && 'rotate-180')} strokeWidth={1.75} />
                </button>
            </div>
            <p id={`${id}-c`} hidden={!abierto} className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                {i.sesiones_automaticas ?? 0} sesiones automáticas × {base} min de pase de lista manual. Del total de {i.sesiones_cerradas ?? 0} cerradas,{' '}
                {i.sesiones_manuales ?? 0} fueron manuales y no suman.
            </p>
        </section>
    );
}
