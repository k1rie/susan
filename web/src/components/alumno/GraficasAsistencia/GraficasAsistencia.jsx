'use client';

import clsx from 'clsx';
import AnilloEstados from '@/components/ui/AnilloEstados';
import BarrasPildora from '@/components/ui/BarrasPildora';
import Detalles from '@/components/ui/Detalles';
import MedidorLiquido from '@/components/ui/MedidorLiquido';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_ASISTENCIA, formatoPct } from '@/lib/graficas.js';
import {
    CONFIG_FALTAS,
    datosDonaAsistencia,
    datosFaltasPorMateria,
    datosMedidorAsistencia,
    notaMedidor,
    notaPendientes,
    notaRegistros,
    resumenAsistencia,
    resumenFaltas,
    seriesFaltas,
    totalesAsistencia,
} from './graficasAsistencia.utils.js';

// Cifras primero: el medidor líquido «Tu asistencia» es la pieza principal (con la marca del mínimo que pide el derecho a examen),
// junto al anillo de registros por estado y, con varias materias, las faltas de cada una frente al límite. Con una sola materia la
// comparación no aporta, así que solo se pintan el medidor y el anillo.
// El medidor y el anillo van lado a lado cuando la tarjeta es ancha (container query: la tarjeta cabe en media columna aunque la
// pantalla sea grande) y apilados, medidor primero, en las angostas. Cuánto lleva cada uno, de dónde sale el mínimo y qué es «asististe»
// va plegado en «Cómo se calcula»: la pantalla muestra cifras y gráficas, no párrafos. En el anillo el centro lleva el total de registros
// (no un %): el % de asistencia ya es el del medidor y dos porcentajes «de asistencia» distintos, uno junto al otro, confundirían.
export default function GraficasAsistencia({ items = [], className }) {
    const t = totalesAsistencia(items);
    const faltas = datosFaltasPorMateria(items);
    const medidor = datosMedidorAsistencia(items);
    const variasMaterias = items.length > 1;
    const pendientes = notaPendientes(t.pendientes);
    const explicaciones = [notaMedidor(medidor), notaRegistros(t)].filter(Boolean);
    return (
        <div className={clsx('grid grid-cols-1 gap-3', variasMaterias && 'lg:grid-cols-2 lg:items-start', className)}>
            <TarjetaGrafica
                titulo="Asistencia del periodo"
                descripcion="Suma de todas tus materias"
                resumen={resumenAsistencia(t)}
                pie={(pendientes || explicaciones.length > 0) && (
                    <>
                        {pendientes && <p>{pendientes}</p>}
                        {explicaciones.length > 0 && (
                            <Detalles plano titulo="Cómo se calcula" className={pendientes ? 'mt-1' : undefined}>
                                <div className="flex flex-col gap-2">
                                    {explicaciones.map((texto) => (
                                        <p key={texto}>{texto}</p>
                                    ))}
                                </div>
                            </Detalles>
                        )}
                    </>
                )}
            >
                <div className="@container">
                    <div className="flex flex-col items-center gap-6 @min-[34rem]:flex-row @min-[34rem]:gap-8">
                        {medidor && (
                            <MedidorLiquido
                                className="@min-[34rem]:min-w-0 @min-[34rem]:flex-1"
                                valor={medidor.valor}
                                tono={medidor.tono}
                                etiqueta="Tu asistencia"
                                descripcion={medidor.descripcion}
                                limite={medidor.limite}
                                ancho={88}
                                alto={176}
                            />
                        )}
                        {/* El anillo es un contenedor de tamaño en línea (mide 0 si flex le deja sin espacio): w-full al apilar y ancho fijo en
                            fila. El que cede espacio es el medidor (min-w-0 + flex-1, su descripción se parte); si fuera al revés, una descripción
                            larga («25.5 faltas equivalentes de 135 sesiones · 1 materia sobre el límite») aplastaría el anillo hasta 0 px. */}
                        <AnilloEstados
                            className="w-full @min-[34rem]:w-72 @min-[34rem]:flex-none"
                            datos={datosDonaAsistencia(t)}
                            config={CONFIG_ASISTENCIA}
                            centro={{ etiqueta: 'Registros' }}
                            vacio="Aún no hay registros de asistencia"
                        />
                    </div>
                </div>
            </TarjetaGrafica>
            {variasMaterias && (
                <TarjetaGrafica
                    titulo="Faltas frente al límite"
                    descripcion="% de faltas por materia"
                    resumen={resumenFaltas(faltas)}
                >
                    <BarrasPildora
                        horizontal
                        apilado
                        datos={faltas.filas}
                        ejeX="materia"
                        series={seriesFaltas(faltas.filas)}
                        config={CONFIG_FALTAS}
                        limite={{ valor: faltas.limite, etiqueta: `Límite ${formatoPct(faltas.limite)}` }}
                        unidad=" %"
                        dominio={faltas.dominio}
                        anchoEjeY={140}
                        leyenda
                    />
                </TarjetaGrafica>
            )}
        </div>
    );
}
