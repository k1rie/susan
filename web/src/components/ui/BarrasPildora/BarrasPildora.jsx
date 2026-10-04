'use client';

import clsx from 'clsx';
import { useRef } from 'react';
import { colorGrafica, formatoNumero, numeroOpcional } from '@/lib/graficas.js';
import { dominioFinal, fraccionEnDominio } from '@/lib/graficasGeometria.js';
import { EASE, useEnVista, usePrefersReducedMotion } from '@/lib/motion';
import {
    alturaPlano,
    ALTO_CIFRA,
    anchoColumnaValor,
    anchoGrupoMaximo,
    armarFilas,
    detalleFila,
    estiloSegmento,
    fuenteEtiquetas,
    hayDatos,
    pasoEntreCifras,
    pistasDeFila,
    planCifras,
    posicionCifra,
    ranuraCategoria,
    SEPARACION_BARRAS,
    separacionColumnas,
    tramosDePista,
} from './barrasPildora.utils.js';
import useAnchoElemento from './useAnchoElemento.js';

const SEPARACION = '0.75rem';
const ENTRADA = `clip-path 0.85s ${EASE.salida}`;
// Duración (s) del movimiento de las barras cuando cambian los datos (la sesión en vivo sondea cada 5 s).
const ACTUALIZACION = 0.5;

