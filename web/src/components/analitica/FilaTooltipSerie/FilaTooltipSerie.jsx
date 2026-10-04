import { colorGrafica } from '@/lib/graficas.js';
import { textoValorSerie } from '../analitica.utils.js';
import MuestraSerie from '../MuestraSerie';

// Fila del tooltip de las gráficas de serie: la banda ("intervalo") se escribe como rango [inferior, superior], un valor faltante
// como guion y el resto como porcentaje con un decimal, igual que las cifras de la pantalla.
export default function FilaTooltipSerie({ etiqueta, valor, color, forma }) {
    return (
        <div className="flex w-full items-center gap-2">
            <MuestraSerie forma={forma} color={color} />
            <span className="min-w-0 flex-1 text-muted-foreground">{etiqueta}</span>
            <span className="whitespace-nowrap font-medium tabular-nums text-foreground">{textoValorSerie(valor)}</span>
        </div>
    );
}

/**
 * `renderFila` de GraficaLinea: `config` (CONFIG_SERIE o CONFIG_ACUMULADO) da la forma de cada serie por su clave. El color es el
 * mismo con el que la gráfica pinta la serie (colorGrafica), así que la muestra del tooltip coincide con la línea.
 */
export function renderFilaSerie(config) {
    function renderFila({ serie, valor }) {
        const c = config[serie?.clave];
        return <FilaTooltipSerie etiqueta={serie?.etiqueta ?? c?.label ?? serie?.clave} valor={valor} color={colorGrafica(serie?.color ?? c?.color)} forma={c?.forma} />;
    }
    return renderFila;
}
