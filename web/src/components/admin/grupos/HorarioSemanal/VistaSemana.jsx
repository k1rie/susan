import { DIAS } from '../HorarioEditor/horarioEditor.utils.js';
import { bloquesPorDia, diaCorto } from './horarioSemanal.utils.js';

// Vista semanal compacta del horario: una columna por día (lunes a sábado) con sus clases. Se hizo aparte de `ui/TiraSemana` a propósito:
// esa tira es un mapa de calor que tiñe cada casilla con el color de AUSENCIA según su valor, y pintar así las horas de clase leería como
// una mala noticia. Aquí el color es neutro y la hora siempre va escrita (cada día dice su texto completo para lectores de pantalla).
export default function VistaSemana({ franjas }) {
    const porDia = bloquesPorDia(franjas);
    return (
        <section aria-label="Vista semanal del horario" className="rounded-xl bg-muted/50 p-3">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Vista semanal</h3>
            <ol className="grid grid-cols-6 gap-1.5">
                {DIAS.map((d) => {
                    const bloques = porDia[d.value];
                    return (
                        <li key={d.value} className="flex min-w-0 flex-col items-stretch gap-1 text-center" data-dia={d.value}>
                            <span aria-hidden="true" className="text-[11px] font-medium text-muted-foreground">
                                {diaCorto(d.value)}
                            </span>
                            <span className="sr-only">
                                {d.label}: {bloques.length ? bloques.map((b) => `${b.inicio} a ${b.fin}`).join(', ') : 'sin clase'}
                            </span>
                            {bloques.length === 0 ? (
                                <span aria-hidden="true" className="py-2 text-xs text-muted-foreground">
                                    –
                                </span>
                            ) : (
                                bloques.map((b) => (
                                    <span
                                        key={`${b.clave}-${b.inicio}`}
                                        aria-hidden="true"
                                        className="rounded-md bg-tono-azul px-0.5 py-1 text-[11px] leading-tight font-medium tabular-nums text-tono-azul-fg"
                                    >
                                        {b.inicio}
                                        <br />
                                        {b.fin}
                                    </span>
                                ))
                            )}
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
