import { anchoTextoEm } from '@/lib/graficas.js';
import { arcosAnillo } from '@/lib/graficasGeometria.js';

// Geometría del anillo en el lienzo SVG de 120 x 120.
export const RADIO = 46;
export const GROSOR = 9;
export const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
// Hueco entre segmentos: mayor que el grosor, porque los extremos redondeados sobresalen medio grosor por lado.
export const HUECO = 12;

/**
 * Lado (px) del anillo para el `alto` pedido. `alto` es una altura de REFERENCIA (240 por defecto): el anillo ocupa lo que
 * queda tras reservar la leyenda (~88 px), con un mínimo legible y un máximo para que no se vea desproporcionado en tarjetas anchas.
 * La altura real del conjunto depende del ancho (la leyenda pasa de una a dos columnas).
 */
export function ladoAnillo(alto) {
    const a = Number.isFinite(Number(alto)) ? Number(alto) : 240;
    return Math.max(120, Math.min(196, a - 88));
}

/**
 * Tamaño (px) de la cifra del centro: 30 px cuando cabe y menos si el texto es largo («100 %», «1,234»), para que nunca toque el anillo.
 * Se estima con el ancho del texto (no se mide el DOM) y el diámetro interior del anillo, así es igual en servidor y cliente.
 */
export function tamanoCentro(texto, lado) {
    const interior = lado * ((2 * (RADIO - GROSOR / 2)) / 120);
    const em = Math.max(anchoTextoEm(String(texto ?? '')), 1);
    return Math.min(30, Math.max(16, Math.floor((interior * 0.92) / em)));
}

/**
 * Un arco por cada dato y en el orden recibido, también los de valor 0 (con `largo` 0). `items` = [{ clave, valor }] con `valor` ya
 * numérico y >= 0. Que cada clave conserve su círculo en el DOM permite que un estado que pasa de 0 a 3 (o al revés) crezca o se
 * encoja con la transición en lugar de aparecer de golpe.
 *
 * Cada arco queda CENTRADO en su tramo proporcional: con tramos mayores que el hueco coincide con el reparto habitual (medio hueco de
 * margen por lado) y un segmento más corto que el hueco se dibuja como un punto en su posición real, no desplazado hacia el siguiente.
 * Un punto es más ancho que su porcentaje (el grosor del trazo): puede rozar a sus vecinos; es el precio de que una cifra pequeña se vea.
 * Devuelve [{ clave, valor, fraccion, largo, inicio }] con `largo` e `inicio` en unidades de circunferencia.
 */
export function arcosEstables(items, circunferencia = CIRCUNFERENCIA, hueco = HUECO) {
    const positivos = arcosAnillo(items, circunferencia, hueco);
    let k = 0;
    let acumulado = 0;
    return items.map((d) => {
        if (!(Number(d.valor) > 0)) return { clave: d.clave, valor: 0, fraccion: 0, largo: 0, inicio: acumulado };
        const arco = positivos[k];
        k += 1;
        const tramo = arco.fraccion * circunferencia;
        const inicio = acumulado + (tramo - arco.largo) / 2;
        acumulado += tramo;
        return { ...arco, inicio };
    });
}
