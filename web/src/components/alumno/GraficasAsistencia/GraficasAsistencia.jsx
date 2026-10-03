'use client';

import clsx from 'clsx';
import GraficaBarras from '@/components/ui/GraficaBarras';
import GraficaDona from '@/components/ui/GraficaDona';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_ASISTENCIA } from '@/lib/graficas.js';
import {
    CONFIG_FALTAS,
    altoFaltas,
    datosDonaAsistencia,
    datosFaltasPorMateria,
    NOTA_ASISTIERON,
    notaPendientes,
    porcentajeAsistieron,
    resumenAsistencia,
    resumenFaltas,
    seriesFaltas,
    totalesAsistencia,
} from './graficasAsistencia.utils.js';

// Cifras primero: dona con el total de estados (y, al centro, el % que asistió: presentes y retardos) y, con varias materias, las
// faltas de cada una frente al límite. Con una sola materia la comparación no aporta, así que solo se pinta la dona.
export default function GraficasAsistencia({ items = [], className }) {
    const t = totalesAsistencia(items);
    const faltas = datosFaltasPorMateria(items);
    const variasMaterias = items.length > 1;
    const pendientes = notaPendientes(t.pendientes);
    return (
        <div className={clsx('grid grid-cols-1 gap-3', variasMaterias && 'lg:grid-cols-2', className)}>
            <TarjetaGrafica
                titulo="Mi asistencia"
                descripcion="Todas tus materias del periodo"
                resumen={resumenAsistencia(t)}
                pie={(
                    <>
                        <p>{NOTA_ASISTIERON}</p>
                        {pendientes && <p className="mt-1">{pendientes}</p>}
                    </>
                )}
            >
                <GraficaDona
                    datos={datosDonaAsistencia(t)}
                    config={CONFIG_ASISTENCIA}
                    centro={{ valor: `${porcentajeAsistieron(t)} %`, etiqueta: 'Asistieron' }}
                    vacio="Aún no hay registros de asistencia"
                />
            </TarjetaGrafica>
            {variasMaterias && (
                <TarjetaGrafica
                    titulo="Faltas frente al límite"
                    descripcion="% de faltas por materia"
                    resumen={resumenFaltas(faltas)}
                >
                    <GraficaBarras
                        horizontal
                        apilado
                        datos={faltas.filas}
                        ejeX="materia"
                        series={seriesFaltas(faltas.filas)}
                        config={CONFIG_FALTAS}
                        limite={{ valor: faltas.limite, etiqueta: `Límite ${faltas.limite} %` }}
                        unidad=" %"
                        dominio={faltas.dominio}
                        alto={altoFaltas(faltas.filas.length)}
                        leyenda
                    />
                </TarjetaGrafica>
            )}
        </div>
    );
}
