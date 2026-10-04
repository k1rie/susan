import { anchoTextoEm, numeroOpcional } from '@/lib/graficas.js';
import { fraccionEnDominio } from '@/lib/graficasGeometria.js';

// ---- Medidas de la composición en columnas (px). Deben coincidir con las clases del componente (top-6, bottom-7, text-xs). ----
export const MARGEN_SUPERIOR = 24;
export const MARGEN_INFERIOR = 28;
/** Alto de la línea de una cifra (text-xs). */
export const ALTO_CIFRA = 16;
/** Aire entre la punta de la barra y su cifra. */
export const DISTANCIA_CIFRA = 6;
/** Aire entre una cifra desplazada y la línea de límite. */
export const DISTANCIA_LINEA = 4;
/** Cuánto se acerca una cifra a la línea de límite antes de considerarse choque. */
export const MARGEN_LINEA = 3;
/** Separación entre las barras de una misma categoría (varias series sin apilar). */
export const SEPARACION_BARRAS = 4;
export const ANCHO_BARRA_UNICA = 48;
export const ANCHO_BARRA_MULTIPLE = 28;
/** La barra (o el grupo de barras) ocupa este tanto de la ranura de su categoría (inset-x-[12%] por lado). */
export const FRACCION_GRUPO = 0.76;
export const FUENTE_CIFRA = 12;
export const FUENTE_CIFRA_MIN = 9;
/** Tamaño (px) de los nombres de categoría de las columnas: 12 si caben y hasta 10 si no; más angosto se cortan con puntos suspensivos. */
export const FUENTE_ETIQUETA = 12;
export const FUENTE_ETIQUETA_MIN = 10;
/** Aire mínimo entre dos cifras vecinas. */
export const MARGEN_ENTRE_CIFRAS = 4;
/** Si ni abreviadas caben cada `SALTO_MAXIMO` columnas, las cifras de las columnas se omiten (siguen en el title y en el texto para lectores). */
export const SALTO_MAXIMO = 4;

const redondear = (v) => Number(v.toFixed(1));

/** Valor de una serie en una fila: número >= 0 (el negativo se trata como 0) o null si falta, es '' o no es numérico («sin dato»). */
export function valorSerie(fila, clave) {
    const n = numeroOpcional(fila?.[clave]);
    return n === null ? null : Math.max(0, n);
}

/**
 * Filas listas para dibujar: `etiqueta` (texto de la categoría), `partes` = [{ clave, valor }] en el orden de `series` y `total`
 * (suma si `apilado`, el mayor si no; null si NINGUNA serie tiene dato). Un null no es un 0: no dibuja barra ni entra en el total.
 */
export function armarFilas({ datos, ejeX, series, apilado }) {
    return (datos ?? []).map((d) => {
        const partes = series.map((s) => ({ clave: s.clave, valor: valorSerie(d, s.clave) }));
        const valores = partes.map((p) => p.valor).filter((v) => v !== null);
        const total = valores.length === 0 ? null : apilado ? valores.reduce((a, v) => a + v, 0) : Math.max(...valores);
        return { etiqueta: String(d?.[ejeX] ?? ''), partes, total };
    });
}

/** ¿Alguna fila tiene al menos un dato? Si todo es null no hay nada que graficar. */
export function hayDatos(filas) {
    return filas.some((f) => f.total !== null);
}

/**
 * Pistas de una fila. Una sola pista (barra) si las series se apilan o hay una serie; si no, UNA POR SERIE, lado a lado dentro de la
 * categoría (antes se solapaban todas desde 0). Cada pista lleva su cifra: el total de la pista (el valor de la serie si va sola).
 */
export function pistasDeFila(fila, apilado) {
    if (apilado || fila.partes.length <= 1) {
        return [{ clave: apilado ? 'apilada' : (fila.partes[0]?.clave ?? 'serie'), partes: fila.partes, cifra: fila.total }];
    }
    return fila.partes.map((p) => ({ clave: p.clave, partes: [p], cifra: p.valor }));
}

/**
 * Segmentos de una pista como fracciones (0-1) del dominio: `inicio`, `largo` y `dibujar`. Con `apilado` cada segmento empieza donde
 * termina el anterior. Los bordes son fr(acumulado), no una suma de fracciones, así que un dominio con mínimo distinto de 0 o
 * negativo queda bien. Lo que rebasa el máximo del dominio se recorta (un segmento fuera de la escala no se dibuja).
 */
