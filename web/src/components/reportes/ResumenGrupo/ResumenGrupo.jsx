'use client';

import { ArrowRight } from 'lucide-react';
import GraficaBarras from '@/components/ui/GraficaBarras';
import GraficaDona from '@/components/ui/GraficaDona';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_ASISTENCIA, resumenTexto } from '@/lib/graficas.js';
import IndicadoresGrupo from '../IndicadoresGrupo';
import ImpactoTiempo from '../ImpactoTiempo';
import {
    alumnosFueraDelTop, centroDonaGrupo, distribucionAsistencia, dominioFaltas, limiteFaltas, resumenSerie, topFaltasAlumnos, TOP_ALUMNOS,
} from '../graficas';

const CONFIG_FALTAS = { faltas: { label: 'Faltas', color: 'var(--ausente)' } };
const ALTO_FILA = 34;

// Pestaña "Resumen" de un grupo (o de un alumno del grupo): cuatro indicadores, dona de estados, faltas frente al límite
// e impacto en tiempo. `filas` ya viene filtrada por alumno cuando hay uno seleccionado.
export default function ResumenGrupo({ reporte, filas = [], impacto, nombreAlumno, onVerDetalle }) {
    const kpis = reporte?.kpis || {};
    const sinSesiones = kpis.sesiones_programadas === 0;
    const limite = limiteFaltas(reporte);
    const distribucion = distribucionAsistencia(filas);
    const top = sinSesiones ? [] : topFaltasAlumnos(filas, TOP_ALUMNOS);
    const fuera = sinSesiones ? 0 : alumnosFueraDelTop(filas, TOP_ALUMNOS);
    // `kpis` es del grupo completo: con un alumno seleccionado la dona es suya y no lleva esa cifra al centro.
    const centro = centroDonaGrupo({ asistenciaPromedio: kpis.asistencia_promedio, sinSesiones, deAlumno: Boolean(nombreAlumno) });
    const altoBarras = Math.max(200, 64 + top.length * ALTO_FILA);

    return (
        <>
            <IndicadoresGrupo kpis={kpis} />
            <div className="grid gap-4 lg:grid-cols-5">
                <TarjetaGrafica
                    className="lg:col-span-2"
                    titulo="Estados de asistencia"
                    descripcion={nombreAlumno ? `Registros de ${nombreAlumno}` : 'Registros de todos los alumnos'}
                    resumen={resumenTexto(distribucion, CONFIG_ASISTENCIA)}
                >
                    <GraficaDona datos={distribucion} config={CONFIG_ASISTENCIA} centro={centro} alto={Math.min(260, altoBarras)}
                        vacio="Aún no hay registros de asistencia" />
                </TarjetaGrafica>
                <TarjetaGrafica
                    className="lg:col-span-3"
                    titulo="Faltas por alumno (%)"
                    descripcion={`Línea roja: límite de ${limite} %`}
                    resumen={top.length ? `${resumenSerie(top, 'alumno', 'faltas')}. Límite: ${limite} %.` : 'Sin datos de faltas.'}
                    acciones={
                        <button
                            type="button"
                            onClick={onVerDetalle}
                            className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                        >
                            {nombreAlumno ? 'Ver sesiones' : 'Ver todos'}
                            <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
                        </button>
                    }
                    pie={fuera > 0 ? `Se muestran los ${top.length} con más faltas; ${fuera} más en la pestaña Alumnos.` : undefined}
                >
                    <GraficaBarras
                        horizontal
                        datos={top}
                        ejeX="alumno"
                        series={[{ clave: 'faltas' }]}
                        config={CONFIG_FALTAS}
                        unidad=" %"
                        dominio={dominioFaltas(top, limite)}
                        limite={{ valor: limite, etiqueta: `Límite ${limite} %` }}
                        alto={altoBarras}
                        vacio={sinSesiones ? 'Aún no hay sesiones para calcular faltas' : 'Sin alumnos para graficar'}
                    />
                </TarjetaGrafica>
            </div>
            {impacto && <ImpactoTiempo impacto={impacto} />}
        </>
    );
}
