'use client';

import { useMemo } from 'react';
import GraficaBarras from '@/components/ui/GraficaBarras';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_PATRON, datosPatron, datosPatronBarras, fmtPct, resumenTextoPatron } from '../analitica.utils.js';

// Tasa de ausentismo por día de la semana; el día crítico va en otra serie (color y leyenda propios), no solo en rojo.
export default function PatronSemanal({ patronSemanal }) {
    const filas = useMemo(() => datosPatronBarras(patronSemanal), [patronSemanal]);
    const dias = useMemo(() => datosPatron(patronSemanal), [patronSemanal]);
    const critico = patronSemanal?.nombreDiaCritico;
    return (
        <TarjetaGrafica
            titulo="Ausentismo por día de la semana"
            descripcion={dias.length === 0 ? undefined : critico ? `Día crítico: ${critico}` : 'Sin un día claramente crítico'}
            resumen={resumenTextoPatron(patronSemanal)}
            pie={
                dias.length === 0 ? undefined : (
                    <p>
                        {dias.map((d, i) => (
                            <span key={d.dia}>
                                {i > 0 && ' · '}
                                {d.dia} {d.tasa == null ? '-' : fmtPct(d.tasa, 0)}
                                {d.critico && <strong className="text-ausente"> (crítico)</strong>}
                            </span>
                        ))}
                    </p>
                )
            }
        >
            <GraficaBarras
                datos={filas}
                ejeX="dia"
                series={[{ clave: 'normal' }, { clave: 'critico' }]}
                config={CONFIG_PATRON}
                apilado
                unidad=" %"
                leyenda={Boolean(critico)}
                alto={240}
                vacio="Sin sesiones cerradas para calcular el patrón."
            />
        </TarjetaGrafica>
    );
}