export function tramosDePista(partes, dominio, apilado) {
    let acumulado = 0;
    return partes.map((p) => {
        const valor = p.valor ?? 0;
        const desde = apilado ? acumulado : 0;
        const inicio = fraccionEnDominio(desde, dominio);
        const fin = fraccionEnDominio(desde + valor, dominio);
        if (apilado) acumulado += valor;
        const largo = Math.max(0, fin - inicio);
        return { clave: p.clave, valor, inicio, largo, dibujar: valor > 0 && largo > 0 };
    });
}

const porcentaje = (fraccion) => Number((fraccion * 100).toFixed(3));

/**
 * Estilo (posición y tamaño) de un segmento dentro de su pista. 1 px de margen por lado deja 2 px entre segmentos apilados; el mínimo
 * de 4 px hace visible un valor pequeño (la proporción exacta va en la cifra). Un segmento sin dibujar queda colapsado e invisible
 * pero SE CONSERVA: así crece con la transición cuando deja de valer 0.
 */
export function estiloSegmento(tramo, horizontal) {
    const largo = tramo.dibujar ? `calc(${porcentaje(tramo.largo)}% - 2px)` : '0px';
    const minimo = tramo.dibujar ? 4 : 0;
    const opacity = tramo.dibujar ? 1 : 0;
    return horizontal
        ? { left: `calc(${porcentaje(tramo.inicio)}% + 1px)`, width: largo, minWidth: minimo, top: 0, bottom: 0, opacity }
        : { bottom: `calc(${porcentaje(tramo.inicio)}% + 1px)`, height: largo, minHeight: minimo, left: 0, right: 0, opacity };
}

/** Alto (px) del plano de las columnas, entre los márgenes de cifras (arriba) y categorías (abajo). */
export function alturaPlano(alto) {
    const a = Number(alto);
    return Math.max(0, (Number.isFinite(a) ? a : 260) - MARGEN_SUPERIOR - MARGEN_INFERIOR);
}

/** Separación entre columnas: 12 px hasta 8 columnas y menos cuando hay muchas (con 12 px, 30 columnas no cabrían en 360 px). */
export function separacionColumnas(columnas) {
    if (columnas <= 8) return 12;
    return columnas <= 16 ? 8 : 4;
}

/** Ancho máximo (px) del grupo de barras de una categoría. */
export function anchoGrupoMaximo(barras) {
    return barras <= 1 ? ANCHO_BARRA_UNICA : barras * ANCHO_BARRA_MULTIPLE + (barras - 1) * SEPARACION_BARRAS;
}

/**
 * Distancia MÍNIMA (px) entre los centros de dos cifras vecinas, que es lo que limita su ancho. Una barra por categoría: de un centro de
 * categoría al siguiente. Varias barras por categoría: entre las barras de un mismo grupo (más cerca que entre categorías).
 * `ancho` = ancho del área de columnas; null si aún no se midió (servidor o primera pintura) o es 0.
 */
export function pasoEntreCifras({ ancho, categorias, barras }) {
    if (!(ancho > 0) || categorias < 1) return null;
    const separacion = separacionColumnas(categorias);
    const ranura = (ancho - (categorias - 1) * separacion) / categorias;
    if (barras <= 1) return ranura + separacion;
    const grupo = Math.min(ranura * FRACCION_GRUPO, anchoGrupoMaximo(barras));
    const barra = (grupo - (barras - 1) * SEPARACION_BARRAS) / barras;
    return Math.max(0, barra + SEPARACION_BARRAS);
}

/** Ancho (px) de la ranura de cada categoría en las columnas; null si aún no se midió el contenedor. */
export function ranuraCategoria({ ancho, categorias }) {
    if (!(ancho > 0) || categorias < 1) return null;
    return (ancho - (categorias - 1) * separacionColumnas(categorias)) / categorias;
}

/**
 * Tamaño (px) de los nombres de categoría para que quepan enteros en su ranura: el mayor entre 10 y 12 px que acomode al nombre más ancho
 * (estimado, ver anchoTextoEm). Si ni a 10 px caben, queda en 10 y el nombre se corta con puntos suspensivos (el title lo trae completo).
 */
export function fuenteEtiquetas({ ranura, etiquetas }) {
    if (ranura == null) return FUENTE_ETIQUETA;
    const em = Math.max(0, ...etiquetas.map((t) => anchoTextoEm(t)));
    if (em === 0) return FUENTE_ETIQUETA;
    const f = Math.floor(((ranura - 2) / em) * 2) / 2;
    return Math.max(FUENTE_ETIQUETA_MIN, Math.min(FUENTE_ETIQUETA, f));
}

