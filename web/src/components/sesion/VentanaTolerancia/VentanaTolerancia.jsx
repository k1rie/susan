import { ETIQUETA_FASE } from '../MonitorSesion/monitorSesion.utils.js';

// Ventana de tolerancia (RN-06): minuto actual de la sesion y fase (presente / retardo / fuera de ventana).
export default function VentanaTolerancia({ sesion }) {
    const abierta = sesion.estatus === 'abierta';
    const minuto = Number(sesion.minuto_actual);
    const total = Number(sesion.tolerancia_min);
    const pct = Number.isFinite(minuto) && total > 0 ? Math.min(100, Math.max(0, (minuto / total) * 100)) : 0;
    return (
        <section aria-label="Ventana de tolerancia" className="rounded-3xl border border-border bg-card shadow-soft p-5">
            <h2 className="text-base font-semibold">Ventana de tolerancia</h2>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                    <dt className="text-muted-foreground">Minuto actual</dt>
                    <dd className="font-medium">{abierta && Number.isFinite(minuto) ? minuto.toFixed(1) : '-'}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Presente hasta</dt>
                    <dd className="font-medium">min {sesion.limite_presente_min}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Tolerancia</dt>
                    <dd className="font-medium">{sesion.tolerancia_min} min</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Fase</dt>
                    <dd className="font-medium">{abierta ? (ETIQUETA_FASE[sesion.fase] ?? sesion.fase) : '-'}</dd>
                </div>
            </dl>
            {abierta && (
                <progress className="mt-3 h-2 w-full" max={100} value={pct} aria-label="Avance de la ventana de tolerancia" />
            )}
        </section>
    );
}
