// Geometría pura de las gráficas hechas a mano (SVG/CSS): sin librerías, sin DOM, fácil de probar.

const entre = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Segmentos de un anillo. `datos` = [{ clave, valor }]; `circunferencia` = longitud total del trazo; `hueco` = separación entre
 * segmentos (en la misma unidad). Devuelve [{ clave, valor, fraccion, largo, inicio }]: `largo` es la parte visible del segmento y `inicio`
 * dónde empieza (con medio hueco de margen). Los valores <= 0 no dibujan segmento. Un solo segmento no lleva hueco.
 */
export function arcosAnillo(datos, circunferencia, hueco = 0) {
    const validos = (datos ?? []).filter((d) => Number(d.valor) > 0);
    const total = validos.reduce((a, d) => a + Number(d.valor), 0);
    if (total <= 0) return [];
    const separacion = validos.length > 1 ? hueco : 0;
    let acumulado = 0;
    return validos.map((d) => {
        const fraccion = Number(d.valor) / total;
        const tramo = fraccion * circunferencia;
        const largo = Math.max(0.01, tramo - separacion);
        const inicio = acumulado + separacion / 2;
        acumulado += tramo;
        return { clave: d.clave, valor: Number(d.valor), fraccion, largo, inicio };
    });
}

/** Posición (0-1) de `valor` dentro de [min, max]; se recorta a los extremos. Dominio degenerado -> 0. */
export function fraccionEnDominio(valor, [min, max]) {
    const v = Number(valor);
    if (!Number.isFinite(v) || !(max > min)) return 0;
    return entre((v - min) / (max - min), 0, 1);
}

/** Dominio [0, tope] que incluye el límite y deja `holgura` de aire sobre el mayor valor. Sin datos: [0, 1]. */
export function dominioAuto(valores, limite, holgura = 1.12) {
    const nums = (valores ?? []).map(Number).filter(Number.isFinite);
    const tope = Math.max(0, limite != null && Number.isFinite(Number(limite)) ? Number(limite) : 0, ...nums);
    return [0, tope > 0 ? tope * holgura : 1];
}

/** Usa `dominio` si trae dos números válidos (min < max); si no, el automático. */
export function dominioFinal(dominio, valores, limite) {
    if (Array.isArray(dominio) && dominio.length === 2) {
        const [a, b] = dominio.map(Number);
        if (Number.isFinite(a) && Number.isFinite(b) && b > a) return [a, b];
        // dominio [0, 'auto']: se respeta el mínimo y se calcula el máximo (un dominio degenerado como [5, 5] cae al automático)
        if (Number.isFinite(a) && !Number.isFinite(b)) return [a, dominioAuto(valores, limite)[1]];
    }
    return dominioAuto(valores, limite);
}

/**
 * Trazo SVG suave (spline monótona de Fritsch-Carlson: nunca se pasa de los datos) por `puntos` = [[x, y], ...] con x creciente.
 * Un punto -> solo "M"; ninguno -> ''.
 */
export function trazoSuave(puntos) {
    const n = puntos?.length ?? 0;
    if (n === 0) return '';
    const f = (v) => Number(v.toFixed(2));
    if (n === 1) return `M${f(puntos[0][0])} ${f(puntos[0][1])}`;
    const dx = [];
    const m = [];
    for (let i = 0; i < n - 1; i += 1) {
        const ancho = puntos[i + 1][0] - puntos[i][0] || 1e-6;
        dx.push(ancho);
        m.push((puntos[i + 1][1] - puntos[i][1]) / ancho);
    }
    const t = [m[0]];
    for (let i = 1; i < n - 1; i += 1) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
    t.push(m[n - 2]);
    for (let i = 0; i < n - 1; i += 1) {
        if (m[i] === 0) {
            t[i] = 0;
            t[i + 1] = 0;
        } else {
            const a = t[i] / m[i];
            const b = t[i + 1] / m[i];
            const s = a * a + b * b;
            if (s > 9) {
                const k = 3 / Math.sqrt(s);
                t[i] = k * a * m[i];
                t[i + 1] = k * b * m[i];
            }
        }
    }
    let d = `M${f(puntos[0][0])} ${f(puntos[0][1])}`;
    for (let i = 0; i < n - 1; i += 1) {
        const h = dx[i] / 3;
        d += ` C${f(puntos[i][0] + h)} ${f(puntos[i][1] + t[i] * h)} ${f(puntos[i + 1][0] - h)} ${f(puntos[i + 1][1] - t[i + 1] * h)} ${f(puntos[i + 1][0])} ${f(puntos[i + 1][1])}`;
    }
    return d;
}

