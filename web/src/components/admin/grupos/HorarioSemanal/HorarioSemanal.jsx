'use client';

import { Check, CircleAlert, Copy, Info, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Pills from '@/components/ui/Pills';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { aMinutos, DIAS } from '../HorarioEditor/horarioEditor.utils.js';
import VistaSemana from './VistaSemana.jsx';
import {
    avisoHorasMateria,
    diaCorto,
    DURACIONES,
    duracionFranja,
    finAlCambiarInicio,
    franjaVacia,
    horasPorSemana,
    PLANTILLAS_DIAS,
    resumenFranja,
    sumarMinutos,
    totalMinutos,
    validarFranjas,
} from './horarioSemanal.utils.js';

// Día como chip: se ve «Lun» pero el nombre accesible es «Lunes».
const ITEMS_DIAS = DIAS.map((d) => ({
    id: d.value,
    label: (
        <>
            <span aria-hidden="true">{diaCorto(d.value)}</span>
            <span className="sr-only">{d.label}</span>
        </>
    ),
}));

function Mensaje({ children }) {
    if (!children) return null;
    return (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {children}
        </p>
    );
}

// Editor CONTROLADO del horario semanal (lo usan la pestaña Horario y el paso «Aula y horario» del alta de grupo).
// `value` son franjas { clave, dias: ['1','3'], hora_inicio, hora_fin } (ver horarioSemanal.utils.js); `onChange(franjas)`.
//   - Cada franja es «estos días a esta hora»: elegir tres días genera tres bloques de golpe y todos comparten la hora.
//   - La hora de fin sigue a la de inicio (conserva la duración; por omisión +1 h) y hay duraciones rápidas.
//   - Los errores de orden y traslape se ven al instante; lo que solo falta llenar, después de `mostrarPendientes`.
//   - `vacioValido`: un horario sin franjas es válido (el alta de grupo lo deja para después).
//   - `horasMateria`: horas por semana que declara la materia, para comparar con el total (solo informa).
export default function HorarioSemanal({ value = [], onChange, mostrarPendientes = false, vacioValido = false, horasMateria, disabled = false, className }) {
    const raiz = useRef(null);
    const porEnfocar = useRef(null);
    const { porFranja, general } = validarFranjas(value, { vacioValido });
    const minutos = totalMinutos(value);
    const aviso = avisoHorasMateria(minutos, horasMateria);

    // Tras agregar una franja el foco va a su primer control (sin set-state: solo lee un ref cuando cambia la lista).
    useEffect(() => {
        const destino = porEnfocar.current;
        if (!destino) return;
        porEnfocar.current = null;
        raiz.current?.querySelector(`[data-franja="${destino.clave}"] ${destino.selector}`)?.focus();
    }, [value]);

    const cambiar = (clave, parche) => onChange(value.map((f) => (f.clave === clave ? { ...f, ...parche } : f)));
    const agregar = (props = {}, despuesDe) => {
        const f = franjaVacia(props);
        porEnfocar.current = { clave: f.clave, selector: f.dias.length ? 'input[type="time"]' : 'button[aria-pressed]' };
        if (!despuesDe) return onChange([...value, f]);
        const i = value.findIndex((x) => x.clave === despuesDe);
        return onChange([...value.slice(0, i + 1), f, ...value.slice(i + 1)]);
    };
    const quitar = (clave) => onChange(value.filter((f) => f.clave !== clave));

    const cambiarInicio = (f, nuevo) =>
        cambiar(f.clave, { hora_inicio: nuevo, hora_fin: finAlCambiarInicio({ inicioAntes: f.hora_inicio, finAntes: f.hora_fin, inicioNuevo: nuevo }) });
    const fijarDuracion = (f, minutosNuevos) => {
        const fin = sumarMinutos(f.hora_inicio, Number(minutosNuevos));
        if (fin) cambiar(f.clave, { hora_fin: fin });
    };

    const visible = (e, campo) => (e?.pendientes?.includes(campo) && !mostrarPendientes ? undefined : e?.[campo]);

    return (
        <div ref={raiz} className={className}>
            {value.length === 0 ? (
                <div className="flex flex-col gap-3 rounded-xl border border-dashed border-input p-4">
                    <div>
                        <p className="text-sm font-medium">Aún no hay franjas de horario</p>
                        <p className="text-sm text-muted-foreground">Empieza con una combinación de días y ajusta la hora; con una franja se crean los bloques de todos sus días.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {PLANTILLAS_DIAS.map((p) => (
                            <Button key={p.id} variant="secondary" size="sm" disabled={disabled} onClick={() => agregar({ dias: p.dias })}>
                                {p.label}
                            </Button>
                        ))}
                        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => agregar()}>
                            Elegir otros días
                        </Button>
                    </div>
                    {general.length > 0 && mostrarPendientes && <Mensaje>{general[0]}</Mensaje>}
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <ul className="flex flex-col gap-3">
                        {value.map((f, i) => {
                            const n = i + 1;
                            const e = porFranja[f.clave];
                            const duracion = duracionFranja(f);
                            const actual = duracion != null && DURACIONES.some((d) => Number(d.value) === duracion) ? String(duracion) : '';
                            return (
                                <li key={f.clave} data-franja={f.clave} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold">Franja {n}</h3>
                                            <p className="truncate text-[13px] text-muted-foreground">
                                                {f.dias.length > 0 && duracion != null ? `${resumenFranja(f)} · ${horasPorSemana([f])} por semana` : 'Elige los días y la hora'}
                                            </p>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" disabled={disabled} icon={<Copy aria-hidden="true" className="size-4" strokeWidth={1.75} />} aria-label={`Duplicar la franja ${n}`} onClick={() => agregar({ hora_inicio: f.hora_inicio, hora_fin: f.hora_fin }, f.clave)}>
                                                Duplicar
                                            </Button>
                                            <Button variant="ghost" size="sm" disabled={disabled} icon={<Trash2 aria-hidden="true" className="size-4" strokeWidth={1.75} />} aria-label={`Quitar la franja ${n}`} onClick={() => quitar(f.clave)}>
                                                Quitar
                                            </Button>
                                        </div>
                                    </div>

                                    <Field as="fieldset" label={`Días de la franja ${n}`} error={visible(e, 'dias')}>
                                        <Pills multiple label="Días" items={ITEMS_DIAS} value={f.dias} onChange={(dias) => cambiar(f.clave, { dias })} />
                                    </Field>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field
                                            label={
                                                <>
                                                    Hora de inicio<span className="sr-only"> de la franja {n}</span>
                                                </>
                                            }
                                            error={visible(e, 'inicio')}
                                        >
                                            <Input type="time" value={f.hora_inicio} disabled={disabled} onChange={(ev) => cambiarInicio(f, ev.target.value)} />
                                        </Field>
                                        <Field
                                            label={
                                                <>
                                                    Hora de fin<span className="sr-only"> de la franja {n}</span>
                                                </>
                                            }
                                            error={visible(e, 'fin')}
                                        >
                                            <Input type="time" value={f.hora_fin} disabled={disabled} onChange={(ev) => cambiar(f.clave, { hora_fin: ev.target.value })} />
                                        </Field>
                                    </div>
                                    <Mensaje>{e?.solape}</Mensaje>

                                    <div className="flex flex-col gap-1.5">
                                        <span id={`dur-${f.clave}`} className="text-xs text-muted-foreground">
                                            Duración de cada clase
                                        </span>
                                        <SegmentedControl
                                            size="sm"
                                            label={`Duración de la franja ${n}`}
                                            aria-labelledby={`dur-${f.clave}`}
                                            items={DURACIONES}
                                            value={actual}
                                            disabled={disabled || aMinutos(f.hora_inicio) == null}
                                            onChange={(v) => fijarDuracion(f, v)}
                                        />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <div>
                        <Button variant="secondary" size="sm" disabled={disabled} icon={<Plus aria-hidden="true" className="size-4" strokeWidth={1.75} />} onClick={() => agregar()}>
                            Agregar otra franja
                        </Button>
                    </div>

                    {general.map((m) => (
                        <Mensaje key={m}>{m}</Mensaje>
                    ))}

                    {minutos > 0 && (
                        <div className="flex flex-col gap-1">
                            <p aria-live="polite" className="text-sm">
                                <span className="font-medium">Total: {horasPorSemana(value)} por semana</span>
                            </p>
                            {aviso && (
                                <p className={`flex items-start gap-1.5 text-[13px] ${aviso.tono === 'ok' ? 'text-presente' : 'text-muted-foreground'}`}>
                                    {aviso.tono === 'ok' ? (
                                        <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                                    ) : (
                                        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                                    )}
                                    {aviso.texto}
                                </p>
                            )}
                        </div>
                    )}
                    <VistaSemana franjas={value} />
                </div>
            )}
        </div>
    );
}
