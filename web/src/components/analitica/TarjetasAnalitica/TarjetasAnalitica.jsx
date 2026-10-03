import StatCard from '@/components/ui/StatCard';
import { datosTarjetas } from '../analitica.utils.js';

// Cuatro tarjetas: ausentismo actual, tendencia, proyección y cruce del límite.
export default function TarjetasAnalitica({ resumen, tendencia, proyeccion, cruceLimite, limitePct = 20 }) {
    const d = datosTarjetas({ resumen, tendencia, proyeccion, cruceLimite, limitePct });
    return (
        <section aria-label="Indicadores del análisis" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Ausentismo actual" value={d.actual.valor} hint={d.actual.nota} tone={d.actual.tono} />
            <StatCard label="Tendencia semanal" value={d.tendencia.valor} hint={d.tendencia.nota} tone={d.tendencia.tono} />
            <StatCard label="Proyección al cierre" value={d.proyeccion.valor} hint={d.proyeccion.nota} tone={d.proyeccion.tono} />
            <StatCard label="Cruce del límite" value={d.cruce.valor} hint={d.cruce.nota} tone={d.cruce.tono} />
        </section>
    );
}