// Barras de píldora (HTML/CSS, sin librerías): pista suave, relleno redondeado que se revela al entrar en vista, cifra al final y,
// con `limite`, un marcador discontinuo con su etiqueta. Props:
//   datos      = filas con la categoría `ejeX` y una propiedad por serie (null, '' o no numérico = sin dato: ni barra ni cifra «0»,
//                se escribe «-»; un negativo cuenta como 0) · series = [{ clave }] · config = { clave: { label, color } }
//   horizontal = categorías a la izquierda (listas y rankings; la altura la dan las filas y `alto` solo fija el del aviso vacío);
//                si no, columnas de `alto` px
//   apilado    = las series se suman en UNA barra (la cifra de la fila es el total; en filas, con más de un segmento con valor, debajo de
//                la pista va el desglose «punto de color + cifra» de cada uno); si no, con varias series cada una lleva SU barra, lado a lado
//                dentro de la categoría
//   limite     = { valor, etiqueta } · línea discontinua en `valor`; fuera de la escala (dominio fijo) no se dibuja y se avisa en la leyenda
//   unidad     = texto tras cada cifra (' %') · formatoValor = (valor) => texto, reemplaza cifra y unidad (debe ser corto)
//   dominio    = [min, max] del eje numérico: [0, 100] fijo, [0, 'auto'] calcula el máximo; sin él, de 0 al mayor valor o límite (+12 %).
//                Los valores que rebasan el máximo se recortan
//   anchoEjeY  = ancho (px, como máximo el 42 % del ancho) de la columna de nombres en horizontal · alto = alto de las columnas (260)
//   leyenda    = swatches de las series (por defecto, si hay más de una) · vacio = texto sin datos · className = clases del contenedor
// Columnas: cada cifra aparece con su barra (nunca antes), no se solapa con otra (se reduce, se abrevia sin unidad o se salta alguna
// cuando las columnas están muy juntas; ver planCifras) y se aparta de la línea de límite en lugar de dejarse atravesar.
// Filas: el nombre largo ocupa 2 líneas (line-clamp) y su title trae el nombre completo.
// Datos vivos: la entrada se anima UNA vez (clip-path, escalonada); después, cada barra se mueve con una transición corta de
// left/width (filas) o bottom/height (columnas) en su propio elemento, sin tocar el clip-path de la entrada. Con «reducir movimiento»
// no hay transiciones ni retrasos.
// Accesibilidad: lo dibujado es aria-hidden y un texto oculto lista cada fila («Lun: 14.9 %», con todas las series) y el límite.
export default function BarrasPildora({
    datos,
    ejeX,
    series,
    config,
    horizontal = false,
    apilado = false,
    limite,
    unidad = '',
    dominio,
    alto = 260,
    anchoEjeY = 110,
    leyenda,
    formatoValor,
    vacio = 'Sin datos para graficar',
    className,
}) {
    const ref = useRef(null);
    const reducido = usePrefersReducedMotion();
    const enVista = useEnVista(ref, { desactivado: reducido });
    const visible = reducido || enVista;
    // El ancho solo importa en columnas (decide el tamaño de las cifras). Se mide el contenedor raíz, que existe siempre.
    const ancho = useAnchoElemento(ref, { desactivado: horizontal });

    const lista = series ?? [];
    const filas = armarFilas({ datos, ejeX, series: lista, apilado });
    // El contenedor con `ref` existe SIEMPRE: si solo se montara con datos, el observador de entrada nunca vería el nodo y una gráfica que
    // pasa de «sin datos» a «con datos» (la sesión en vivo al recibir su primer registro) se quedaría invisible.
    if (!filas.length || !lista.length || !hayDatos(filas)) {
        return (
            <div ref={ref} className={className}>
                <p className="flex items-center justify-center rounded-xl bg-muted/60 text-sm text-muted-foreground" style={{ height: alto }}>{vacio}</p>
            </div>
        );
    }

    const limiteValor = numeroOpcional(limite?.valor);
    const dom = dominioFinal(dominio, filas.map((f) => f.total).filter((t) => t !== null), limiteValor);
    const fr = (v) => fraccionEnDominio(v, dom);
    // Con un dominio fijo, un límite fuera de él no se puede dibujar: pegarlo al borde lo haría pasar por un valor que no es.
    const limiteEnEscala = limiteValor !== null && limiteValor >= dom[0] && limiteValor <= dom[1];
    const fraccionLimite = limiteEnEscala ? fr(limiteValor) : null;
    const limiteFuera = limiteValor !== null && !limiteEnEscala;

    const color = (clave) => colorGrafica(config?.[clave]?.color ?? 'var(--g-azul)');
    const nombreSerie = (clave) => config?.[clave]?.label ?? clave;
    const mostrar = (v) => (v === null ? '-' : formatoValor ? formatoValor(v) : `${formatoNumero(v)}${unidad}`);
    const corto = (v) => (v === null ? '-' : formatoValor ? formatoValor(v) : formatoNumero(v));
    const detalle = (f) => detalleFila(f, { apilado, mostrar, nombreSerie });
    const pistasFilas = filas.map((f) => pistasDeFila(f, apilado));
    const barras = pistasFilas[0].length;
    const verLeyenda = leyenda ?? lista.length > 1;

    // Transición de los segmentos al cambiar los datos: left/width en filas, bottom/height en columnas.
    const transicionSegmento = reducido
        ? undefined
        : `${horizontal ? 'left' : 'bottom'} ${ACTUALIZACION}s ${EASE.salida}, ${horizontal ? 'width' : 'height'} ${ACTUALIZACION}s ${EASE.salida}, opacity 0.3s ease`;
    const segmentos = (pista) => tramosDePista(pista.partes, dom, apilado).map((t) => (
        <span
            key={t.clave}
            data-segmento={t.clave}
            className="absolute rounded-full"
            style={{ ...estiloSegmento(t, horizontal), background: color(t.clave), transition: transicionSegmento }}
        />
    ));

    // En columnas el límite se explica en la leyenda (una etiqueta sobre la línea chocaría con la cifra de la barra que está cerca del
    // límite, justo la que más importa); en filas la etiqueta cabe sobre la primera fila. Un límite fuera de escala va siempre aquí.
    const textoLimite = limiteValor === null ? null : (limite.etiqueta ?? `Límite ${mostrar(limiteValor)}`);
    const entradaLimite = limiteValor !== null && (limiteFuera || (!horizontal && limite.etiqueta)) ? (
        <li data-leyenda-limite className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-3.5 border-t border-dashed border-destructive/70" />
            <span className="font-medium text-destructive">{textoLimite}{limiteFuera && ' (fuera de escala)'}</span>
        </li>
    ) : null;
    const Leyenda = verLeyenda || entradaLimite ? (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {verLeyenda && lista.map((s) => (
                <li key={s.clave} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: color(s.clave) }} />
                    {nombreSerie(s.clave)}
                </li>
            ))}
            {entradaLimite}
        </ul>
    ) : null;
    // Texto para lectores de pantalla: lo dibujado es aria-hidden y esta lista trae cada fila y el límite (si no está ya en la leyenda).
    const Lectores = (
        <ul className="sr-only">
            {filas.map((f, i) => (
                <li key={`${f.etiqueta}-${i}`}>{detalle(f)}</li>
            ))}
            {limiteValor !== null && !entradaLimite && <li>{textoLimite}</li>}
        </ul>
    );

    if (horizontal) {
        const etiquetaLimite = fraccionLimite !== null && Boolean(limite.etiqueta);
        const caracteres = Math.max(...pistasFilas.flat().map((p) => mostrar(p.cifra).length));
        return (
            <div ref={ref} className={className}>
                <div
                    aria-hidden="true"
                    className={clsx('relative grid items-center gap-y-3 text-sm', etiquetaLimite && 'pt-6')}
                    style={{
                        gridTemplateColumns: 'var(--ancho-nombres) minmax(0, 1fr) var(--ancho-valor)',
                        columnGap: SEPARACION,
                        '--ancho-nombres': `min(${anchoEjeY}px, 42%)`,
                        '--ancho-valor': anchoColumnaValor(caracteres),
                    }}
                >
                    {filas.map((f, i) => {
                        const pistas = pistasFilas[i];
                        const retraso = Math.min(i, 10) * 60;
                        // En apilado la cifra de la fila es solo el total: con más de un segmento con valor se escribe también la de cada
                        // uno, porque el title no se ve en táctil y un segmento de unos píxeles no dice cuánto vale.
                        const desglose = apilado ? f.partes.filter((p) => p.valor > 0) : [];
                        return (
                            <div key={`${f.etiqueta}-${i}`} data-fila={f.etiqueta} className="col-span-3 grid grid-cols-subgrid items-center" title={detalle(f)}>
                                <span className="line-clamp-2 text-[13px] leading-tight" title={f.etiqueta}>{f.etiqueta}</span>
                                <div className="flex flex-col gap-1">
                                    {pistas.map((pista) => (
                                        <div key={pista.clave} className="relative h-2.5 rounded-full bg-muted">
                                            <div
                                                className="absolute inset-0"
                                                style={{
                                                    clipPath: visible ? 'inset(0 0 0 0 round 999px)' : 'inset(0 100% 0 0 round 999px)',
                                                    transition: reducido ? undefined : `${ENTRADA} ${retraso}ms`,
                                                }}
                                            >
                                                {segmentos(pista)}
                                            </div>
                                        </div>
                                    ))}
                                    {desglose.length > 1 && (
                                        <span data-desglose className="flex flex-wrap gap-x-2 text-[11px] leading-3 tabular-nums text-muted-foreground">
                                            {desglose.map((p) => (
                                                <span key={p.clave} className="flex items-center gap-1">
                                                    <span className="size-1.5 rounded-full" style={{ background: color(p.clave) }} />
                                                    {corto(p.valor)}
                                                </span>
                                            ))}
                                        </span>
                                    )}
                                </div>
                                {/* La cifra aparece con su barra: entra con un pequeño retraso sobre el de la barra. */}
                                <div className={clsx('flex flex-col gap-1 text-right font-medium tabular-nums', pistas.length > 1 && 'text-[11px] leading-[10px]')}>
                                    {pistas.map((pista) => (
                                        <span
                                            key={pista.clave}
                                            data-cifra
                                            className={clsx('whitespace-nowrap', pista.cifra === null && 'text-muted-foreground')}
                                            style={{
                                                opacity: visible ? 1 : 0,
                                                transition: reducido ? undefined : `opacity 0.4s ease ${retraso + 350}ms`,
                                            }}
                                        >
                                            {mostrar(pista.cifra)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {fraccionLimite !== null && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0"
                            style={{ left: `calc(var(--ancho-nombres) + ${SEPARACION})`, right: `calc(var(--ancho-valor) + ${SEPARACION})` }}
                        >
                            <div
                                data-limite
                                className={clsx('absolute bottom-0 border-l border-dashed border-destructive/70', etiquetaLimite ? 'top-6' : 'top-0')}
                                style={{ left: `${fraccionLimite * 100}%` }}
                            />
                            {etiquetaLimite && (
                                <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium leading-4 text-destructive" style={{ left: `${fraccionLimite * 100}%` }}>{limite.etiqueta}</span>
                            )}
                        </div>
                    )}
                </div>
                {Leyenda}
                {Lectores}
            </div>
        );
    }

    // Columnas: valor sobre cada barra, categoría debajo y línea de límite sobre el área de trazado.
    const separacion = separacionColumnas(filas.length);
    const altura = alturaPlano(alto);
    const todasLasPistas = pistasFilas.flat();
    const plan = planCifras({
        paso: pasoEntreCifras({ ancho, categorias: filas.length, barras }),
        completos: todasLasPistas.map((p) => mostrar(p.cifra)),
        cortos: todasLasPistas.map((p) => corto(p.cifra)),
    });
    const fuenteEtiqueta = fuenteEtiquetas({ ranura: ranuraCategoria({ ancho, categorias: filas.length }), etiquetas: filas.map((f) => f.etiqueta) });
    return (
        <div ref={ref} className={className}>
            <div className="relative" style={{ height: alto }} aria-hidden="true">
                <div className="absolute inset-x-0 bottom-7 top-6">
                    {fraccionLimite !== null && (
                        <div data-limite className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-destructive/70" style={{ bottom: `${fraccionLimite * 100}%` }} />
                    )}
                    <div className="absolute inset-0 flex" style={{ columnGap: separacion }}>
                        {filas.map((f, i) => {
                            const retraso = Math.min(i, 10) * 60;
                            return (
                                <div key={`${f.etiqueta}-${i}`} data-fila={f.etiqueta} className="relative min-w-0 flex-1" title={detalle(f)}>
                                    <div className="absolute inset-x-[12%] inset-y-0 mx-auto flex" style={{ maxWidth: anchoGrupoMaximo(barras), columnGap: SEPARACION_BARRAS }}>
                                        {pistasFilas[i].map((pista, k) => {
                                            const conCifra = plan.modo !== 'oculto' && (i * barras + k) % plan.cada === 0;
                                            return (
                                                <div key={pista.clave} className="relative min-w-0 flex-1">
                                                    <div
                                                        className="absolute inset-0"
                                                        style={{
                                                            clipPath: visible ? 'inset(0 0 0 0 round 12px)' : 'inset(100% 0 0 0 round 12px)',
                                                            transition: reducido ? undefined : `${ENTRADA} ${retraso}ms`,
                                                        }}
                                                    >
                                                        {segmentos(pista)}
                                                    </div>
                                                    {conCifra && (
                                                        <span
                                                            data-cifra
                                                            className={clsx('pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-center font-medium tabular-nums', pista.cifra === null && 'text-muted-foreground')}
                                                            style={{
                                                                bottom: posicionCifra({ fraccion: pista.cifra === null ? 0 : fr(pista.cifra), fraccionLimite, alturaPlano: altura }),
                                                                fontSize: plan.fuente,
                                                                lineHeight: `${ALTO_CIFRA}px`,
                                                                opacity: visible ? 1 : 0,
                                                                // Aparece cuando la barra ya subió; al cambiar los datos sigue a la punta de la barra.
                                                                transition: reducido ? undefined : `opacity 0.4s ease ${retraso + 450}ms, bottom ${ACTUALIZACION}s ${EASE.salida}`,
                                                            }}
                                                        >
                                                            {plan.modo === 'completo' ? mostrar(pista.cifra) : corto(pista.cifra)}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex" style={{ columnGap: separacion }}>
                    {filas.map((f, i) => (
                        <span key={`${f.etiqueta}-${i}`} className="min-w-0 flex-1 truncate text-center leading-4 text-muted-foreground" style={{ fontSize: fuenteEtiqueta }} title={f.etiqueta}>{f.etiqueta}</span>
                    ))}
                </div>
            </div>
            {Leyenda}
            {Lectores}
        </div>
    );
}
