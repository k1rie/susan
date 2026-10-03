'use client';

import { memo } from 'react';
import GraficaBarras from '@/components/ui/GraficaBarras';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import {
    CLAVES_ACTIVIDAD,
    CONFIG_ACTIVIDAD,
    actividadReconocimiento,
    mismosValores,
    resumenActividad,
} from '../MonitorSesion/monitorSesion.utils.js';

// Capturas, detecciones y detecciones válidas de la sesión. Memoizada por valor (ver GraficaAsistenciaSesion): el sondeo de 5 s
// no debe reanimar las barras si las cifras siguen igual.
function GraficaActividadSesion({ totales }) {
    const actividad = actividadReconocimiento(totales);
    return (
        <TarjetaGrafica titulo="Actividad de reconocimiento" descripcion="Capturas y detecciones de esta sesión" resumen={resumenActividad(actividad)}>
            <GraficaBarras
                horizontal
                datos={actividad}
                ejeX="etapa"
                series={[{ clave: 'cantidad' }]}
                config={CONFIG_ACTIVIDAD}
                alto={150}
                leyenda={false}
                vacio="Aún sin capturas"
            />
        </TarjetaGrafica>
    );
}

export default memo(GraficaActividadSesion, (previo, nuevo) => mismosValores(previo.totales, nuevo.totales, CLAVES_ACTIVIDAD));
