// Datos de la gráfica «Faltas vs límite»: alumnos en alerta, de mayor a menor porcentaje de faltas equivalentes.
import { formatoPct, resumenTexto } from '@/lib/graficas.js';

export const MAX_BARRAS = 8;

// Faltas en tono de ausencia (token); la línea del límite la pinta BarrasPildora. La unidad (' %') sale en la cifra de cada fila.
export const CONFIG_FALTAS = { faltas: { label: 'Faltas equivalentes', color: 'var(--ausente)' } };

// Las etiquetas de BarrasPildora ocupan hasta 2 líneas en una columna de ~120-150 px (a 360 px, el 42 % del ancho). Con la clave del
// grupo al final, el nombre se acota más para que ese cierre («· 3A») no caiga en una tercera línea y se corte.
export const MAX_NOMBRE = 26;
export const MAX_NOMBRE_CON_GRUPO = 20;
// Espacios duros alrededor del punto medio: así «· 3A» viaja pegado a la última palabra del nombre y nunca queda un «·» huérfano al
// inicio de la segunda línea.
const SEPARADOR_GRUPO = '\u00A0·\u00A0';

/** Nombre acotado para la etiqueta de la fila: un nombre muy largo no cabe en las 2 líneas de la columna de nombres. */
export function nombreCorto(nombre, max = MAX_NOMBRE) {
    const t = String(nombre ?? '').trim();
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Arma { datos, limite, dominio, graficables } para BarrasPildora. `limite` es el mayor límite de las alertas (normalmente
 * todos comparten el 20 %); el dominio siempre lo incluye para que la línea quede dentro de la gráfica. `graficables` =
 * alertas con porcentaje antes de acotar a `max`: permite avisar que hay más de las que se ven sin contar las que no
 * tienen dato (esas nunca se grafican).
 */
export function datosGraficaAlertas(alertas, max = MAX_BARRAS) {
    const validas = (Array.isArray(alertas) ? alertas : [])
        // Number(null) es 0: sin porcentaje no se grafica una barra en cero.
        .filter((a) => a?.porcentaje_faltas != null && a.porcentaje_faltas !== '')
        .map((a) => ({ a, faltas: Number(a.porcentaje_faltas) }))
        .filter((x) => Number.isFinite(x.faltas))
        .sort((x, y) => y.faltas - x.faltas);
    const graficables = validas.length;
    validas.splice(max);
    if (validas.length === 0) return { datos: [], limite: null, dominio: [0, 100], graficables };

    const usados = new Map();
    const datos = validas.map(({ a, faltas }) => {
        // Con el grupo en la etiqueta, el mismo alumno en dos grupos (o dos homónimos) se distingue en el eje.
        const base = a.clave_grupo ? `${nombreCorto(a.nombre, MAX_NOMBRE_CON_GRUPO)}${SEPARADOR_GRUPO}${a.clave_grupo}` : nombreCorto(a.nombre);
        const n = (usados.get(base) ?? 0) + 1;
        usados.set(base, n);
        // Dos alumnos con el mismo nombre acotado se confundirían en la lista (y compartirían clave de fila).
        return { alumno: n > 1 ? `${base} (${n})` : base, faltas: Number(faltas.toFixed(1)) };
    });
    const limites = validas.map(({ a }) => Number(a.limite_pct)).filter((l) => Number.isFinite(l) && l > 0);
    const limite = limites.length ? Math.max(...limites) : null;
    const tope = Math.max(limite ?? 0, ...datos.map((d) => d.faltas));
    return { datos, limite, dominio: [0, Math.max(10, Math.ceil(tope * 1.15))], graficables };
}

/** Texto alternativo de la gráfica. */
export function resumenAlertas(datos, limite) {
    if (!datos.length) return 'Sin alumnos en alerta.';
    const lista = resumenTexto(datos.map((d) => ({ clave: d.alumno, valor: d.faltas })), {}).replace(/ \(\d+ %\)/g, ' %');
    return `Faltas equivalentes por alumno${limite ? `, límite ${formatoPct(limite)}` : ''}: ${lista}.`;
}
