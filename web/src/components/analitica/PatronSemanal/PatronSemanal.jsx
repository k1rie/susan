'use client';

import { useMemo } from 'react';
import Detalles from '@/components/ui/Detalles';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import TiraSemana from '@/components/ui/TiraSemana';
import { datosPatron, datosTiraPatron, fmtPct, indiceDiaCritico, resumenTextoPatron, textoSesiones } from '../analitica.utils.js';

// Anillo del día crítico. TiraSemana solo pone anillo a quien alcanza un límite, y aquí no hay límite (el día crítico es el de mayor
// tasa), así que se pinta sobre su casilla por posición. Las clases van completas (no se arman con plantillas) para que Tailwind las vea.
// Provisional: se cambia por una propiedad de TiraSemana que marque una casilla (ver `solicitudes` del reporte de la migración).
const ANILLO_CRITICO = [
    '[&_li:nth-child(1)]:ring-2 [&_li:nth-child(1)]:ring-destructive/70',
    '[&_li:nth-child(2)]:ring-2 [&_li:nth-child(2)]:ring-destructive/70',
    '[&_li:nth-child(3)]:ring-2 [&_li:nth-child(3)]:ring-destructive/70',
    '[&_li:nth-child(4)]:ring-2 [&_li:nth-child(4)]:ring-destructive/70',
    '[&_li:nth-child(5)]:ring-2 [&_li:nth-child(5)]:ring-destructive/70',
    '[&_li:nth-child(6)]:ring-2 [&_li:nth-child(6)]:ring-destructive/70',
    '[&_li:nth-child(7)]:ring-2 [&_li:nth-child(7)]:ring-destructive/70',
];

// Tasa de ausentismo por día de la semana como mapa de calor: cuanto más rojo, más ausencias, y la cifra va escrita en cada casilla.
// El día crítico (el de mayor tasa) lleva anillo y se nombra en la descripción y en el detalle, no solo en color.
export default function PatronSemanal({ patronSemanal }) {
    const casillas = useMemo(() => datosTiraPatron(patronSemanal), [patronSemanal]);
    const dias = useMemo(() => datosPatron(patronSemanal), [patronSemanal]);
    const critico = patronSemanal?.nombreDiaCritico;
    const indiceCritico = indiceDiaCritico(patronSemanal);
    return (
        <TarjetaGrafica
            titulo="Ausentismo por día de la semana"
            descripcion={dias.length === 0 ? undefined : critico ? `Día crítico: ${critico}` : 'Sin un día claramente crítico'}
            resumen={resumenTextoPatron(patronSemanal)}
            pie={
                dias.length === 0 ? undefined : (
                    <Detalles plano titulo="Ver cifras por día">
                        <ul className="flex flex-col gap-1">
                            {dias.map((d) => (
                                <li key={d.dia}>
                                    <span className="font-medium text-foreground">{d.dia}</span> {d.tasa == null ? 'sin datos' : fmtPct(d.tasa)} ({textoSesiones(d)})
                                    {d.critico && <strong className="text-ausente"> · día crítico</strong>}
                                </li>
                            ))}
                        </ul>
                    </Detalles>
                )
            }
        >
            {/* mx-auto: la tira mide como mucho 7 rem por casilla; en una tarjeta ancha queda centrada en lugar de pegada a la izquierda */}
            <TiraSemana
                datos={casillas}
                unidad=" %"
                vacio="Sin sesiones cerradas para calcular el patrón."
                className={indiceCritico >= 0 ? `mx-auto ${ANILLO_CRITICO[indiceCritico] ?? ''}` : 'mx-auto'}
            />
        </TarjetaGrafica>
    );
}
