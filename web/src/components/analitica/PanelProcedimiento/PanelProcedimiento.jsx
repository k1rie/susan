'use client';

import PasoView from './PasoView.jsx';
import TablaIteraciones from '../TablaIteraciones';
import { seccionesProcedimiento } from '../analitica.utils.js';

// Acordeón didáctico: una sección por procedimiento numérico (regresión, bisección, Newton, CUSUM...).
export default function PanelProcedimiento({ procedimientos = [] }) {
    const secciones = seccionesProcedimiento(procedimientos);
    return (
        <section aria-label="Procedimiento numérico" className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-base font-semibold">Procedimiento paso a paso</h2>
            <p className="mb-3 text-xs text-muted-foreground">Los cálculos que sustentan cada resultado, con sus tablas intermedias.</p>
            {secciones.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay procedimientos disponibles para este grupo.</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {secciones.map((s) => (
                        <details key={s.id} className="rounded-md border border-border">
                            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">{s.titulo}</summary>
                            <div className="flex flex-col gap-4 border-t border-border p-3">
                                {(s.pasos || []).map((p, i) => (
                                    <PasoView key={i} paso={p} />
                                ))}
                                {s.traza?.length > 0 && <TablaIteraciones traza={s.traza} caption="Iteraciones con error por iteración" />}
                            </div>
                        </details>
                    ))}
                </div>
            )}
        </section>
    );
}
