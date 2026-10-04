'use client';

import { TrendingUp, TriangleAlert, UserX, Users } from 'lucide-react';
import BarrasPildora from '@/components/ui/BarrasPildora';
import StatCard from '@/components/ui/StatCard';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import ImpactoTiempo from '../ImpactoTiempo';
import {
    CONFIG_SITUACION, estadoAlumnosPorGrupo, gruposConAsistencia, indicadoresPeriodo, resumenSerie, resumenSituacionGrupos,
    serieAsistenciaGrupos, TOP_GRUPOS, umbralAsistencia,
} from '../graficas';
import { apoyoEnLimite, apoyoSinDerecho, cifraPorcentaje } from '../reporte.utils.js';

const CONFIG_ASISTENCIA_GRUPO = { asistencia: { label: 'Asistencia promedio', color: 'var(--chart-1)' } };
const SERIES_ASISTENCIA = [{ clave: 'asistencia' }];
const SERIES_SITUACION = [{ clave: 'regulares' }, { clave: 'enLimite' }, { clave: 'sinDerecho' }];
// Alto del aviso de vacío: en horizontal la altura de las barras la dan las filas.
const ALTO_VACIO = 200;

// Pestaña "Resumen" del periodo: indicadores agregados y dos gráficas por grupo (asistencia y alumnos en riesgo) + impacto.
// Los indicadores no llevan sparkline: el reporte del periodo es una fotografía por grupo, no una serie en el tiempo.
export default function ResumenPeriodo({ reporte, impacto }) {
    const items = reporte?.items || [];
    const k = indicadoresPeriodo(items);
    const asistencia = serieAsistenciaGrupos(items, TOP_GRUPOS);
    const situacion = estadoAlumnosPorGrupo(items, TOP_GRUPOS);
    // api_reporte_periodo hoy no devuelve `limite_pct`, así que normalmente no hay línea de mínimo (no se inventa un valor):
    // si el RPC lo añade, la línea aparece sola.
    const umbral = umbralAsistencia(reporte);
    const conDato = gruposConAsistencia(items);
    const recortado = conDato > asistencia.length || items.length > situacion.length;

    return (
        <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard animated icon={Users} label="Grupos" value={k.grupos} hint={`${k.inscritos} ${k.inscritos === 1 ? 'alumno inscrito' : 'alumnos inscritos'}`} />
                <StatCard icon={TrendingUp} label="Asistencia promedio" {...cifraPorcentaje(k.asistenciaPromedio)} hint="ponderada por inscritos" />
                <StatCard animated icon={TriangleAlert} label="Alumnos en el límite" value={k.enLimite} tone={k.enLimite ? 'warning' : 'neutral'} hint={apoyoEnLimite(k.enLimite)} />
                <StatCard animated icon={UserX} label="Sin derecho a examen" value={k.sinDerecho} tone={k.sinDerecho ? 'danger' : 'neutral'} hint={apoyoSinDerecho(k.sinDerecho)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <TarjetaGrafica
                    titulo="Asistencia promedio por grupo"
                    descripcion={umbral != null ? `Menor a mayor · mínimo de ${umbral} %` : 'Los grupos con menor asistencia, primero'}
                    resumen={asistencia.length ? resumenSerie(asistencia, 'grupo', 'asistencia') : 'Sin datos de asistencia.'}
                    pie={recortado ? `Se muestran hasta ${TOP_GRUPOS} grupos; el resto está en la pestaña Grupos.` : undefined}
                >
                    <BarrasPildora
                        horizontal
                        datos={asistencia}
                        ejeX="grupo"
                        series={SERIES_ASISTENCIA}
                        config={CONFIG_ASISTENCIA_GRUPO}
                        unidad=" %"
                        dominio={[0, 100]}
                        limite={umbral != null ? { valor: umbral, etiqueta: `Mínimo ${umbral} %` } : undefined}
                        anchoEjeY={130}
                        alto={ALTO_VACIO}
                        vacio="Aún no hay asistencia registrada"
                    />
                </TarjetaGrafica>
                <TarjetaGrafica
                    titulo="Alumnos por situación"
                    descripcion="Con derecho, en el límite y sin derecho a examen"
                    resumen={situacion.length ? resumenSituacionGrupos(situacion) : 'Sin alumnos inscritos.'}
                >
                    <BarrasPildora
                        horizontal
                        apilado
                        datos={situacion}
                        ejeX="grupo"
                        series={SERIES_SITUACION}
                        config={CONFIG_SITUACION}
                        dominio={[0, 'auto']}
                        anchoEjeY={130}
                        alto={ALTO_VACIO}
                        leyenda
                        vacio="Aún no hay alumnos inscritos"
                    />
                </TarjetaGrafica>
            </div>
            {impacto && <ImpactoTiempo impacto={impacto} />}
        </>
    );
}
