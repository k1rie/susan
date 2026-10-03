'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import { ETIQUETA_NIVEL_RIESGO, fmtNum, fmtPct, ordenarRiesgo } from '../analitica.utils.js';
import { PasoView } from '../PanelProcedimiento';
import { ArrowDown, ArrowUp } from 'lucide-react';

const TONO_NIVEL = { alto: 'danger', medio: 'warning', bajo: 'neutral' };

const COLUMNAS = [
    { key: 'nombre', header: 'Alumno' },
    { key: 'puntaje', header: 'Puntaje' },
    { key: 'nivel', header: 'Nivel' },
    { key: 'faltasEq', header: 'Faltas eq.' },
    { key: 'faltasRestantes', header: 'Restantes' },
    { key: 'cruce', header: 'Cruce (sem.)' },
];

// Alumnos en riesgo: ordenable, con factores explicables, acción sugerida y procedimiento por alumno.
export default function TablaRiesgo({ items = [], hrefHistorial }) {
    const [orden, setOrden] = useState({ clave: 'puntaje', dir: 'desc' });
    const [abierto, setAbierto] = useState(null);
    const filas = useMemo(() => ordenarRiesgo(items, orden.clave, orden.dir), [items, orden]);
    const ordenarPor = (clave) =>
        setOrden((o) => (o.clave === clave ? { clave, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { clave, dir: clave === 'nombre' || clave === 'cruce' || clave === 'faltasRestantes' ? 'asc' : 'desc' }));
    const aria = (k) => (orden.clave === k ? (orden.dir === 'asc' ? 'ascending' : 'descending') : undefined);

    return (
        <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Alumnos en riesgo</h2>
            {filas.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Ningún alumno en riesgo con los datos actuales.</p>
            ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-max border-collapse text-sm">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                {COLUMNAS.map((c) => (
                                    <th key={c.key} scope="col" aria-sort={aria(c.key)} className="px-3 py-1 text-left font-medium">
                                        <button type="button" onClick={() => ordenarPor(c.key)} className="min-h-11 font-medium">
                                            {c.header}
                                            {orden.clave === c.key && (orden.dir === 'asc' ? <ArrowUp aria-hidden="true" className="ml-1 inline size-3.5" strokeWidth={2} /> : <ArrowDown aria-hidden="true" className="ml-1 inline size-3.5" strokeWidth={2} />)}
                                        </button>
                                    </th>
                                ))}
                                <th scope="col" className="px-3 py-1 text-left font-medium">Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((a) => {
                                const clave = a.idAlumno ?? a.matricula ?? a.nombre;
                                const expandido = abierto === clave;
                                const href = hrefHistorial && a.idAlumno != null ? hrefHistorial(a.idAlumno) : null;
                                return (
                                    <Fragment key={clave}>
                                        <tr className="border-t border-border align-top">
                                            <td className="px-3 py-2">
                                                <p className="font-medium">{a.nombre || '-'}</p>
                                                <p className="text-xs text-muted-foreground">{a.matricula}</p>
                                            </td>
                                            <td className="px-3 py-2 tabular-nums">{fmtNum(a.puntaje, 0)} / 100</td>
                                            <td className="px-3 py-2">
                                                <Badge tone={TONO_NIVEL[a.nivel]}>{ETIQUETA_NIVEL_RIESGO[a.nivel] || a.nivel}</Badge>
                                                {a.superaLimite && <p className="mt-1 text-xs text-ausente">Superó el límite</p>}
                                            </td>
                                            <td className="px-3 py-2 tabular-nums">{a.faltasEq} ({fmtPct(a.porcentajeFaltas)})</td>
                                            <td className="px-3 py-2 tabular-nums">{a.faltasRestantes ?? '-'}</td>
                                            <td className="px-3 py-2 tabular-nums">{a.semanaCruceEstimada ?? '-'}</td>
                                            <td className="px-3 py-2">
                                                <button
                                                    type="button"
                                                    aria-expanded={expandido}
                                                    onClick={() => setAbierto(expandido ? null : clave)}
                                                    className="min-h-11 text-link underline"
                                                >
                                                    {expandido ? 'Ocultar' : 'Ver factores y procedimiento'}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandido && (
                                            <tr className="border-t border-border bg-muted">
                                                <td colSpan={COLUMNAS.length + 1} className="px-3 py-3">
                                                    <div className="flex max-w-[calc(100vw-4rem)] flex-col gap-3 whitespace-normal sm:max-w-3xl">
                                                        <p className="text-sm"><strong>Acción sugerida:</strong> {a.accion}</p>
                                                        <ul className="flex flex-col gap-1 text-sm">
                                                            {(a.factores || []).map((f) => (
                                                                <li key={f.id}>
                                                                    <span className="font-medium">{f.nombre}</span>{' '}
                                                                    <span className="tabular-nums text-muted-foreground">({fmtNum(f.aporte, 1)} de {f.maximo})</span>: {f.explicacion}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        {href && (
                                                            <Link href={href} className="inline-flex min-h-11 items-center text-sm text-link underline">
                                                                Ver historial del alumno en reportes
                                                            </Link>
                                                        )}
                                                        {(a.pasos || []).map((p, i) => (
                                                            <PasoView key={i} paso={p} />
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