/** Puntos [x, y] en un lienzo `ancho` x `alto` (con `margen`) para una lista de valores; el eje y va de `min` a `max` (por defecto el rango de los datos). */
export function puntosSerie(valores, ancho, alto, { margen = 2, min, max } = {}) {
    const nums = (valores ?? []).map(Number).filter(Number.isFinite);
    if (nums.length === 0) return [];
    const lo = min ?? Math.min(...nums);
    const hi = max ?? Math.max(...nums);
    const rango = hi - lo || 1;
    const paso = nums.length > 1 ? (ancho - margen * 2) / (nums.length - 1) : 0;
    return nums.map((v, i) => [margen + i * paso, margen + (1 - (v - lo) / rango) * (alto - margen * 2)]);
}

// ---- Gráfica de líneas (ui/GraficaLinea): ejes, marcas, interacción y colocación de etiquetas ----

/**
 * Marcas "amigables" para un eje entre `min` y `max`: pasos de 1, 2 o 5 por una potencia de 10, con unas `n` marcas (aprox.).
 * Elige el paso más cercano al ideal (como d3), así 0-22.4 con n=5 da 0, 5, 10, 15, 20 y nunca 0, 4.48, 8.96... Las marcas caen
 * dentro de [min, max]. Entradas no finitas -> []; rango vacío -> [min].
 */
export function ticksAmigables(min, max, n = 5) {
    const a = Number(min);
    const b = Number(max);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
    if (b <= a) return [a];
    const ideal = (b - a) / Math.max(1, Number(n) - 1 || 1);
    const potencia = Math.floor(Math.log10(ideal));
    const error = ideal / 10 ** potencia;
    // Umbrales geométricos (raíz de 2, 10 y 50): el paso elegido queda a la menor distancia relativa del ideal.
    const factor = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
    const paso = factor * 10 ** potencia;
    // toFixed evita 0.6000000000000001 al multiplicar pasos decimales.
    const decimales = Math.max(0, -potencia + (factor === 1 ? 0 : 1));
    const inicio = Math.ceil(a / paso - 1e-9);
    const fin = Math.floor(b / paso + 1e-9);
    const marcas = [];
    for (let k = inicio; k <= fin; k += 1) marcas.push(Number((k * paso).toFixed(decimales)));
    return marcas;
}

/**
 * Qué marcas de un eje se dibujan cuando no caben todas: `posiciones` = centro (px) de cada marca, ordenado; `separacion` = hueco mínimo
 * (px) entre centros. Devuelve los índices a pintar con paso regular (0, p, 2p...): siempre incluye la primera y la última (si la última
 * marca regular queda pegada a la final, cede su lugar). Si ni así caben, deja solo los extremos.
 */
export function adelgazarMarcas(posiciones, separacion) {
    const n = posiciones?.length ?? 0;
    if (n <= 2) return Array.from({ length: n }, (_, i) => i);
    for (let paso = 1; paso < n - 1; paso += 1) {
        const indices = [];
        for (let i = 0; i < n - 1; i += paso) indices.push(i);
        if (indices.length > 1 && posiciones[n - 1] - posiciones[indices[indices.length - 1]] < separacion) indices.pop();
        indices.push(n - 1);
        if (indices.every((idx, k) => k === 0 || posiciones[idx] - posiciones[indices[k - 1]] >= separacion)) return indices;
    }
    return [0, n - 1];
}

/** Índice de la posición (px) más cercana a `x`; empate -> la de la izquierda. Sin posiciones -> -1. */
export function indiceMasCercano(posiciones, x) {
    let mejor = -1;
    let distancia = Infinity;
    (posiciones ?? []).forEach((p, i) => {
        const d = Math.abs(p - x);
        if (d < distancia) {
            distancia = d;
            mejor = i;
        }
    });
    return mejor;
}

