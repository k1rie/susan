// Utilidades puras de GraficaLinea: normalización de datos, textos y el modelo geométrico (píxeles) que dibuja el lienzo.
import { colorGrafica } from '@/lib/graficas.js';
import { adelgazarMarcas, cajaEtiquetaLimite, cajaEtiquetaMarca, dominioConLimite, ticksAmigables, trazoBanda, trazoPoligonal } from '@/lib/graficasGeometria.js';

export const SIN_VALOR = '-';
export const FUENTE = 11;
export const ALTO_ETIQUETA = 20;
export const TIPOS = ['puntos', 'linea', 'banda'];

const RADIO_PUNTO = 4;
const GROSOR_LINEA = 2;
// Aire entre el borde del trazado y los puntos extremos (que el punto y su aro no toquen el eje).
const AIRE_X = 10;
const ESPACIO_EJE_X = 28;
const SEPARACION_ETIQUETA_LIMITE = 8;
// Si la etiqueta del límite ocupa más de esta fracción del ancho, va a la leyenda y no dentro de la gráfica.
const FRACCION_MAXIMA_ETIQUETA = 0.2;

const NUMERO = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/** Formato numérico por defecto de los ejes y el tooltip (es-MX, hasta 2 decimales). */
export const formatoNumero = (valor) => NUMERO.format(valor);

export const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);

/** Ancho aproximado (px) de un texto de `fuente` px: sin medir el DOM, para reservar márgenes igual en servidor y cliente. */
export function estimarAnchoTexto(texto, fuente = FUENTE) {
    return String(texto ?? '').length * fuente * 0.58;
}

/** Filas con `ejeX` numérico, ordenadas por x (copia: no toca los datos recibidos). */
export function prepararFilas(datos, ejeX) {
    return (datos ?? []).filter((fila) => fila && esNumero(fila[ejeX])).sort((a, b) => a[ejeX] - b[ejeX]);
}

/**
 * Valor de una serie en una fila: número, [inferior, superior] (bandas) o null cuando falta o no es numérico (hueco).
 * Una banda con un solo extremo nulo es un hueco completo.
 */
export function valorSerie(fila, serie) {
    const v = fila?.[serie.clave];
    if (serie.tipo === 'banda') {
        if (!Array.isArray(v) || !esNumero(v[0]) || !esNumero(v[1])) return null;
        return [Math.min(v[0], v[1]), Math.max(v[0], v[1])];
    }
    return esNumero(v) ? v : null;
}

/** Forma de la muestra de leyenda/tooltip de una serie: punto, linea, discontinua o banda. */
export function formaDeSerie({ tipo, discontinua } = {}) {
    if (tipo === 'puntos') return 'punto';
    if (tipo === 'banda') return 'banda';
    return discontinua ? 'discontinua' : 'linea';
}

/** Texto de un valor de serie: número formateado, "a - b" para bandas y guion para huecos. */
export function textoValor(valor, formatoY) {
    if (valor == null) return SIN_VALOR;
    if (Array.isArray(valor)) return `${formatoY(valor[0])} a ${formatoY(valor[1])}`;
    return formatoY(valor);
}

/** Frase para lectores de pantalla de una fila: "Semana 6. Observada: 12 %; Ajuste: 11 %". Los huecos no se leen. */
export function descripcionPorDefecto({ fila, titulo, series, formatoY }) {
    const partes = series.flatMap((serie) => {
        const valor = valorSerie(fila, serie);
        return valor == null ? [] : [`${serie.etiqueta ?? serie.clave}: ${textoValor(valor, formatoY)}`];
    });
    return partes.length ? `${titulo}. ${partes.join('; ')}` : `${titulo}. Sin valores.`;
}

/**
 * Modelo geométrico de la gráfica en píxeles reales (el SVG no se escala: el texto no se deforma). `filas` ya viene de prepararFilas y
 * `ancho` > 0. `etiquetaLimiteEnGrafica` = false cuando la leyenda es la dueña de explicar el límite (se decide por ancho, ver abajo).
 *
 * Reglas de colocación:
 *  - el dominio Y incluye siempre el límite; el X incluye la marca vertical;
 *  - la etiqueta del límite va en un margen derecho reservado (a la derecha del último dato, nunca sobre el trazado) si ocupa poco
 *    ancho; si no cabe, no se dibuja dentro y la leyenda la lleva;
 *  - la etiqueta de la marca vertical va sobre el trazado, en un margen superior reservado.
 */
