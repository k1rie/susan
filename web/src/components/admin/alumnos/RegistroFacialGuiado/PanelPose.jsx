'use client';

import clsx from 'clsx';
import { Check, ClipboardCopy, Pause, Play, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { RANGOS_POSE } from './registroGuiado.pose.js';

// Etiquetas para marcar las muestras mientras se calibra: lo que la persona dice estar haciendo.
export const ETIQUETAS_POSE = ['libre', 'frente', 'izquierda', 'derecha', 'arriba', 'abajo'];

const grados = (v) => (typeof v === 'number' ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}°` : '—');
const rango = (r) => (r ? `[${r[0]}, ${r[1]}]` : 'libre');

function Fila({ nombre, valor, nota }) {
    return (
        <div className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{nombre}</dt>
            <dd className="text-right font-mono tabular-nums">
                {valor}
                {nota && <span className="ml-2 text-muted-foreground">{nota}</span>}
            </dd>
        </div>
    );
}

// Panel de DEPURACIÓN de la pose (solo modo local; ver PantallaCaptura): lo que mide el servicio en cada muestra, cuánto tarda y
// si entra en el rango del paso. Sirve para calibrar signos y rangos con un rostro real y para vigilar el rendimiento.
//   ultima   -> { pose, angulos, evaluacion, ms, motivo, rostros } de la última comprobación (null si aún no hay)
//   resumen  -> { n, promedioMs, maxMs } de las últimas comprobaciones
//   control  -> { pausa, etiqueta }; onControl(parcial) lo cambia; onCopiar() copia las muestras; onLimpiar() las borra
export default function PanelPose({ clave, ultima, resumen, control, onControl, onCopiar, onLimpiar, total }) {
    const [copiado, setCopiado] = useState(false);
    const copiar = async () => {
        const ok = await onCopiar();
        setCopiado(ok);
        setTimeout(() => setCopiado(false), 2000);
    };
    const rangos = RANGOS_POSE[clave] ?? {};
    const eva = ultima?.evaluacion;
    return (
        <section aria-label="Pose (depuración)" className="w-full max-w-sm rounded-xl border border-dashed border-border bg-muted/40 p-3 text-xs">
            <p className="mb-2 flex items-center justify-between gap-2 font-medium">
                <span>Pose (depuración, solo modo local)</span>
                <span className={clsx('inline-flex items-center gap-1', eva?.ok ? 'text-presente' : 'text-muted-foreground')}>
                    {eva ? eva.ok ? <><Check aria-hidden="true" className="size-3.5" strokeWidth={2} /> En rango</> : <><X aria-hidden="true" className="size-3.5" strokeWidth={2} /> Fuera</> : 'Sin pose'}
                </span>
            </p>
            <dl className="flex flex-col gap-1">
                <Fila nombre="Servicio: giro (yaw)" valor={grados(ultima?.pose?.giro)} />
                <Fila nombre="Servicio: cabeceo (pitch)" valor={grados(ultima?.pose?.cabeceo)} />
                <Fila nombre="Servicio: alabeo (roll)" valor={grados(ultima?.pose?.alabeo)} />
                <Fila nombre="Tú: giro (+ = tu izquierda)" valor={grados(ultima?.angulos?.giro)} nota={rango(rangos.giro)} />
                <Fila nombre="Tú: cabeceo (+ = arriba)" valor={grados(ultima?.angulos?.cabeceo)} nota={rango(rangos.cabeceo)} />
                <Fila
                    nombre="Comprobación"
                    valor={ultima ? `${Math.round(ultima.ms)} ms` : '—'}
                    nota={resumen?.n ? `media ${Math.round(resumen.promedioMs)} · máx ${Math.round(resumen.maxMs)} (n=${resumen.n})` : null}
                />
                {ultima?.motivo && <Fila nombre="Calidad" valor={ultima.motivo} />}
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select
                    aria-label="Etiqueta de las muestras"
                    className="min-h-8 max-w-[8.5rem] text-[13px]"
                    value={control.etiqueta}
                    onChange={(e) => onControl({ etiqueta: e.target.value })}
                    options={ETIQUETAS_POSE.map((v) => ({ value: v, label: v === 'libre' ? 'Etiqueta: libre' : `Hago: ${v}` }))}
                />
                <Button
                    variant="secondary"
                    size="sm"
                    aria-pressed={control.pausa}
                    icon={control.pausa ? <Play aria-hidden="true" className="size-3.5" strokeWidth={1.75} /> : <Pause aria-hidden="true" className="size-3.5" strokeWidth={1.75} />}
                    onClick={() => onControl({ pausa: !control.pausa })}
                >
                    {control.pausa ? 'Reanudar toma automática' : 'Pausar toma automática'}
                </Button>
                <Button variant="secondary" size="sm" icon={<ClipboardCopy aria-hidden="true" className="size-3.5" strokeWidth={1.75} />} onClick={copiar}>
                    {copiado ? 'Copiado' : `Copiar muestras (${total})`}
                </Button>
                <Button variant="ghost" size="sm" icon={<Trash2 aria-hidden="true" className="size-3.5" strokeWidth={1.75} />} onClick={onLimpiar}>
                    Borrar
                </Button>
            </div>
        </section>
    );
}
