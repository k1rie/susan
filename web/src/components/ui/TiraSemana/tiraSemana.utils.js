import { anchoTextoEm, formatoNumero, numeroOpcional, valorNoNegativo } from '@/lib/graficas.js';

/** Máximo de casillas por fila: una semana. Con más datos la cuadrícula baja a otra fila. */
export const COLUMNAS_MAX = 7;
/** Separación entre casillas (px) y relleno horizontal de cada una (px por lado): entran en el cálculo del tamaño de la cifra. */
export const SEPARACION = 8;
export const RELLENO = 4;
/** Ancho máximo de una casilla (rem): con una sola, la tira no se estira hasta ocupar toda la tarjeta. */
export const ANCHO_CASILLA_REM = 7;
export const FUENTE_MIN = 11;
export const FUENTE_MAX = 16;
export const FUENTE_ETIQUETA_MIN = 10;
export const FUENTE_ETIQUETA_MAX = 12;
/** La unidad se escribe más pequeña que la cifra: proporción respecto al tamaño de la cifra. */
export const ESCALA_UNIDAD = 0.7;
/** Mezcla máxima (%) del color de ausencia en la casilla más intensa: deja el texto legible sobre el fondo. */
export const MEZCLA_MAXIMA = 72;

/** [{ etiqueta, valor }] con `valor` número >= 0 o null («sin dato»); null, '' o no numérico NO son 0: la casilla queda neutra. */
export function normalizarCasillas(datos) {
    return (datos ?? []).map((d) => {
        const bruto = numeroOpcional(d?.valor);
        return { etiqueta: String(d?.etiqueta ?? ''), valor: bruto === null ? null : valorNoNegativo(bruto) };
    });
}

/** Límite válido (> 0) o null. */
export function limiteValido(limite) {
    const n = numeroOpcional(limite);
    return n !== null && n > 0 ? n : null;
}

/**
 * Valor que corresponde a la intensidad máxima. Con límite es 1,25 x el límite (quien lo alcanza queda al 80 % y deja margen para ver
 * quién lo rebasa); sin límite, el mayor de los valores (la casilla más alta es la más intensa). Sin ningún valor positivo: 0.
 */
export function escalaTira(valores, limite) {
    const lim = limiteValido(limite);
    if (lim !== null) return lim * 1.25;
    return Math.max(0, ...valores.filter((v) => v !== null));
}

/** Intensidad 0-1 de una casilla; sin dato o con escala 0 es 0 (ni se tiñe). */
export function intensidadCasilla(valor, escala) {
    if (valor === null || !(escala > 0)) return 0;
    return Math.min(1, Math.max(0, valor / escala));
}

/** Porcentaje de color de ausencia que se mezcla con el fondo neutro. */
export function mezclaCasilla(intensidad) {
    return Math.round(intensidad * MEZCLA_MAXIMA);
}

/** 'sobre' si el valor rebasa el límite, 'en' si lo iguala, null si no lo alcanza (o no hay límite o dato). */
export function estadoLimite(valor, limite) {
    const lim = limiteValido(limite);
    if (lim === null || valor === null) return null;
    if (valor > lim) return 'sobre';
    return valor === lim ? 'en' : null;
}

/** Texto accesible de una casilla que alcanza o rebasa el límite. */
export function textoLimite(estado, limite, unidad) {
    const cifra = `${formatoNumero(limiteValido(limite))}${unidad}`;
    return estado === 'sobre' ? `(sobre el límite de ${cifra})` : `(en el límite de ${cifra})`;
}

// Ancho útil (CSS) de una casilla: el contenedor es de consultas (`@container`), así que `cqw` es su ancho. Se le restan las
// separaciones entre casillas (se reparten entre las columnas) y el relleno horizontal de la casilla.
function anchoCasillaCss(columnas) {
    return `((100cqw - ${(columnas - 1) * SEPARACION}px) / ${columnas} - ${RELLENO * 2}px)`;
}

/**
 * Tamaño de fuente (CSS) de la cifra para que quepa en la casilla sin desbordar y sin medir el DOM: la cifra se estima en «em»
 * (cifra + unidad reducida) y la fuente es la que hace que quepa, entre 11 y 16 px.
 */
export function tamanoValorCss(columnas, textos, unidad) {
    const em = Math.max(
        1,
        ...textos.map((t) => anchoTextoEm(t) + ESCALA_UNIDAD * anchoTextoEm(String(unidad ?? '').trim())),
    );
    return `clamp(${FUENTE_MIN}px, calc(${anchoCasillaCss(columnas)} / ${em.toFixed(2)}), ${FUENTE_MAX}px)`;
}

/** Igual para el nombre de la casilla (12 px como máximo, 10 como mínimo): un «Dom» no debe cortarse en una casilla estrecha. */
export function tamanoEtiquetaCss(columnas, etiquetas) {
    const em = Math.max(1, ...etiquetas.map((t) => anchoTextoEm(t)));
    return `clamp(${FUENTE_ETIQUETA_MIN}px, calc(${anchoCasillaCss(columnas)} / ${em.toFixed(2)}), ${FUENTE_ETIQUETA_MAX}px)`;
}
