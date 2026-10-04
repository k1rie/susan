import { formatoNumero, textoPct, valorNoNegativo } from '@/lib/graficas.js';

/** Segundos que dura el movimiento de un segmento cuando cambian los datos (la entrada es más lenta, ver el componente). */
export const DURACION_ACTUALIZACION = 0.5;

/**
 * [{ clave, valor }] con `valor` numérico >= 0 (lo no numérico cuenta como 0, el negativo se recorta a 0), en el orden recibido.
 * Los segmentos de valor 0 se conservan: su nodo sigue en el DOM (colapsado) para poder crecer con la transición cuando dejen de ser 0.
 */
export function normalizarSegmentos(datos) {
    return (datos ?? []).map((d) => ({ clave: d.clave, valor: valorNoNegativo(d.valor) }));
}

/**
 * Ancho mínimo (px) de un segmento con valor > 0. COMPROMISO: sin mínimo, una categoría pequeña (1 de 400 en una barra de 300 px =
 * 0,75 px) desaparecería aunque tenga datos; con mínimo se sobredimensiona un poco y los demás segmentos ceden ese espacio. Se usa la
 * mitad del grosor (6 px en la barra de 12 px, 4 px en la de 8 px, nunca menos de 4): lo bastante para verse como un trazo y poco
 * para no inflar la proporción (en 300 px, 6 px = 2 %). La cifra exacta va siempre en la leyenda o en el aria-label.
 */
export function anchoMinimoSegmento(alto) {
    const a = Number(alto);
    return Math.max(4, Math.round((Number.isFinite(a) ? a : 12) / 2));
}

/** Texto para lectores de pantalla: «Presentes 309 (76 %); Retardos 28 (7 %)». Solo los segmentos con valor; `nombre(clave)` da la etiqueta. */
export function resumenSegmentos(items, nombre) {
    const total = items.reduce((suma, d) => suma + d.valor, 0);
    return items
        .filter((d) => d.valor > 0)
        .map((d) => `${nombre(d.clave)} ${formatoNumero(d.valor)} (${textoPct(d.valor, total)})`)
        .join('; ');
}
