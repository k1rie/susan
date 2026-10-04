'use client';

import { useMemo, useState } from 'react';
import Checkbox from '@/components/ui/Checkbox';
import GraficaLinea from '@/components/ui/GraficaLinea';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { construirSerieSemanal, CONFIG_SERIE, descripcionTendencia, fmtEjePct, MENSAJE_INSUFICIENTE, resumenTextoSerie, seriesSemanal } from '../analitica.utils.js';
import { renderFilaSerie } from '../FilaTooltipSerie';

// Funciones estables entre renders: GraficaLinea no tiene que recalcular nada por una función nueva.
const renderFila = renderFilaSerie(CONFIG_SERIE);
const formatoSemana = (semana) => `S${semana}`;
const tituloSemana = (fila) => `Semana ${fila.semana}`;

// Tasa semanal observada (puntos), ajuste de regresión (línea), proyección (discontinua) con su intervalo del 95 % (banda) y medias
// móviles opcionales, frente al límite (valores en %). Hecha con ui/GraficaLinea (SVG propio): la leyenda y el tooltip
// distinguen ajuste, proyección e intervalo por su forma, no solo por el color. El tooltip omite las series sin valor en esa semana
// (ocultarVacios): una semana de proyección no debe listar "Observada -" ni "EMA -".
export default function GraficaSerie({ tendencia, suavizado, proyeccion, resumen, cruceLimite, limitePct = 20 }) {
    const [ver, setVer] = useState({ sma: false, ema: true, wma: false });
    const datos = useMemo(() => construirSerieSemanal({ tendencia, suavizado, proyeccion }), [tendencia, suavizado, proyeccion]);
    const series = useMemo(() => seriesSemanal(ver), [ver]);
    const alternar = (k) => setVer((v) => ({ ...v, [k]: !v[k] }));
    const textoResumen = resumenTextoSerie({ tendencia, resumen, proyeccion, cruceLimite, limitePct });

    if (!tendencia?.disponible) {
        return (
            <TarjetaGrafica titulo="Ausentismo semanal" resumen={textoResumen}>
                <p className="flex min-h-40 items-center justify-center rounded-lg bg-muted/60 px-4 text-center text-sm text-muted-foreground">{MENSAJE_INSUFICIENTE}</p>
            </TarjetaGrafica>
        );
    }
    return (
        <TarjetaGrafica
            titulo="Ausentismo semanal"
            descripcion={descripcionTendencia(tendencia)}
            resumen={textoResumen}
            pie={
                <fieldset className="flex flex-wrap items-center gap-x-4">
                    <legend className="sr-only">Medias móviles visibles</legend>
                    <span aria-hidden="true">Medias móviles</span>
                    <Checkbox label="SMA" checked={ver.sma} onChange={() => alternar('sma')} />
                    <Checkbox label="EMA" checked={ver.ema} onChange={() => alternar('ema')} />
                    <Checkbox label="WMA" checked={ver.wma} onChange={() => alternar('wma')} />
                </fieldset>
            }
        >
            <GraficaLinea
                datos={datos}
                ejeX="semana"
                series={series}
                limite={{ valor: limitePct, etiqueta: `Límite ${limitePct} %` }}
                formatoX={formatoSemana}
                formatoY={fmtEjePct}
                tituloTooltip={tituloSemana}
                renderFila={renderFila}
                ocultarVacios
                ariaLabel="Tasa semanal de ausentismo: recorre las semanas con las flechas"
                alto={280}
            />
        </TarjetaGrafica>
    );
}
