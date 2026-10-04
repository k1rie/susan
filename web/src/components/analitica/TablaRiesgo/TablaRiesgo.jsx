'use client';

import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useId, useMemo, useState } from 'react';
import AnilloEstados from '@/components/ui/AnilloEstados';
import Badge from '@/components/ui/Badge';
import BarraSegmentada from '@/components/ui/BarraSegmentada';
import BarrasPildora from '@/components/ui/BarrasPildora';
import Detalles from '@/components/ui/Detalles';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { resumenTexto } from '@/lib/graficas.js';
import {
    CONFIG_RIESGO, CONFIG_USO_LIMITE, datosUsoLimite, distribucionRiesgo, ETIQUETA_NIVEL_RIESGO, fmtNum, fmtPct, ordenarRiesgo, resumenTextoTop, tendenciaAlumno, TOP_RIESGO, topRiesgo,
} from '../analitica.utils.js';
import { PasoView } from '../PanelProcedimiento';

const TONO_NIVEL = { alto: 'danger', medio: 'warning', bajo: 'neutral' };
const ICONO_TENDENCIA = { alza: TrendingUp, baja: TrendingDown, estable: Minus };
const COLOR_TENDENCIA = { alza: 'text-ausente', baja: 'text-presente', estable: 'text-muted-foreground' };
// Columnas secundarias: se esconden en pantallas angostas (sus valores van también en el detalle del alumno) pero al
// imprimir se muestran todas.
const OCULTAR = { md: 'hidden md:table-cell print:table-cell', xl: 'hidden xl:table-cell print:table-cell' };
// Objetivo táctil de 44 px en pantallas táctiles; en escritorio basta 36 px para que la tabla no engorde.
const OBJETIVO_TACTIL = 'min-h-11 md:min-h-9';

// `ocultar` = punto de corte desde el que se muestra la columna secundaria.
const COLUMNAS = [
    { key: 'nombre', header: 'Alumno' },
    { key: 'puntaje', header: 'Riesgo' },
    { key: 'tendencia', header: 'Tendencia', ocultar: 'md' },
    { key: 'faltasEq', header: 'Faltas' },
    { key: 'faltasRestantes', header: 'Restantes', ocultar: 'xl' },
    { key: 'cruce', header: 'Cruce (sem.)', ocultar: 'xl' },
];
const ASCENDENTES = new Set(['nombre', 'cruce', 'faltasRestantes']);
// El puntaje se escribe entero en toda la pantalla (tabla y texto alternativo): el ranking no lo muestra con decimales.
const puntajeEntero = (v) => fmtNum(v, 0);

function Tendencia({ alumno }) {
    const t = tendenciaAlumno(alumno);
    if (!t.direccion) return <span className="text-muted-foreground">-</span>;
    const Icono = ICONO_TENDENCIA[t.direccion];
    return (
        <span className={clsx('inline-flex items-center gap-1', COLOR_TENDENCIA[t.direccion])}>
            <Icono aria-hidden="true" className="size-4" strokeWidth={1.75} />
            {t.etiqueta}
        </span>
    );
}

