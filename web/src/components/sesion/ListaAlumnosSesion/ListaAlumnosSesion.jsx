'use client';

import clsx from 'clsx';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Pills from '@/components/ui/Pills';
import StatusChip from '@/components/ui/StatusChip';
import { estadoMostrado, motivoRegistroManual } from '../MonitorSesion/monitorSesion.utils.js';
import { esActivo, metaAlumno, sinRegistro } from './listaAlumnosSesion.utils.js';

// Alumnos de la sesión en curso como lista de filas (nombre, matrícula, estado y, si toca, «Registrar»), no como tabla: cabe en 360 px
// sin desplazarse. Abre en «Sin registro» (quién falta es lo que se revisa) y, si ya no falta nadie, en «Todos».
//   alumnos = de api_sesion_monitor · puedeRegistrar = la sesión admite registro manual · onRegistrar(alumno) abre el diálogo
export default function ListaAlumnosSesion({ alumnos = [], puedeRegistrar = false, onRegistrar, className }) {
    const activos = alumnos.filter(esActivo);
    const faltan = activos.filter(sinRegistro);
    const [filtro, setFiltro] = useState(null);
    const vista = filtro ?? (faltan.length > 0 ? 'faltan' : 'todos');
    const filas = vista === 'faltan' ? faltan : activos;

    return (
        <div className={clsx('flex flex-col gap-3', className)}>
            <Pills
                label="Filtrar alumnos"
                value={vista}
                onChange={setFiltro}
                items={[
                    { id: 'faltan', label: 'Sin registro', count: faltan.length },
                    { id: 'todos', label: 'Todos', count: activos.length },
                ]}
            />
            {filas.length === 0 ? (
                <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                    {activos.length === 0 ? 'El grupo no tiene alumnos inscritos.' : 'Todos los alumnos tienen registro.'}
                </p>
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                    {filas.map((a) => {
                        const motivo = puedeRegistrar && onRegistrar ? motivoRegistroManual(a) : null;
                        // «Sin lecturas válidas» ya lo dicen la etiqueta de estado y «0/3 lecturas»: solo se escribe el motivo que aporta algo
                        // distinto (sin consentimiento vigente, que no se arregla esperando a la cámara).
                        const aviso = motivo && !a.consentimiento_vigente ? motivo : null;
                        return (
                            <li key={a.id_alumno} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                                <div className="min-w-0 flex-1 basis-40">
                                    <p className="truncate text-sm font-medium">{a.nombre}</p>
                                    <p className="text-xs tabular-nums text-muted-foreground">{metaAlumno(a)}</p>
                                    {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
                                </div>
                                <StatusChip kind="asistencia" value={estadoMostrado(a)} size="sm" />
                                {motivo && (
                                    <Button size="sm" variant="secondary" onClick={() => onRegistrar(a)} aria-label={`Registrar manualmente a ${a.nombre}`}>
                                        Registrar
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
