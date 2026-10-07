import clsx from 'clsx';
import { Check, CircleAlert } from 'lucide-react';
import { CLASE_CIRCULO, CLASE_SEGMENTO, normalizarPasos, TEXTO_ESTADO, textoPaso } from './stepper.utils.js';

// Progreso de un flujo de varios pasos. Referencias: barra segmentada y «Paso N de M» de Calendly, Zillow y Gusto; palomitas de Stripe y
// DoorDash; en el teléfono, la misma barra segmentada del asistente de registro facial (docs/design/SISTEMA.md).
//
//   steps    [{ id, label, description?, estado?: 'hecho' | 'actual' | 'pendiente' | 'error' | 'omitido', disabled? }]. Sin `estado`, se
//            deduce de `current`. Un paso con `estado: 'error'` lleva icono de alerta (no solo color).
//   current  id del paso actual (o su índice).
//   onSelect (id) => void, opcional. Hace clic en los pasos ya recorridos (o con error); los pendientes y los `disabled` no se pueden abrir.
//   compact  undefined (por omisión): barra segmentada + «Paso 2 de 4 · Horario» por debajo de 640 px y círculos con nombre desde ahí;
//            true: siempre la versión compacta (indicador, sin clic); false: siempre la versión ancha.
// La versión compacta es solo informativa (un segmento de 6 px no es un blanco táctil): para volver atrás el flujo ofrece «Atrás».
export default function Stepper({ steps, current, onSelect, compact, label = 'Progreso', className }) {
    const { pasos, indiceActual, total } = normalizarPasos(steps, current);
    const paso = pasos[indiceActual];
    const claseCompacta = compact === false ? 'hidden' : compact === true ? '' : 'sm:hidden';
    const claseAncha = compact === true ? 'hidden' : compact === false ? 'flex' : 'hidden sm:flex';

    return (
        <nav aria-label={label} className={clsx('flex flex-col gap-2', className)}>
            {paso && <p className={clsx('text-xs font-medium text-muted-foreground', claseCompacta)}>{textoPaso(indiceActual, total, paso.label)}</p>}
            <ol className="flex items-center gap-1.5 sm:gap-2">
                {pasos.map((p, i) => {
                    const actual = p.estado === 'actual';
                    const navegable = Boolean(onSelect) && !p.disabled && (p.estado === 'hecho' || p.estado === 'error' || p.estado === 'omitido' || actual);
                    const circulo = (
                        <span
                            aria-hidden="true"
                            className={clsx(
                                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors duration-300',
                                CLASE_CIRCULO[p.estado] ?? CLASE_CIRCULO.pendiente,
                            )}
                        >
                            {p.estado === 'hecho' ? (
                                <Check className="size-3.5" strokeWidth={2.5} />
                            ) : p.estado === 'error' ? (
                                <CircleAlert className="size-3.5" strokeWidth={2} />
                            ) : (
                                i + 1
                            )}
                        </span>
                    );
                    const estadoTexto = TEXTO_ESTADO[p.estado] ?? '';
                    const etiqueta = (
                        <>
                            <span className={clsx('min-w-0 truncate text-sm', actual ? 'font-medium text-foreground' : 'text-muted-foreground')}>{p.label}</span>
                            <span className="sr-only">{`, ${estadoTexto}`}</span>
                        </>
                    );
                    return (
                        <li key={p.id} aria-current={actual ? 'step' : undefined} className="min-w-0 flex-1">
                            <span aria-hidden="true" className={clsx('block h-1.5 rounded-full transition-colors duration-300', claseCompacta, CLASE_SEGMENTO[p.estado] ?? CLASE_SEGMENTO.pendiente)} />
                            <div className={clsx('w-full items-center gap-2', claseAncha)}>
                                {navegable ? (
                                    <button
                                        type="button"
                                        onClick={() => onSelect(p.id)}
                                        className="-m-1 flex min-w-0 items-center gap-2 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                                    >
                                        {circulo}
                                        {etiqueta}
                                    </button>
                                ) : (
                                    <div className="flex min-w-0 items-center gap-2">
                                        {circulo}
                                        {etiqueta}
                                    </div>
                                )}
                                {i < pasos.length - 1 && <span aria-hidden="true" className={clsx('h-px min-w-3 flex-1 transition-colors duration-300', p.estado === 'hecho' ? 'bg-foreground' : 'bg-border')} />}
                            </div>
                            <span className={clsx('sr-only', claseCompacta)}>{`${p.label}, ${estadoTexto}`}</span>
                        </li>
                    );
                })}
            </ol>
            {paso?.description && <p className="text-[13px] text-muted-foreground">{paso.description}</p>}
        </nav>
    );
}