export function construirModelo({ filas, series, ejeX, limite, marcaX, dominioY, ancho, alto, formatoX, formatoY, leyendaExplicaLimite = true }) {
    if (!filas.length || !(ancho > 0)) return null;
    const valorLimite = esNumero(limite?.valor) ? limite.valor : null;
    const valorMarca = esNumero(marcaX?.valor) ? marcaX.valor : null;

    // ---- Dominios y marcas del eje Y
    const todosLosValores = filas.flatMap((fila) => series.flatMap((serie) => {
        const v = valorSerie(fila, serie);
        return v == null ? [] : [].concat(v);
    }));
    const dom = [...dominioConLimite(dominioY, todosLosValores, valorLimite)];
    // Igual que recharts sin allowDataOverflow: un mínimo numérico con tope automático cede si los datos bajan de él (el ajuste o la
    // proyección de un acumulado pueden dar < 0 en las primeras semanas); sin esto el trazo se dibuja bajo la línea base, sobre las
    // marcas del eje X. Un dominio fijado a mano en AMBOS extremos se sigue respetando tal cual.
    const dominioFijo = Array.isArray(dominioY) && dominioY.length === 2 && dominioY.map(Number).every(Number.isFinite) && Number(dominioY[1]) > Number(dominioY[0]);
    const minimoDatos = Math.min(...todosLosValores);
    if (!dominioFijo && minimoDatos < dom[0]) dom[0] = minimoDatos;
    const marcasY = ticksAmigables(dom[0], dom[1], Math.max(3, Math.min(6, Math.round((alto - 40) / 48))));
    const textosY = marcasY.map((v) => String(formatoY(v)));

    // ---- Márgenes
    const textoLimite = limite?.etiqueta ? String(limite.etiqueta) : '';
    const anchoCajaLimite = textoLimite ? Math.ceil(estimarAnchoTexto(textoLimite) + 16) : 0;
    const limiteEnGrafica = Boolean(textoLimite) && (!leyendaExplicaLimite || anchoCajaLimite + SEPARACION_ETIQUETA_LIMITE <= ancho * FRACCION_MAXIMA_ETIQUETA);
    const textoMarca = marcaX?.etiqueta ? String(marcaX.etiqueta) : '';
    const izq = Math.min(Math.ceil(Math.max(0, ...textosY.map((t) => estimarAnchoTexto(t)))) + 12, ancho * 0.3);
    const der = ancho - (limiteEnGrafica ? anchoCajaLimite + SEPARACION_ETIQUETA_LIMITE : 12);
    // Con etiqueta de marca el margen superior es lo bastante alto para que ni siquiera un límite pegado al tope la roce.
    const arriba = textoMarca ? ALTO_ETIQUETA + 12 : 10;
    const abajo = Math.max(arriba + 20, alto - ESPACIO_EJE_X);

    // ---- Escalas
    const xs = filas.map((fila) => fila[ejeX]);
    const xsDominio = valorMarca == null ? xs : [...xs, valorMarca];
    const xMin = Math.min(...xsDominio);
    const xMax = Math.max(...xsDominio);
    const xIni = izq + AIRE_X;
    const xFin = Math.max(xIni + 1, der - AIRE_X);
    const escX = (x) => (xMax > xMin ? xIni + ((x - xMin) / (xMax - xMin)) * (xFin - xIni) : (xIni + xFin) / 2);
    // Sin recortar: un dominio Y fijado a mano que deje datos fuera los deja fuera del trazado (no los falsea apilándolos en el borde).
    const escY = (v) => abajo - ((v - dom[0]) / (dom[1] - dom[0])) * (abajo - arriba);
    const posiciones = xs.map(escX);

    // ---- Marcas del eje X (una por x distinta; se adelgazan si no caben, conservando primera y última)
    const unicas = [...new Set(xs)];
    const textosX = unicas.map((x) => String(formatoX(x)));
    const separacionX = Math.max(0, ...textosX.map((t) => estimarAnchoTexto(t))) + 16;
    const marcasX = adelgazarMarcas(unicas.map(escX), separacionX).map((i) => ({ valor: unicas[i], x: escX(unicas[i]), texto: textosX[i] }));

    // ---- Series
    const modeloSeries = series.map((serie, orden) => {
        const tipo = TIPOS.includes(serie.tipo) ? serie.tipo : 'linea';
        const puntos = [];
        filas.forEach((fila, indice) => {
            const v = valorSerie(fila, { clave: serie.clave, tipo });
            if (v == null) return; // hueco: la línea se une por encima (connectNulls)
            const x = posiciones[indice];
            puntos.push(Array.isArray(v) ? { indice, x, valor: v, ySup: escY(v[1]), yInf: escY(v[0]) } : { indice, x, valor: v, y: escY(v) });
        });
        const discontinua = tipo === 'linea' && Boolean(serie.discontinua);
        let trazo = '';
        if (tipo === 'linea') trazo = trazoPoligonal(puntos.map((p) => [p.x, p.y]));
        if (tipo === 'banda') trazo = trazoBanda(puntos.map((p) => [p.x, p.ySup]), puntos.map((p) => [p.x, p.yInf]));
        return {
            clave: serie.clave,
            etiqueta: serie.etiqueta ?? serie.clave,
            orden,
            tipo,
            discontinua,
            forma: formaDeSerie({ tipo, discontinua }),
            color: colorGrafica(serie.color ?? 'var(--g-azul)'),
            grosor: esNumero(serie.grosor) && serie.grosor > 0 ? serie.grosor : tipo === 'puntos' ? RADIO_PUNTO : GROSOR_LINEA,
            puntos,
            trazo,
        };
    });

    // ---- Límite y marca vertical
    const yLimite = valorLimite == null ? null : escY(valorLimite);
    const xMarca = valorMarca == null ? null : escX(valorMarca);
    return {
        ancho,
        alto,
        dom,
        izq,
        der,
        arriba,
        abajo,
        xIni,
        xFin,
        posiciones,
        marcasY: marcasY.map((valor, i) => ({ valor, y: escY(valor), texto: textosY[i] })),
        marcasX,
        series: modeloSeries,
        limite: yLimite == null ? null : {
            y: yLimite,
            etiqueta: textoLimite,
            caja: limiteEnGrafica ? cajaEtiquetaLimite({ y: yLimite, anchoEtiqueta: anchoCajaLimite, altoEtiqueta: ALTO_ETIQUETA, anchoTotal: ancho, altoTotal: alto }) : null,
        },
        limiteEnLeyenda: Boolean(textoLimite) && !limiteEnGrafica,
        marca: xMarca == null ? null : {
            x: xMarca,
            etiqueta: textoMarca,
            caja: textoMarca ? cajaEtiquetaMarca({ x: xMarca, anchoEtiqueta: Math.ceil(estimarAnchoTexto(textoMarca) + 16), altoEtiqueta: ALTO_ETIQUETA, anchoTotal: ancho }) : null,
        },
    };
}
