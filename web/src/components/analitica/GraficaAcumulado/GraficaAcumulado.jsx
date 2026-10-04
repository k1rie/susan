'use client';

import { useMemo } from 'react';
import GraficaLinea from '@/components/ui/GraficaLinea';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_ACUMULADO, construirSerieAcumulado, fmtEjePct, MENSAJE_INSUFICIENTE, resumenTextoAcumulado, seriesAcumulado } from '../analitica.utils.js';
import { renderFilaSerie } from '../FilaTooltipSerie';

const SERIES = seriesAcumulado();
const renderFila = renderFilaSerie(CONFIG_ACUMULADO);
const formatoSemana = (semana) => `S${semana}`;
const tituloSemana = (fila) => `Semana ${fila.semana}`;

// Faltas equivalentes acumuladas (promedio por alumno, % de las sesiones programadas) frente al límite, con la semana estimada del
// cruce marcada en vertical. Mismo lenguaje que GraficaSerie (ui/GraficaLinea): puntos observados, ajuste, proyección e intervalo.
// El tooltip omite las series sin valor en esa semana (ocultarVacios), igual que GraficaSerie.
export default function GraficaAcumulado({ cruceLimite, limitePct = 20 }) {
    const datos = useMemo(() => construirSerieAcumulado(cruceLimite), [cruceLimite]);
    const sinDatos = !cruceLimite || cruceLimite.estado === 'insuficiente' || datos.length === 0;
    const marca = !sinDatos && cruceLimite.estado === 'cruza' && cruceLimite.semana != null ? { valor: cruceLimite.semana, etiqueta: `S${cruceLimite.semana}` } : undefined;
    return (
        <TarjetaGrafica
            titulo="Faltas acumuladas y límite"
            descripcion={sinDatos ? undefined : `Cruce: ${cruceLimite.mensaje}`}
            resumen={resumenTextoAcumulado(cruceLimite, limitePct)}
        >
            {sinDatos ? (
                <p className="flex min-h-40 items-center justify-center rounded-lg bg-muted/60 px-4 text-center text-sm text-muted-foreground">{MENSAJE_INSUFICIENTE}</p>
            ) : (
                <GraficaLinea
                    datos={datos}
                    ejeX="semana"
                    series={SERIES}
                    limite={{ valor: limitePct, etiqueta: `Límite ${limitePct} %` }}
                    marcaX={marca}
                    formatoX={formatoSemana}
                    formatoY={fmtEjePct}
                    tituloTooltip={tituloSemana}
                    renderFila={renderFila}
                    ocultarVacios
                    ariaLabel="Faltas acumuladas por semana: recorre las semanas con las flechas"
                    alto={280}
                />
            )}
        </TarjetaGrafica>
    );
}
