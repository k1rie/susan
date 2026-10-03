import { calcularBarra, nivelBarra } from './barraFaltas.utils.js';

const COLOR = { ok: 'bg-presente', limite: 'bg-retardo', excedido: 'bg-ausente' };
const TEXTO = { ok: 'Dentro del límite', limite: 'En el límite', excedido: 'Límite superado' };

// Barra de faltas equivalentes sobre sesiones programadas, con marca en el límite (20 %).
export default function BarraFaltas({ porcentaje, limitePct = 20, superaLimite, enLimite, className = '' }) {
    const b = calcularBarra(porcentaje, limitePct);
    const nivel = nivelBarra(porcentaje, limitePct, { superaLimite, enLimite });
    return (
        <div className={className}>
            <div
                role="progressbar"
                aria-label="Porcentaje de faltas frente al límite"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(b.pct * 100) / 100}
                aria-valuetext={`${b.pct.toFixed(2)} % de faltas; límite ${b.limite} %. ${TEXTO[nivel]}`}
                data-nivel={nivel}
                className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
            >
                <div className={`h-full ${COLOR[nivel]}`} style={{ width: `${b.relleno}%` }} />
                <div data-testid="marca-limite" className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${b.marca}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
                {b.pct.toFixed(2)} % de faltas · límite {b.limite} % · {TEXTO[nivel]}
            </p>
        </div>
    );
}
