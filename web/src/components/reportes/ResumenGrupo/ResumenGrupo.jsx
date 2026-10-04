'use client';

import { ArrowRight } from 'lucide-react';
import AnilloEstados from '@/components/ui/AnilloEstados';
import BarrasPildora from '@/components/ui/BarrasPildora';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_ASISTENCIA, resumenTexto } from '@/lib/graficas.js';
import IndicadoresGrupo from '../IndicadoresGrupo';
import ImpactoTiempo from '../ImpactoTiempo';
import {
    alumnosFueraDelTop, centroAnilloGrupo, distribucionAsistencia, dominioFaltas, limiteFaltas, resumenSerie, topFaltasAlumnos, TOP_ALUMNOS,
} from '../graficas';

const CONFIG_FALTAS = { faltas: { label: 'Faltas', color: 'var(--ausente)' } };
const SERIES_FALTAS = [{ clave: 'faltas' }];
// Altura de referencia del anillo (su lado sale de aquí): con ella el anillo y su leyenda llenan la tarjeta junto a la de faltas.
const ALTO_ANILLO = 260;

// Pestaña "Resumen" de un grupo (o de un alumno del grupo): cuatro indicadores, anillo de estados, faltas frente al límite
// e impacto en tiempo. `filas` ya viene filtrada por alumno cuando hay uno seleccionado.
export default function ResumenGrupo({ reporte, filas = [], impacto, nombreAlumno, onVerDetalle }) {
    const kpis = reporte?.kpis || {};
    const sinSesiones = kpis.sesiones_programadas === 0;
    const limite = limiteFaltas(reporte);
    const distribucion = distribucionAsistencia(filas);
    const top = sinSesiones ? [] : topFaltasAlumnos(filas, TOP_ALUMNOS);
    const fuera = sinSesiones ? 0 : alumnosFueraDelTop(filas, TOP_ALUMNOS);
    // `kpis` es del grupo completo: con un alumno seleccionado el anillo es suyo y no lleva esa cifra al centro.
    const centro = centroAnilloGrupo({ asistenciaPromedio: kpis.asistencia_promedio, sinSesiones, deAlumno: Boolean(nombreAlumno) });

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
                    <AnilloEstados datos={distribucion} config={CONFIG_ASISTENCIA} centro={centro} alto={ALTO_ANILLO}
                        vacio="Aún no hay registros de asistencia" />
                </TarjetaGrafica>
                <TarjetaGrafica
                    className="lg:col-span-3"
                    titulo="Faltas por alumno (%)"
                    descripcion={`De mayor a menor · límite de ${limite} %`}
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
                    {/* En horizontal la altura la dan las filas: `alto` solo fija la del aviso de vacío (la misma que la del anillo). */}
                    <BarrasPildora
                        horizontal
                        datos={top}
                        ejeX="alumno"
                        series={SERIES_FALTAS}
                        config={CONFIG_FALTAS}
                        unidad=" %"
                        dominio={dominioFaltas(top, limite)}
                        limite={{ valor: limite, etiqueta: `Límite ${limite} %` }}
                        anchoEjeY={130}
                        alto={ALTO_ANILLO}
                        vacio={sinSesiones ? 'Aún no hay sesiones para calcular faltas' : 'Sin alumnos para graficar'}
                    />
                </TarjetaGrafica>
            </div>
            {impacto && <ImpactoTiempo impacto={impacto} />}
        </>
    );
}
