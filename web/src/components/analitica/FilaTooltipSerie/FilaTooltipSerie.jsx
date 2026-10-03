import { fmtPct, SIN_DATO } from '../analitica.utils.js';
import MuestraSerie from '../MuestraSerie';

// Fila del tooltip de las gráficas de serie: muestra "banda" (intervalo de [inferior, superior]) como rango y el resto
// como porcentaje. El ChartTooltipContent de shadcn imprime los arreglos como "a,b", por eso se arma la fila aquí.
// Mismo formato de porcentaje (un decimal) que las cifras de la pantalla.
export default function FilaTooltipSerie({ etiqueta, valor, color, forma }) {
    const texto = Array.isArray(valor) ? `${fmtPct(valor[0])} a ${fmtPct(valor[1])}` : valor == null ? SIN_DATO : fmtPct(valor);
    return (
        <div className="flex w-full items-center gap-2">
            <MuestraSerie forma={forma} color={color} />
            <span className="flex-1 text-muted-foreground">{etiqueta}</span>
            <span className="font-medium tabular-nums text-foreground">{texto}</span>
        </div>
    );
}

/** Formatter para ChartTooltipContent: `config` da la etiqueta, el color y la forma de cada serie por su dataKey. */
export function formatterSerie(config) {
    function formatear(valor, nombre, item) {
        const serie = config[item?.dataKey];
        return <FilaTooltipSerie etiqueta={serie?.label ?? nombre} valor={valor} color={serie?.color ?? item?.color} forma={serie?.forma} />;
    }
    return formatear;
}
