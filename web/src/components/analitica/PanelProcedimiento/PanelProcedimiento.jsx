'use client';

import Detalles from '@/components/ui/Detalles';
import PasoView from './PasoView.jsx';
import TablaIteraciones from '../TablaIteraciones';
import { seccionesProcedimiento } from '../analitica.utils.js';

// Los cálculos que sustentan cada resultado (regresión, bisección, Newton, CUSUM...), plegados: una divulgación general y
// otra por procedimiento, y las iteraciones largas en la suya. Al imprimir se muestran completos (Detalles).
export default function PanelProcedimiento({ procedimientos = [] }) {
    const secciones = seccionesProcedimiento(procedimientos);
    return (
        <section aria-label="Procedimiento numérico">
            {secciones.length === 0 ? (
                <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Aún no hay procedimientos disponibles para este grupo.</p>
            ) : (
                <Detalles titulo="Ver el procedimiento paso a paso" resumen={`${secciones.length} cálculos con sus tablas intermedias`}>
                    <div className="flex flex-col gap-2">
                        {secciones.map((s) => (
                            <Detalles key={s.id} titulo={s.titulo}>
                                <div className="flex flex-col gap-4">
                                    {(s.pasos || []).map((p, i) => (
                                        <PasoView key={i} paso={p} />
                                    ))}
                                    {s.traza?.length > 0 && (
                                        <Detalles titulo="Ver las iteraciones" resumen={`${s.traza.length} ${s.traza.length === 1 ? 'iteración' : 'iteraciones'}`}>
                                            <TablaIteraciones traza={s.traza} />
                                        </Detalles>
                                    )}
                                </div>
                            </Detalles>
                        ))}
                    </div>
                </Detalles>
            )}
        </section>
    );
}
