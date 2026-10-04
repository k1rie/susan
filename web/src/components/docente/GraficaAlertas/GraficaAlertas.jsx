import BarrasPildora from '@/components/ui/BarrasPildora';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_FALTAS, datosGraficaAlertas, resumenAlertas } from './graficaAlertas.utils.js';

// «Faltas vs límite»: los alumnos en alerta frente a la línea del límite (RN-11). Solo se pinta cuando hay alertas.
// Un refetch del panel trae arreglos nuevos, pero BarrasPildora no reinicia su entrada al cambiar los datos: las barras
// que cambian se mueven con una transición corta y las demás se quedan quietas.
export default function GraficaAlertas({ alertas = [] }) {
    const { datos, limite, dominio, graficables } = datosGraficaAlertas(alertas);
    if (datos.length === 0) return null;
    return (
        <TarjetaGrafica
            titulo="Faltas vs límite"
            descripcion="Faltas equivalentes de los alumnos en alerta"
            resumen={resumenAlertas(datos, limite)}
            pie={graficables > datos.length ? `Se muestran los ${datos.length} con más faltas.` : undefined}
        >
            {/* En horizontal el alto lo dan las filas: no se pasa `alto`. */}
            <BarrasPildora
                horizontal
                datos={datos}
                ejeX="alumno"
                series={[{ clave: 'faltas' }]}
                config={CONFIG_FALTAS}
                unidad=" %"
                dominio={dominio}
                limite={limite ? { valor: limite, etiqueta: `Límite ${limite} %` } : undefined}
                anchoEjeY={150}
            />
        </TarjetaGrafica>
    );
}
