'use client';

import GraficaBarras from '@/components/ui/GraficaBarras';
import StatCard from '@/components/ui/StatCard';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import ImpactoTiempo from '../ImpactoTiempo';
import {
    CONFIG_SITUACION, estadoAlumnosPorGrupo, gruposConAsistencia, indicadoresPeriodo, resumenSerie, resumenSituacionGrupos,
    serieAsistenciaGrupos, TOP_GRUPOS, umbralAsistencia,
} from '../graficas';
import { porcentaje } from '../reporte.utils.js';

const CONFIG_ASISTENCIA_GRUPO = { asistencia: { label: 'Asistencia promedio', color: 'var(--chart-1)' } };
const ALTO_FILA = 34;
const altoPara = (n) => Math.max(200, 64 + n * ALTO_FILA);

// Pestaña "Resumen" del periodo: indicadores agregados y dos gráficas por grupo (asistencia y alumnos en riesgo) + impacto.
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
                <StatCard animated label="Grupos" value={k.grupos} hint={`${k.inscritos} alumnos inscritos`} />
                <StatCard label="Asistencia promedio" value={k.asistenciaPromedio == null ? '—' : porcentaje(k.asistenciaPromedio)} hint="ponderada por inscritos" />
                <StatCard animated label="Alumnos en el límite" value={k.enLimite} tone={k.enLimite ? 'warning' : 'neutral'} />
                <StatCard animated label="Sin derecho a examen" value={k.sinDerecho} tone={k.sinDerecho ? 'danger' : 'neutral'} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <TarjetaGrafica
                    titulo="Asistencia promedio por grupo"
                    descripcion={umbral != null ? `Línea roja: asistencia mínima de ${umbral} %` : 'Los grupos con menor asistencia, primero'}
                    resumen={asistencia.length ? resumenSerie(asistencia, 'grupo', 'asistencia') : 'Sin datos de asistencia.'}
                    pie={recortado ? `Se muestran hasta ${TOP_GRUPOS} grupos; el resto está en la pestaña Grupos.` : undefined}
                >
                    <GraficaBarras
                        horizontal
                        datos={asistencia}
                        ejeX="grupo"
                        series={[{ clave: 'asistencia' }]}
                        config={CONFIG_ASISTENCIA_GRUPO}
                        unidad=" %"
                        dominio={[0, 100]}
                        limite={umbral != null ? { valor: umbral, etiqueta: `Mínimo ${umbral} %` } : undefined}
                        alto={altoPara(asistencia.length)}
                        vacio="Aún no hay asistencia registrada"
                    />
                </TarjetaGrafica>
                <TarjetaGrafica
                    titulo="Alumnos por situación"
                    descripcion="Con derecho, en el límite y sin derecho a examen"
                    resumen={situacion.length ? resumenSituacionGrupos(situacion) : 'Sin alumnos inscritos.'}
                >
                    <GraficaBarras
                        horizontal
                        apilado
                        datos={situacion}
                        ejeX="grupo"
                        series={[{ clave: 'regulares' }, { clave: 'enLimite' }, { clave: 'sinDerecho' }]}
                        config={CONFIG_SITUACION}
                        dominio={[0, 'auto']}
                        alto={altoPara(situacion.length)}
                        leyenda
                        vacio="Aún no hay alumnos inscritos"
                    />
                </TarjetaGrafica>
            </div>
            {impacto && <ImpactoTiempo impacto={impacto} />}
        </>
    );
}
