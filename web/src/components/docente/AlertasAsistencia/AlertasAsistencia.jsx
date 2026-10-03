import clsx from 'clsx';
import { TriangleAlert } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Detalles from '@/components/ui/Detalles';
import EmptyState from '@/components/ui/EmptyState';
import TarjetaFila from '@/components/ui/TarjetaFila';
import { partirLista } from '../PanelDocente/panelDocente.utils.js';
import { conteoAlertas, progresoFaltas, sinDerecho, subtituloAlerta } from './alertasAsistencia.utils.js';

const VISIBLES = 5;

// Una fila compacta por alumno: nombre, grupo y matrícula, insignia del tipo y barra de faltas contra el límite. El mensaje
// largo del servidor se quitó: solo repetía lo que dice la insignia («Sin derecho a examen» / «A una falta del límite»).
function FilaAlerta({ alerta: a }) {
    const critica = sinDerecho(a);
    const { ancho, excede, texto, valido } = progresoFaltas(a.porcentaje_faltas, a.limite_pct);
    return (
        <TarjetaFila
            icono={TriangleAlert}
            tono={critica ? 'rosa' : 'dorado'}
            titulo={a.nombre}
            subtitulo={subtituloAlerta(a)}
            className="items-start"
        >
            <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge tone={critica ? 'danger' : 'warning'}>{critica ? 'Sin derecho a examen' : 'A una falta del límite'}</Badge>
                <span className="text-xs tabular-nums text-muted-foreground">{texto}</span>
            </span>
            {valido && (
                <span
                    role="progressbar"
                    aria-label={`Faltas de ${a.nombre}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(ancho)}
                    aria-valuetext={texto}
                    className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted"
                >
                    <span className={clsx('block h-full rounded-full', excede ? 'bg-ausente' : 'bg-retardo')} style={{ width: `${ancho}%` }} />
                </span>
            )}
        </TarjetaFila>
    );
}

const claveDe = (a) => `${a.tipo}-${a.id_grupo}-${a.id_alumno}`;

// Alertas RN-11: alumnos sin derecho a examen o a una falta del límite. Las 5 primeras a la vista; el resto, plegado.
export default function AlertasAsistencia({ alertas = [] }) {
    const { total, sinDerecho: sin, enLimite } = conteoAlertas(alertas);
    const { visibles, resto } = partirLista(alertas, VISIBLES);
    return (
        <section aria-labelledby="t-alertas">
            <h2 id="t-alertas" className="text-xl font-semibold tracking-tight">Alertas de asistencia</h2>
            {total > 0 && <p className="mb-4 mt-1 text-sm text-muted-foreground">{sin} sin derecho · {enLimite} al límite</p>}
            {total === 0 ? (
                <EmptyState className="mt-4" title="Sin alertas" description="Nadie está cerca del límite de faltas." />
            ) : (
                <div className="flex flex-col gap-3">
                    <ul className="flex flex-col gap-3">
                        {visibles.map((a) => (
                            <li key={claveDe(a)}>
                                <FilaAlerta alerta={a} />
                            </li>
                        ))}
                    </ul>
                    {resto.length > 0 && (
                        <Detalles titulo={`Ver las ${resto.length} restantes`}>
                            <ul className="flex flex-col gap-3">
                                {resto.map((a) => (
                                    <li key={claveDe(a)}>
                                        <FilaAlerta alerta={a} />
                                    </li>
                                ))}
                            </ul>
                        </Detalles>
                    )}
                </div>
            )}
        </section>
    );
}
