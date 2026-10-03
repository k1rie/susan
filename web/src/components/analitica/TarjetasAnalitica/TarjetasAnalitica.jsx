import StatCard from '@/components/ui/StatCard';
import { datosTarjetas } from '../analitica.utils.js';

// Franja de cifras clave del grupo: ausentismo actual, proyección, semana de cruce del límite y alumnos en riesgo.
// La dirección y la pendiente de la tendencia viven en la descripción de la gráfica semanal (GraficaSerie).
export default function TarjetasAnalitica({ resumen, proyeccion, cruceLimite, limitePct = 20 }) {
    const d = datosTarjetas({ resumen, proyeccion, cruceLimite, limitePct });
    return (
        <section aria-label="Indicadores del análisis" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Ausentismo actual" value={d.actual.valor} hint={d.actual.nota} tone={d.actual.tono} />
            <StatCard label="Proyección al cierre" value={d.proyeccion.valor} hint={d.proyeccion.nota} tone={d.proyeccion.tono} />
            <StatCard label="Cruce del límite" value={d.cruce.valor} hint={d.cruce.nota} tone={d.cruce.tono} />
            <StatCard label="Alumnos en riesgo" value={d.riesgo.valor} hint={d.riesgo.nota} tone={d.riesgo.tono} />
        </section>
    );
}
