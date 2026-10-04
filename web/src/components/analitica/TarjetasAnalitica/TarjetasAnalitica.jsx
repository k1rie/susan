import { Flag, Gauge, ShieldAlert, TrendingUp } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { datosTarjetas, seriesTarjetas } from '../analitica.utils.js';

// Franja de cifras clave del grupo: ausentismo actual, proyección, semana de cruce del límite y alumnos en riesgo.
// La dirección y la pendiente de la tendencia viven en la descripción de la gráfica semanal (GraficaSerie).
// La línea de tendencia de una tarjeta solo se dibuja con una serie OBSERVADA que ya llega por props (ver seriesTarjetas): el
// ausentismo actual con las tasas semanales y el cruce con el acumulado. La proyección es una estimación y los alumnos en riesgo no
// tienen historial, así que esas dos van sin línea.
// Cuadrícula: una columna por debajo de 480 px y cuatro solo desde xl (no lg) a propósito. Con icono + cifra + apoyo + línea de
// tendencia, una tarjeta necesita ~200 px de ancho útil: a 360 px una de media pantalla deja ~126 px (la cifra aplastaría la línea),
// y a 1024-1279 px cuatro columnas dan ~170 px por tarjeta (misma aplastada). A una columna (~296 px útiles a 360 px) el icono, la
// cifra, el apoyo y la línea conviven sin recortes; de 480 px a 1279 px van de dos en dos y en escritorio ancho de cuatro en cuatro.
export default function TarjetasAnalitica({ resumen, tendencia, proyeccion, cruceLimite, limitePct = 20 }) {
    const d = datosTarjetas({ resumen, proyeccion, cruceLimite, limitePct });
    const serie = seriesTarjetas({ tendencia, cruceLimite });
    return (
        <section aria-label="Indicadores del análisis" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Gauge} label="Ausentismo actual" value={d.actual.valor} unit={d.actual.unidad} hint={d.actual.nota} tone={d.actual.tono} serie={serie.actual} />
            <StatCard icon={TrendingUp} label="Proyección al cierre" value={d.proyeccion.valor} unit={d.proyeccion.unidad} hint={d.proyeccion.nota} tone={d.proyeccion.tono} />
            <StatCard icon={Flag} label="Cruce del límite" value={d.cruce.valor} hint={d.cruce.nota} tone={d.cruce.tono} serie={serie.cruce} />
            <StatCard icon={ShieldAlert} label="Alumnos en riesgo" value={d.riesgo.valor} hint={d.riesgo.nota} tone={d.riesgo.tono} />
        </section>
    );
}