/** Trazo SVG de segmentos rectos por `puntos` = [[x, y], ...]. Una línea quebrada es exacta: no inventa curvas entre datos. */
export function trazoPoligonal(puntos) {
    if (!puntos?.length) return '';
    const f = (v) => Number(v.toFixed(2));
    return puntos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`).join(' ');
}

/** Polígono cerrado entre el borde `superior` y el `inferior` (mismos x, mismo largo, >= 2 puntos), de izquierda a derecha y de regreso. */
export function trazoBanda(superior, inferior) {
    if (!superior?.length || superior.length !== inferior?.length || superior.length < 2) return '';
    return `${trazoPoligonal(superior)} ${trazoPoligonal([...inferior].reverse()).replace(/^M/, 'L')} Z`;
}

/**
 * Dominio Y que SIEMPRE contiene el límite: parte de `dominioFinal` y, si el límite queda fuera de un dominio numérico fijado por la
 * persona, lo amplía con la misma holgura del dominio automático (nunca recorta datos ni oculta la línea del límite).
 */
export function dominioConLimite(dominio, valores, limite, holgura = 1.12) {
    let [a, b] = dominioFinal(dominio, valores, limite);
    // [5, 'auto'] con datos menores que 5 deja el tope automático por debajo del mínimo: se abre un rango mínimo en vez de invertirlo.
    if (!(b > a)) b = a + (Math.abs(a) || 1);
    const l = Number(limite);
    if (limite == null || !Number.isFinite(l)) return [a, b];
    return [l < a ? l - Math.abs(l) * (holgura - 1) : a, l > b ? l * holgura : b];
}

/**
 * Dónde poner un tooltip junto a la guía vertical en `x`: a la derecha de la guía y, si no cabe, a la izquierda; siempre dentro del
 * contenedor (`ancho` x `alto`) con `margen` de aire. `y` es el borde superior deseado. Devuelve { left, top, lado }.
 */
export function posicionTooltip({ x, y = 0, ancho, alto, anchoTooltip, altoTooltip, separacion = 14, margen = 4 }) {
    let lado = 'derecha';
    let left = x + separacion;
    if (left + anchoTooltip > ancho - margen) {
        lado = 'izquierda';
        left = x - separacion - anchoTooltip;
    }
    return {
        left: entre(left, margen, Math.max(margen, ancho - anchoTooltip - margen)),
        top: entre(y, margen, Math.max(margen, alto - altoTooltip - margen)),
        lado,
    };
}

/**
 * Caja de la etiqueta del límite: pegada al borde derecho del lienzo (fuera del trazado, donde ya no hay datos) y centrada en la línea
 * `y`, sin salirse del lienzo por arriba ni por abajo. Devuelve { x, y, width, height }.
 */
export function cajaEtiquetaLimite({ y, anchoEtiqueta, altoEtiqueta, anchoTotal, altoTotal, margen = 2 }) {
    return {
        x: Math.max(0, anchoTotal - anchoEtiqueta - margen),
        y: entre(y - altoEtiqueta / 2, 0, Math.max(0, altoTotal - altoEtiqueta)),
        width: anchoEtiqueta,
        height: altoEtiqueta,
    };
}

/** Caja de la etiqueta de una marca vertical: centrada en `x`, en el borde superior y sin salirse del lienzo. */
export function cajaEtiquetaMarca({ x, anchoEtiqueta, altoEtiqueta, anchoTotal }) {
    return { x: entre(x - anchoEtiqueta / 2, 0, Math.max(0, anchoTotal - anchoEtiqueta)), y: 0, width: anchoEtiqueta, height: altoEtiqueta };
}

/** true si dos cajas { x, y, width, height } se pisan (con `holgura` px de aire exigido entre ambas). Rozarse no es pisarse. */
export function cajasSeSolapan(a, b, holgura = 0) {
    return a.x < b.x + b.width + holgura && b.x < a.x + a.width + holgura && a.y < b.y + b.height + holgura && b.y < a.y + a.height + holgura;
}
