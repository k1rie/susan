'use client';

import { memo } from 'react';
import BarrasPildora from '@/components/ui/BarrasPildora';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import {
    CLAVES_ACTIVIDAD,
    CONFIG_ACTIVIDAD,
    actividadReconocimiento,
    mismosValores,
    resumenActividad,
} from '../MonitorSesion/monitorSesion.utils.js';

// Capturas, detecciones y detecciones válidas de la sesión, en barras de píldora (una fila por etapa). Memoizada por valor (ver
// GraficaAsistenciaSesion): el sondeo de 5 s no debe renderizarla de nuevo si las cifras siguen igual; cuando cambian, las mismas
// barras se mueven a su nuevo largo en lugar de repetir la entrada.
// En filas `alto` solo fija el del aviso vacío (la altura la dan las filas): se deja cerca de lo que miden las tres filas para que la
// tarjeta no salte cuando llega la primera captura.
function GraficaActividadSesion({ totales }) {
    const actividad = actividadReconocimiento(totales);
    return (
        <TarjetaGrafica titulo="Actividad de reconocimiento" descripcion="Capturas y detecciones de esta sesión" resumen={resumenActividad(actividad)}>
            <BarrasPildora
                horizontal
                datos={actividad}
                ejeX="etapa"
                series={[{ clave: 'cantidad' }]}
                config={CONFIG_ACTIVIDAD}
                alto={96}
                leyenda={false}
                vacio="Aún sin capturas"
            />
        </TarjetaGrafica>
    );
}

export default memo(GraficaActividadSesion, (previo, nuevo) => mismosValores(previo.totales, nuevo.totales, CLAVES_ACTIVIDAD));
