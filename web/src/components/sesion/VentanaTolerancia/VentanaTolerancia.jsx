import { ETIQUETA_FASE } from '../MonitorSesion/monitorSesion.utils.js';
import { geometriaVentana } from './ventanaTolerancia.utils.js';

// Ventana de tolerancia (RN-06) compacta: una barra con el tramo de puntualidad, el de retardo y una marca en el minuto actual.
export default function VentanaTolerancia({ sesion }) {
    const abierta = sesion.estatus === 'abierta';
    const g = geometriaVentana(sesion);
    const fase = abierta ? (ETIQUETA_FASE[sesion.fase] ?? sesion.fase) : null;
    return (
        <section aria-label="Ventana de tolerancia" className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-base font-semibold">Ventana de tolerancia</h2>
                {fase && <span className="text-sm font-medium">{fase}</span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
                {abierta && g.minuto != null ? (
                    <>
                        Minuto <strong className="font-semibold text-foreground">{g.minuto.toFixed(1)}</strong>
                        {g.total != null && ` de ${g.total}`}
                    </>
                ) : (
                    g.total != null && `Tolerancia de ${g.total} min`
                )}
            </p>
            {g.total != null && (
                <>
                    <div
                        role={abierta ? 'progressbar' : undefined}
                        aria-label={abierta ? 'Avance de la ventana de tolerancia' : undefined}
                        aria-valuemin={abierta ? 0 : undefined}
                        aria-valuemax={abierta ? 100 : undefined}
                        aria-valuenow={abierta ? Math.round(g.actual) : undefined}
                        aria-valuetext={abierta && g.minuto != null ? `Minuto ${g.minuto.toFixed(1)} de ${g.total}` : undefined}
                        className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-retardo-bg"
                    >
                        <div className="absolute inset-y-0 left-0 bg-presente-bg" style={{ width: `${g.presente}%` }} />
                        {abierta && g.minuto != null && (
                            <div className="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${g.actual}%` }} />
                        )}
                    </div>
                    <div className="mt-1.5 flex text-xs text-muted-foreground">
                        <span className="truncate" style={{ width: `${g.presente}%` }}>
                            {g.limite != null ? `Presente hasta min ${g.limite}` : 'Presente'}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-right">Retardo hasta min {g.total}</span>
                    </div>
                </>
            )}
        </section>
    );
}
