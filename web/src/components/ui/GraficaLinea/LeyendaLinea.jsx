import MuestraForma from './MuestraForma.jsx';
import { formaDeSerie } from './graficaLinea.utils.js';
import { colorGrafica } from '@/lib/graficas.js';

// Leyenda con la forma de cada serie y, si la etiqueta del límite no cabe dentro de la gráfica (ancho angosto), una entrada para él.
export default function LeyendaLinea({ series, etiquetaLimite }) {
    return (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {series.map((serie) => (
                <li key={serie.clave} className="flex items-center gap-1.5">
                    <MuestraForma forma={formaDeSerie(serie)} color={colorGrafica(serie.color ?? 'var(--g-azul)')} />
                    {serie.etiqueta ?? serie.clave}
                </li>
            ))}
            {etiquetaLimite && (
                <li className="flex items-center gap-1.5">
                    <MuestraForma forma="discontinua" color="var(--destructive)" />
                    <span className="font-medium text-destructive">{etiquetaLimite}</span>
                </li>
            )}
        </ul>
    );
}