/**
 * Cómo rotular las cifras de las columnas para que NO se solapen entre sí. Estima el ancho de los textos (anchoTextoEm) y busca, en
 * este orden, la primera opción que cabe en `paso` - margen:
 *   1. 'completo': texto con unidad, de 12 px hacia abajo hasta 9 px
 *   2. 'corto': texto sin unidad (`cortos`), igual
 *   3. 'corto' en 9 px y solo una de cada `cada` columnas (2 a 4)
 *   4. 'oculto': ni así caben; las cifras siguen en el title de cada columna y en el texto para lectores de pantalla
 * `completos` y `cortos` = textos de TODAS las cifras (se usa el más ancho, para que el tamaño sea uniforme). Sin `paso` (aún no se midió)
 * devuelve el tamaño normal: es igual en servidor y cliente.
 */
export function planCifras({ paso, completos, cortos }) {
    if (paso == null) return { modo: 'completo', fuente: FUENTE_CIFRA, cada: 1 };
    const disponible = paso - MARGEN_ENTRE_CIFRAS;
    const emMayor = (textos) => Math.max(0, ...textos.map((t) => anchoTextoEm(t)));
    const fuenteQueCabe = (textos) => {
        const em = emMayor(textos);
        if (em === 0) return FUENTE_CIFRA;
        const f = Math.min(FUENTE_CIFRA, Math.floor((disponible / em) * 2) / 2);
        return f >= FUENTE_CIFRA_MIN ? f : null;
    };
    const completa = fuenteQueCabe(completos);
    if (completa !== null) return { modo: 'completo', fuente: completa, cada: 1 };
    const corta = fuenteQueCabe(cortos);
    if (corta !== null) return { modo: 'corto', fuente: corta, cada: 1 };
    const cada = Math.ceil((emMayor(cortos) * FUENTE_CIFRA_MIN + MARGEN_ENTRE_CIFRAS) / Math.max(paso, 1));
    if (cada <= SALTO_MAXIMO) return { modo: 'corto', fuente: FUENTE_CIFRA_MIN, cada };
    return { modo: 'oculto', fuente: FUENTE_CIFRA_MIN, cada: 0 };
}

/**
 * Posición `bottom` (px, desde la base del plano) de la cifra de una columna: 6 px sobre la punta de la barra, salvo que ese lugar
 * choque con la línea de límite; en ese caso se coloca justo encima de la línea. Así la línea nunca atraviesa un número.
 * `fraccion` = altura de la barra (0-1) y `fraccionLimite` = altura de la línea (0-1) o null si no se dibuja.
 */
export function posicionCifra({ fraccion, fraccionLimite, alturaPlano: altura }) {
    const natural = fraccion * altura + DISTANCIA_CIFRA;
    if (fraccionLimite == null) return redondear(natural);
    const linea = fraccionLimite * altura;
    const choca = linea > natural - MARGEN_LINEA && linea < natural + ALTO_CIFRA + MARGEN_LINEA;
    return redondear(choca ? linea + DISTANCIA_LINEA : natural);
}

/**
 * Ancho (CSS) de la columna de cifras en el modo horizontal: 2,5 rem como mínimo y más si algún texto es largo (p. ej. un
 * `formatoValor` con unidad). `ch` es el ancho de un dígito de la fuente del contenedor; con +1 sobra para «%» y los espacios.
 * 2,5 rem ya cubre cifras de hasta 4 caracteres sin que la columna cambie de ancho en cada sondeo; un piso mayor le quita a la pista
 * de barras, en 360 px, un tercio de su ancho para una cifra de 1 a 3 caracteres.
 */
export function anchoColumnaValor(caracteres) {
    const n = Math.min(16, (Number.isFinite(caracteres) ? caracteres : 0) + 1);
    return `max(2.5rem, ${n}ch)`;
}

/**
 * Texto de una fila para el title y para lectores de pantalla. Las series sin dato no se listan; con varias series apiladas se añade el
 * total (es la cifra que se ve). `mostrar(valor)` formatea una cifra; `nombreSerie(clave)` da la etiqueta de la serie.
 */
export function detalleFila(fila, { apilado, mostrar, nombreSerie }) {
    const conDato = fila.partes.filter((p) => p.valor !== null);
    if (conDato.length === 0) return `${fila.etiqueta}: sin datos`;
    if (fila.partes.length === 1) return `${fila.etiqueta}: ${mostrar(conDato[0].valor)}`;
    const lista = conDato.map((p) => `${nombreSerie(p.clave)} ${mostrar(p.valor)}`).join(' · ');
    return apilado && conDato.length > 1 ? `${fila.etiqueta}: ${lista} · total ${mostrar(fila.total)}` : `${fila.etiqueta}: ${lista}`;
}