// Alumnos en riesgo: anillo con la distribución por nivel, ranking de píldoras con los 8 de mayor puntaje y la tabla completa plegada
// (ordenable, con la barra de uso del límite de faltas, factores explicables, acción sugerida y procedimiento por alumno).
export default function TablaRiesgo({ items = [], evaluados = null, hrefHistorial }) {
    const titulo = useId();
    const idDetalle = useId();
    const [orden, setOrden] = useState({ clave: 'puntaje', dir: 'desc' });
    const [abierto, setAbierto] = useState(null);
    const filas = useMemo(() => ordenarRiesgo(items, orden.clave, orden.dir), [items, orden]);
    const dist = useMemo(() => distribucionRiesgo(items, evaluados), [items, evaluados]);
    const top = useMemo(() => topRiesgo(items, TOP_RIESGO), [items]);
    const ordenarPor = (clave) => setOrden((o) => (o.clave === clave ? { clave, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { clave, dir: ASCENDENTES.has(clave) ? 'asc' : 'desc' }));
    const aria = (k) => (orden.clave === k ? (orden.dir === 'asc' ? 'ascending' : 'descending') : undefined);
    const sinRiesgo = 'Ningún alumno en riesgo con los datos actuales.';

    return (
        <section aria-labelledby={titulo} className="flex flex-col gap-4">
            <h2 id={titulo} className="text-xl font-semibold tracking-tight">Alumnos en riesgo</h2>
            {dist.total === 0 ? (
                <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{sinRiesgo}</p>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <TarjetaGrafica
                        titulo="Distribución por nivel"
                        descripcion={`${dist.enRiesgo} de ${dist.total} ${dist.total === 1 ? 'alumno' : 'alumnos'} en riesgo medio o alto`}
                        resumen={`Distribución del riesgo, ${resumenTexto(dist.datos, CONFIG_RIESGO)}. ${dist.enRiesgo} en riesgo.`}
                    >
                        <AnilloEstados datos={dist.datos} config={CONFIG_RIESGO} centro={{ valor: dist.enRiesgo, etiqueta: 'en riesgo' }} alto={260} />
                    </TarjetaGrafica>
                    <TarjetaGrafica
                        titulo="Mayor riesgo"
                        descripcion={items.length > TOP_RIESGO ? `Los ${TOP_RIESGO} de mayor puntaje (de ${items.length})` : 'Puntaje de 0 a 100'}
                        resumen={resumenTextoTop(items, TOP_RIESGO)}
                    >
                        {/* En filas la altura la dan las propias filas: no hace falta calcularla por número de alumnos. */}
                        <BarrasPildora
                            horizontal
                            apilado
                            datos={top}
                            ejeX="alumno"
                            series={[{ clave: 'alto' }, { clave: 'medio' }]}
                            config={CONFIG_RIESGO}
                            dominio={[0, 100]}
                            anchoEjeY={150}
                            formatoValor={puntajeEntero}
                            vacio={sinRiesgo}
                        />
                    </TarjetaGrafica>
                </div>
            )}
            {filas.length > 0 && (
                <Detalles titulo="Ver tabla completa" resumen={`${filas.length} ${filas.length === 1 ? 'alumno' : 'alumnos'} en riesgo`}>
                    <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full border-collapse text-sm">
                            <thead className="bg-muted/50 text-xs text-muted-foreground">
                                <tr>
                                    {COLUMNAS.map((c) => (
                                        <th key={c.key} scope="col" aria-sort={aria(c.key)} className={clsx('px-3 py-1 text-left font-medium', c.ocultar && OCULTAR[c.ocultar])}>
                                            <button type="button" onClick={() => ordenarPor(c.key)} className={clsx(OBJETIVO_TACTIL, 'font-medium')}>
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
                                    const idFila = `${idDetalle}-${String(clave).replace(/\s+/g, '_')}`;
                                    const href = hrefHistorial && a.idAlumno != null ? hrefHistorial(a.idAlumno) : null;
                                    const uso = datosUsoLimite(a);
                                    return (
                                        <Fragment key={clave}>
                                            <tr className="border-t border-border align-top">
                                                <td className="min-w-32 px-3 py-2">
                                                    <p className="font-medium">{a.nombre || '-'}</p>
                                                    <p className="text-xs text-muted-foreground">{a.matricula}</p>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Badge tone={TONO_NIVEL[a.nivel]}>{ETIQUETA_NIVEL_RIESGO[a.nivel] || a.nivel}</Badge>
                                                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">{fmtNum(a.puntaje, 0)} / 100</p>
                                                    {a.superaLimite && <p className="text-xs text-ausente">Superó el límite</p>}
                                                </td>
                                                <td className={clsx('px-3 py-2 text-xs', OCULTAR.md)}><Tendencia alumno={a} /></td>
                                                <td className="px-3 py-2 tabular-nums">
                                                    {a.faltasEq} <span className="whitespace-nowrap text-xs text-muted-foreground">({fmtPct(a.porcentajeFaltas)})</span>
                                                    {/* Uso del límite: lo que ya faltó frente a lo que le queda; llena la barra al agotarlo. */}
                                                    {uso && <BarraSegmentada className="mt-1.5 min-w-14" datos={uso.datos} config={CONFIG_USO_LIMITE} alto={6} leyenda={false} etiqueta={uso.etiqueta} />}
                                                </td>
                                                <td className={clsx('px-3 py-2 tabular-nums', OCULTAR.xl)}>{a.faltasRestantes ?? '-'}</td>
                                                <td className={clsx('px-3 py-2 tabular-nums', OCULTAR.xl)}>{a.semanaCruceEstimada ?? '-'}</td>
                                                <td className="px-3 py-2">
                                                    <button
                                                        type="button"
                                                        aria-expanded={expandido}
                                                        aria-controls={expandido ? idFila : undefined}
                                                        aria-label={`${expandido ? 'Ocultar' : 'Ver'} el detalle de ${a.nombre || 'alumno'}`}
                                                        onClick={() => setAbierto(expandido ? null : clave)}
                                                        className={clsx('inline-flex items-center gap-1 text-link', OBJETIVO_TACTIL)}
                                                    >
                                                        Detalle
                                                        <ChevronRight aria-hidden="true" className={clsx('size-4 transition-transform duration-150', expandido && 'rotate-90')} strokeWidth={1.75} />
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandido && (
                                                <tr id={idFila} className="border-t border-border bg-muted/50">
                                                    <td colSpan={COLUMNAS.length + 1} className="max-w-0 px-3 py-3">
                                                        {/* max-w-0 en la celda: el detalle se ajusta al ancho de la tabla en vez de ensancharla */}
                                                        <div className="flex flex-col gap-3 whitespace-normal">
                                                            <p className="text-sm"><strong>Acción sugerida:</strong> {a.accion}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {tendenciaAlumno(a).etiqueta !== '-' && `Tendencia: ${tendenciaAlumno(a).etiqueta.toLowerCase()}. `}
                                                                Faltas restantes: {a.faltasRestantes ?? '-'}. Cruce estimado: {a.semanaCruceEstimada == null ? '-' : `semana ${a.semanaCruceEstimada}`}.
                                                            </p>
                                                            <ul className="flex flex-col gap-1 text-xs">
                                                                {(a.factores || []).map((f) => (
                                                                    <li key={f.id}>
                                                                        <span className="font-medium">{f.nombre}</span>{' '}
                                                                        <span className="tabular-nums text-muted-foreground">({fmtNum(f.aporte, 1)} de {f.maximo})</span>
                                                                        <span className="block text-muted-foreground">{f.explicacion}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                            {href && (
                                                                <Link href={href} className={clsx('inline-flex items-center text-sm text-link underline', OBJETIVO_TACTIL)}>
                                                                    Ver historial del alumno en reportes
                                                                </Link>
                                                            )}
                                                            {(a.pasos || []).length > 0 && (
                                                                <Detalles titulo="Ver el procedimiento del puntaje">
                                                                    <div className="flex flex-col gap-3">
                                                                        {a.pasos.map((p, i) => (
                                                                            <PasoView key={i} paso={p} />
                                                                        ))}
                                                                    </div>
                                                                </Detalles>
                                                            )}
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
                </Detalles>
            )}
        </section>
    );
}
