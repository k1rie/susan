'use client';

import clsx from 'clsx';
import { ClipboardCheck, ListChecks } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import StatusChip from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { cerrarSesion, paseListaManual } from '@/lib/api/sesiones.js';
import AccionesPaseLista from '../AccionesPaseLista';
import { enfocarPanel } from '../enfocarPanel.js';
import { formatearHoraIso, sugerirEstado } from '../MonitorSesion/monitorSesion.utils.js';
import PasosPaseLista from '../PasosPaseLista';
import { conteoMarcas } from './paseListaManual.utils.js';

const ESTADOS_EDITABLES = ['presente', 'retardo', 'ausente'];
// Un toque marca; otro sobre el mismo lo desmarca. El color acompaña al rótulo (nunca va solo).
const OPCIONES = [
    { value: 'presente', label: 'Presente', activa: 'border-presente bg-presente-bg text-presente' },
    { value: 'retardo', label: 'Retardo', activa: 'border-retardo bg-retardo-bg text-retardo' },
    { value: 'ausente', label: 'Ausente', activa: 'border-ausente bg-ausente-bg text-ausente' },
];

// Los tres estados como botones de alternancia (aria-pressed), a todo el ancho en teléfono: marcar a un alumno es UN toque, no abrir una
// lista desplegable por fila.
function MarcaEstado({ nombre, valor, onChange }) {
    return (
        <div role="group" aria-label={`Estado de ${nombre}`} className="grid w-full grid-cols-3 gap-1.5 sm:w-auto">
            {OPCIONES.map((o) => {
                const marcada = valor === o.value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        aria-pressed={marcada}
                        onClick={() => onChange(marcada ? '' : o.value)}
                        className={clsx(
                            'min-h-11 rounded-md border px-3 text-sm font-medium transition-colors duration-150 sm:min-h-9',
                            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
                            marcada ? o.activa : 'border-input bg-card text-foreground hover:bg-accent',
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

// P-04: pase de lista manual (sesion sin camaras activas, RN-06). `data` = respuesta de api_sesion_monitor. Es el contenido principal de la
// pantalla («Pasar lista (manual)»), con la misma franja de pasos que el pase con camara: se marca a cada alumno (paso 2) y, con todos
// marcados, el paso 3 pasa a ser el actual: guardar y cerrar (una accion primaria y las secundarias, como en la sesion con camara).
//   enfocar = se llego a pasar lista (?pasar-lista=1 o recien abierta): el contenedor recibe el foco al montarse
export default function PaseListaManual({ data, onActualizar, enfocar = false }) {
    const { sesion, alumnos = [] } = data;
    const { toast } = useToast();
    const guardarMut = useApiMutation(paseListaManual);
    const cerrarMut = useApiMutation(cerrarSesion);
    const sugerido = sugerirEstado(sesion);
    const activos = alumnos.filter((a) => !a.inscripcion || a.inscripcion === 'activa');
    const [marcas, setMarcas] = useState(() => Object.fromEntries(activos.filter((a) => ESTADOS_EDITABLES.includes(a.estado)).map((a) => [a.id_alumno, a.estado])));
    const ocupado = guardarMut.loading || cerrarMut.loading;
    const avance = conteoMarcas(activos, marcas);
    const todosMarcados = avance.total > 0 && avance.marcados === avance.total;
    const panelRef = useRef(null);
    useEffect(() => {
        if (enfocar) enfocarPanel(panelRef.current);
    }, [enfocar]);

    const marcarRestantes = () => setMarcas((prev) => Object.fromEntries(activos.map((a) => [a.id_alumno, prev[a.id_alumno] || sugerido])));

    const registros = () => Object.entries(marcas).filter(([, e]) => e).map(([id, estado]) => ({ id_alumno: Number(id), estado }));

    const guardar = async (cerrar) => {
        try {
            const r = await guardarMut.run({ idSesion: sesion.id_sesion, registros: registros() });
            toast({ tone: 'success', title: 'Pase de lista guardado', message: `${r.procesados ?? 0} registros (origen manual).` });
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo guardar el pase de lista', message: e.message });
            return;
        }
        if (cerrar) {
            try {
                await cerrarMut.run({ idSesion: sesion.id_sesion });
                toast({ tone: 'success', title: 'Sesión cerrada' });
            } catch (e) {
                toast({ tone: 'danger', title: 'No se pudo cerrar la sesión', message: e.message });
            }
        }
        onActualizar?.();
    };

    return (
        <div ref={panelRef} tabIndex={-1} className="flex flex-col gap-4 outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
            <PasosPaseLista modo="manual" actual={todosMarcados ? 3 : 2} />

            <section aria-label="Alumnos por marcar" className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <p className="text-sm">
                            Marcados <strong className="font-semibold tabular-nums">{avance.marcados}</strong> de <span className="tabular-nums">{avance.total}</span>
                        </p>
                        <span
                            role="progressbar"
                            aria-label="Alumnos marcados"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(avance.ancho)}
                            aria-valuetext={`${avance.marcados} de ${avance.total}`}
                            className="block h-1.5 w-full max-w-80 overflow-hidden rounded-full bg-muted"
                        >
                            <span className="block h-full rounded-full bg-presente" style={{ width: `${avance.ancho}%` }} />
                        </span>
                        {/* La sugerencia es la misma para todos (sale de la hora): se dice una vez, no en cada fila. */}
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                            Sugerido a esta hora <StatusChip kind="asistencia" value={sugerido} size="sm" />
                        </p>
                    </div>
                    <Button variant="secondary" onClick={marcarRestantes} disabled={ocupado} icon={<ListChecks aria-hidden="true" className="size-5" strokeWidth={1.75} />} className="min-h-12 w-full sm:min-h-10 sm:w-auto">
                        Marcar restantes según la hora
                    </Button>
                </div>

                {activos.length === 0 ? (
                    <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">El grupo no tiene alumnos inscritos.</p>
                ) : (
                    <ul aria-label="Pase de lista manual" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                        {activos.map((a) => (
                            <li key={a.id_alumno} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3">
                                <div className="min-w-0 flex-1 basis-48">
                                    <p className="truncate text-sm font-medium">{a.nombre}</p>
                                    <p className="text-xs tabular-nums text-muted-foreground">{[a.matricula, a.hora_registro && `registrado ${formatearHoraIso(a.hora_registro).slice(0, 5)}`].filter(Boolean).join(' · ')}</p>
                                </div>
                                <MarcaEstado nombre={a.nombre} valor={marcas[a.id_alumno] ?? ''} onChange={(estado) => setMarcas((p) => ({ ...p, [a.id_alumno]: estado }))} />
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <AccionesPaseLista
                primaria={{
                    etiqueta: 'Guardar y cerrar sesión de clase',
                    onClick: () => guardar(true),
                    loading: cerrarMut.loading,
                    disabled: ocupado,
                    icono: <ClipboardCheck aria-hidden="true" className="size-5" strokeWidth={1.75} />,
                }}
                secundarias={[{ etiqueta: 'Guardar', onClick: () => guardar(false), loading: guardarMut.loading && !cerrarMut.loading, disabled: ocupado }]}
                nota="Quien quede sin marcar será ausente al cerrar la sesión."
            />
        </div>
    );
}
