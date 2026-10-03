'use client';

import { memo } from 'react';
import GraficaBarras from '@/components/ui/GraficaBarras';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_FALTAS, datosGraficaAlertas, mismaGrafica, resumenAlertas } from './graficaAlertas.utils.js';

// «Faltas vs límite»: los alumnos en alerta frente a la línea del límite (RN-11). Solo se pinta cuando hay alertas.
// Memoizada por lo que dibuja: un refetch del panel trae arreglos nuevos y no debe reanimar las barras si nada cambió.
function GraficaAlertas({ alertas = [] }) {
    const { datos, limite, dominio, graficables } = datosGraficaAlertas(alertas);
    if (datos.length === 0) return null;
    // Alto proporcional al número de barras para que cada nombre quepa sin amontonarse.
    const alto = Math.max(160, 56 + datos.length * 34);
    return (
        <TarjetaGrafica
            titulo="Faltas vs límite"
            descripcion="Faltas equivalentes de los alumnos en alerta"
            resumen={resumenAlertas(datos, limite)}
            pie={graficables > datos.length ? `Se muestran los ${datos.length} con más faltas.` : undefined}
        >
            <GraficaBarras
                horizontal
                datos={datos}
                ejeX="alumno"
                series={[{ clave: 'faltas' }]}
                config={CONFIG_FALTAS}
                unidad=" %"
                dominio={dominio}
                limite={limite ? { valor: limite, etiqueta: `Límite ${limite} %` } : undefined}
                alto={alto}
            />
        </TarjetaGrafica>
    );
}

export default memo(GraficaAlertas, (previo, nuevo) => mismaGrafica(previo.alertas, nuevo.alertas));
