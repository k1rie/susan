'use client';

import { Check, CheckCheck, ClipboardCheck, Eraser, Search, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import Input from '@/components/ui/Input';
import StatusChip from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import useCambiosSinGuardar from '@/hooks/ui/useCambiosSinGuardar.js';
import { paseListaManual } from '@/lib/api/sesiones.js';
import CierreSesionDialog from '../CierreSesionDialog';
import { enfocarPanel } from '../enfocarPanel.js';
import { sugerirEstado } from '../MonitorSesion/monitorSesion.utils.js';
import FilaAlumnoPase from './FilaAlumnoPase.jsx';
import { conteoMarcas, conteoPorEstado, filtrarAlumnos, primeroSinMarcar, registrosDeMarcas } from './paseListaManual.utils.js';
import usePaseListaManual from './usePaseListaManual.js';

const PUNTOS = [
    { clave: 'presente', etiqueta: 'Presentes', punto: 'bg-presente' },
    { clave: 'retardo', etiqueta: 'Retardos', punto: 'bg-retardo' },
    { clave: 'ausente', etiqueta: 'Ausentes', punto: 'bg-ausente' },
    { clave: 'sinMarcar', etiqueta: 'Sin marcar', punto: 'bg-pendiente' },
];

// P-04: pase de lista manual (sesion sin camaras activas, RN-06). `data` = respuesta de api_sesion_monitor. Es el contenido principal de la
// pantalla («Pasar lista (manual)»), pensado para pasar lista con una mano: cada alumno se marca con UN toque (segmentado Presente / Retardo /
// Ausente), «Todos presentes» resuelve el caso común de un golpe y las acciones quedan pegadas al pie con «N cambios sin guardar».
// Las marcas viven en estado local hasta guardarlas; los payloads y las RPC son los de siempre (api_pase_lista_manual, api_cerrar_sesion).
//   enfocar = se llego a pasar lista (?pasar-lista=1 o recien abierta): el contenedor recibe el foco al montarse
export default function PaseListaManual({ data, onActualizar, enfocar = false }) {
    const { sesion, alumnos = [] } = data;
    const { toast } = useToast();
    const guardarMut = useApiMutation(paseListaManual);
    const sugerido = sugerirEstado(sesion);
    const activos = useMemo(() => alumnos.filter((a) => !a.inscripcion || a.inscripcion === 'activa'), [alumnos]);
    const pase = usePaseListaManual({ activos, sugerido });
    const { marcas } = pase;
    useCambiosSinGuardar(pase.sucio);

    const [busqueda, setBusqueda] = useState('');
    const [cerrando, setCerrando] = useState(false);
    const panelRef = useRef(null);
    const listaRef = useRef(null);
    useEffect(() => {
        if (enfocar) enfocarPanel(panelRef.current);
    }, [enfocar]);

    const avance = conteoMarcas(activos, marcas);
    const porEstado = conteoPorEstado(activos, marcas);
    const visibles = useMemo(() => filtrarAlumnos(activos, busqueda), [activos, busqueda]);
    const buscando = busqueda.trim().length > 0;
    const ocupado = guardarMut.loading;
    const hayMarcas = avance.marcados > 0;

    // Guarda las marcas actuales. Lo compartido entre «Guardar» y «Guardar y cerrar»: lo enviado pasa a ser «lo guardado».
    const guardarMarcas = async () => {
        const instantanea = marcas;
        const r = await guardarMut.run({ idSesion: sesion.id_sesion, registros: registrosDeMarcas(instantanea) });
        pase.confirmarGuardado(instantanea);
        onActualizar?.();
        return r;
    };

    const guardar = async () => {
        try {
            const r = await guardarMarcas();
            toast({ tone: 'success', title: 'Pase de lista guardado', message: `${r.procesados ?? 0} registros (origen manual).` });
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo guardar el pase de lista', message: e.message });
        }
    };

    // Lleva al primer alumno sin marcar: cuando la lista es larga, es el atajo para terminar de pasar lista.
    const irAlPrimeroSinMarcar = () => {
        const primero = primeroSinMarcar(activos, marcas);
        if (!primero) return;
        setBusqueda('');
        window.requestAnimationFrame(() => {
            const fila = listaRef.current?.querySelector(`[data-alumno="${primero.id_alumno}"]`);
            fila?.querySelector('[role="radio"][tabindex="0"]')?.focus({ preventScroll: true });
            const reducido = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            fila?.scrollIntoView?.({ block: 'center', behavior: reducido ? 'auto' : 'smooth' });
        });
    };

    return (
        <div ref={panelRef} tabIndex={-1} className="flex flex-col gap-4 pb-28 outline-none focus-visible:ring-4 focus-visible:ring-ring/30 lg:pb-0">
            <Alert tone="info" title="Sesión en modo manual">
                El aula no tiene cámaras activas. Quien quede sin marcar será ausente al cerrar la sesión.
            </Alert>

            <section aria-label="Avance del pase de lista" className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="text-sm">
                        <strong className="text-base font-semibold tabular-nums">{avance.marcados}</strong> de <span className="tabular-nums">{avance.total}</span> marcados
                    </p>
                    {porEstado.sinMarcar > 0 ? (
                        <Button variant="ghost" size="sm" onClick={irAlPrimeroSinMarcar} className="-mr-2">
                            Ir al primero sin marcar
                        </Button>
                    ) : (
                        avance.total > 0 && (
                            <p className="flex items-center gap-1.5 text-sm font-medium text-presente">
                                <Check aria-hidden="true" className="size-4" strokeWidth={2} />
                                Todos marcados
                            </p>
                        )
                    )}
                </div>
                <span
                    role="progressbar"
                    aria-label="Alumnos marcados"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(avance.ancho)}
                    aria-valuetext={`${avance.marcados} de ${avance.total}`}
                    className="block h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                    <span className="block h-full rounded-full bg-presente" style={{ width: `${avance.ancho}%` }} />
                </span>
                <ul aria-label="Resumen por estado" className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                    {PUNTOS.map((p) => (
                        <li key={p.clave} className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${p.punto}`} />
                            <span className="tabular-nums text-foreground">{porEstado[p.clave]}</span> {p.etiqueta}
                        </li>
                    ))}
                </ul>
                {/* La sugerencia es la misma para todos (sale de la hora): se dice una vez, no en una columna que se oculta en móvil. */}
                <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    Sugerido a esta hora <StatusChip kind="asistencia" value={sugerido} size="sm" />
                </p>
            </section>

            <div className="flex flex-col gap-3">
                <Input
                    type="text"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    aria-label="Buscar alumno por nombre o matrícula"
                    placeholder="Buscar alumno por nombre o matrícula"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    startAdornment={<Search aria-hidden="true" className="size-4 text-muted-foreground" strokeWidth={1.75} />}
                    onClear={() => setBusqueda('')}
                    clearLabel="Borrar búsqueda"
                />
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Button
                        variant="secondary"
                        icon={<CheckCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                        onClick={pase.todosPresentes}
                        disabled={ocupado || porEstado.sinMarcar === 0}
                        className="w-full sm:w-auto"
                    >
                        Todos presentes
                    </Button>
                    <Button
                        variant="ghost"
                        icon={<Eraser aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                        onClick={pase.limpiar}
                        disabled={ocupado || !pase.sucio}
                        title="Quita las marcas que aún no has guardado"
                        className="w-full sm:w-auto"
                    >
                        Limpiar
                    </Button>
                    {/* Con la sugerencia «presente» sería idéntico a «Todos presentes»: no se repite. */}
                    {sugerido !== 'presente' && (
                        <Button
                            variant="secondary"
                            onClick={pase.marcarRestantesSegunHora}
                            disabled={ocupado || porEstado.sinMarcar === 0}
                            className="col-span-2 w-full sm:col-span-1 sm:w-auto"
                        >
                            Marcar restantes según la hora
                        </Button>
                    )}
                </div>
                {/* Región viva fija: el resultado de la acción en bloque se anuncia y se puede deshacer. */}
                <div aria-live="polite" className={pase.aviso ? 'flex flex-wrap items-center gap-x-2 rounded-lg bg-muted px-3 py-1.5 text-sm' : 'sr-only'}>
                    {pase.aviso && (
                        <>
                            <span>{pase.aviso.texto}</span>
                            <button
                                type="button"
                                onClick={pase.deshacer}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                            >
                                <Undo2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                                Deshacer
                            </button>
                        </>
                    )}
                </div>
            </div>

            {activos.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">El grupo no tiene alumnos inscritos.</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {buscando && (
                        <p aria-live="polite" className="text-sm text-muted-foreground">
                            {visibles.length === 0 ? `Ningún alumno coincide con «${busqueda.trim()}».` : `Mostrando ${visibles.length} de ${activos.length} alumnos.`}
                        </p>
                    )}
                    <ul ref={listaRef} aria-label="Alumnos del grupo" className="rounded-xl border border-border bg-card px-4">
                        {visibles.map((a) => (
                            <FilaAlumnoPase key={a.id_alumno} alumno={a} marca={marcas[a.id_alumno]} onMarcar={pase.marcar} />
                        ))}
                    </ul>
                </div>
            )}

            {/* Barra de acciones siempre a la mano. En teléfono va FIJA sobre la barra inferior (no `sticky`: el `overflow-x: hidden` global de
                html y body vuelve a body un contenedor de scroll que nunca desplaza y el `sticky` no se pega; ver requests del frente F6); en
                escritorio se pega al borde inferior del panel que hace scroll, para que con 30 alumnos guardar no quede al final de la lista. */}
            <div className="fixed inset-x-3 bottom-[calc(5.25rem+max(0.75rem,env(safe-area-inset-bottom)))] z-30 mx-auto max-w-[66rem] lg:sticky lg:inset-x-auto lg:bottom-0 lg:z-10 lg:mx-0 lg:max-w-none lg:bg-card">
                <FormActions
                    flat
                    className="rounded-xl border border-border bg-card p-3 lg:rounded-none lg:border-0 lg:border-t lg:px-0 lg:pb-0 lg:pt-4"
                    dirty={pase.cambios}
                    motivoBloqueo={!pase.sucio ? (hayMarcas ? 'Todo lo marcado ya está guardado.' : 'Aún no hay marcas que guardar.') : undefined}
                >
                    {/* El nombre accesible es la frase completa; el texto visible se acorta para que las dos acciones quepan en una fila a 360 px. */}
                    <Button
                        icon={<ClipboardCheck aria-hidden="true" className="size-5" strokeWidth={1.75} />}
                        onClick={() => setCerrando(true)}
                        disabled={ocupado}
                        aria-label="Guardar y cerrar sesión de clase"
                        className="min-h-12 w-full sm:min-h-10 sm:w-auto"
                    >
                        Guardar y cerrar
                    </Button>
                    <Button variant="secondary" onClick={guardar} loading={ocupado} disabled={!pase.sucio} className="min-h-12 w-full sm:min-h-10 sm:w-auto">
                        Guardar
                    </Button>
                </FormActions>
            </div>

            <CierreSesionDialog
                open={cerrando}
                idSesion={sesion.id_sesion}
                modo="manual"
                totales={{ presentes: porEstado.presente, retardos: porEstado.retardo, ausentes: porEstado.ausente, sin_registro: porEstado.sinMarcar, pendientes: 0 }}
                antesDeCerrar={guardarMarcas}
                onCancel={() => setCerrando(false)}
                onCerrada={() => {
                    setCerrando(false);
                    onActualizar?.();
                }}
            />
        </div>
    );
}
