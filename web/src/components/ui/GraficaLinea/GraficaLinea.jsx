'use client';

import clsx from 'clsx';
import { useRef } from 'react';
import { useEnVista, usePrefersReducedMotion } from '@/lib/motion';
import LeyendaLinea from './LeyendaLinea.jsx';
import LienzoLinea from './LienzoLinea.jsx';
import TooltipLinea from './TooltipLinea.jsx';
import { construirModelo, descripcionPorDefecto, formatoNumero, prepararFilas } from './graficaLinea.utils.js';
import useAnchoMedido from './useAnchoMedido.js';
import useFilaActiva from './useFilaActiva.js';

const SIN_POSICIONES = [];

// Gráfica de líneas y áreas hecha a mano (SVG + CSS, sin librerías), con el lenguaje de la familia: trazos finos, puntos con aro, banda
// con degradado y entrada que "dibuja" las líneas una sola vez al entrar en vista.
//   datos    = filas { [ejeX]: número, ...valor por serie }; null/undefined = hueco que se une por encima; una banda trae [inferior, superior]
//   series   = [{ clave, tipo: 'puntos' | 'linea' | 'banda', discontinua?, grosor?, color: token, etiqueta }]
//   limite   = { valor, etiqueta } línea horizontal discontinua (el dominio Y siempre la incluye) · marcaX = { valor, etiqueta } línea vertical
// Interacción: puntero o teclado (← → Home End, Esc) mueven una guía vertical con tooltip; la fila activa se anuncia en aria-live.
// Accesibilidad: una lista oculta (<ol>) trae una frase por fila, sin necesidad de teclas (los lectores de pantalla en modo exploración
// se quedan con las flechas); los huecos no se leen. `etiquetaLista` es su nombre accesible (opcional: `ariaLabel` suele llevar la
// instrucción de teclado del grupo y no tiene sentido repetirla en la lista).
// Los datos numéricos se unen con rectas: no se suaviza nada (una línea quebrada es exacta).
export default function GraficaLinea({
    datos = [],
    ejeX = 'x',
    series = [],
    limite,
    marcaX,
    formatoX = String,
    formatoY = formatoNumero,
    dominioY = [0, 'auto'],
    alto = 280,
    leyenda = true,
    renderFila,
    tituloTooltip,
    descripcionActivo,
    ocultarVacios = false,
    ariaLabel = 'Gráfica de líneas',
    etiquetaLista,
    vacio = 'Sin datos para graficar',
    className,
}) {
    const ref = useRef(null);
    const ancho = useAnchoMedido(ref);
    const reducido = usePrefersReducedMotion();
    const enVista = useEnVista(ref, { desactivado: reducido });
    const filas = prepararFilas(datos, ejeX);
    const hayDatos = filas.length > 0 && series.length > 0;
    const modelo = hayDatos
        ? construirModelo({ filas, series, ejeX, limite, marcaX, dominioY, ancho, alto, formatoX, formatoY, leyendaExplicaLimite: leyenda === true })
        : null;
    const { activo, manejadores } = useFilaActiva(modelo?.posiciones ?? SIN_POSICIONES);

    // Frase de una fila para lectores de pantalla: la misma en la lista oculta y en el aria-live de la fila activa.
    const textoFila = (f) => {
        if (descripcionActivo) return descripcionActivo(f);
        const titulo = tituloTooltip ? tituloTooltip(f) : formatoX(f[ejeX]);
        return descripcionPorDefecto({ fila: f, titulo: typeof titulo === 'string' ? titulo : String(formatoX(f[ejeX])), series, formatoY });
    };
    const fila = modelo && activo !== null ? filas[activo] : null;
    const tituloFila = fila ? (tituloTooltip ? tituloTooltip(fila) : formatoX(fila[ejeX])) : null;
    // Sin interacción activa la región aria-live queda vacía: no anuncia nada.
    const anuncio = fila ? textoFila(fila) : '';

    const caja = (c) => ({ left: c.x, top: c.y, width: c.width, height: c.height });
    const claseEtiqueta = 'pointer-events-none absolute flex items-center justify-center whitespace-nowrap rounded-full bg-destructive/10 text-[11px] font-medium leading-none text-destructive';

    return (
        <div className={clsx('w-full', className)}>
            <div
                ref={ref}
                role={hayDatos ? 'group' : undefined}
                aria-label={hayDatos ? ariaLabel : undefined}
                tabIndex={hayDatos ? 0 : undefined}
                className={clsx('relative w-full touch-pan-y select-none rounded-lg outline-none', hayDatos && 'focus-visible:ring-4 focus-visible:ring-ring/30')}
                style={{ height: alto }}
                {...(hayDatos ? manejadores : {})}
            >
                {!hayDatos && <p className="flex size-full items-center justify-center rounded-xl bg-muted/60 text-sm text-muted-foreground">{vacio}</p>}
                {modelo && (
                    <>
                        <LienzoLinea modelo={modelo} activo={activo} correr={reducido || enVista} animar={!reducido} />
                        {modelo.limite?.caja && <span data-etiqueta="limite" className={claseEtiqueta} style={caja(modelo.limite.caja)}>{modelo.limite.etiqueta}</span>}
                        {modelo.marca?.caja && <span data-etiqueta="marca" className={claseEtiqueta} style={caja(modelo.marca.caja)}>{modelo.marca.etiqueta}</span>}
                        {fila && <TooltipLinea modelo={modelo} series={series} fila={fila} titulo={tituloFila} x={modelo.posiciones[activo]} renderFila={renderFila} formatoY={formatoY} ocultarVacios={ocultarVacios} />}
                    </>
                )}
                {hayDatos && <p className="sr-only" aria-live="polite" aria-atomic="true">{anuncio}</p>}
            </div>
            {/* El grupo con flechas no es un rol de widget: NVDA y JAWS no pasan a modo foco y se quedan con las flechas, así que el
                aria-live nunca se dispara. Esta lista (patrón de BarrasPildora) deja cada fila en el árbol de accesibilidad sin teclas.
                Es <ol> y no <ul> para no confundirse con la leyenda. */}
            {hayDatos && (
                <ol className="sr-only" aria-label={etiquetaLista}>
                    {filas.map((f, i) => <li key={`${f[ejeX]}-${i}`}>{textoFila(f)}</li>)}
                </ol>
            )}
            {hayDatos && leyenda === true && <LeyendaLinea series={series} etiquetaLimite={limite?.etiqueta && (!modelo || modelo.limiteEnLeyenda) ? String(limite.etiqueta) : undefined} />}
            {hayDatos && leyenda !== true && leyenda !== false && leyenda}
        </div>
    );
}
