// Utilidades de la lista de cámaras.

export const ESTATUS_CAMARA = [
    { value: 'activa', label: 'Activa' },
    { value: 'inactiva', label: 'Inactiva' },
    { value: 'mantenimiento', label: 'Mantenimiento' },
];

/** Una cámara activa sin capturas en 24 h merece alerta visual (posible falla). */
export function sinCapturar(camara) {
    return camara.estatus === 'activa' && !(camara.capturas_24h > 0);
}

/** Texto "hace N min" a partir de una fecha ISO; null -> "Sin capturas". */
export function haceCuanto(fechaIso, ahora = Date.now()) {
    if (!fechaIso) return 'Sin capturas';
    const min = Math.max(0, Math.round((ahora - new Date(fechaIso).getTime()) / 60000));
    if (min < 1) return 'hace menos de 1 min';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} d`;
}

export function mensajeCambio(camara, nuevo) {
    const base = `Cambiar la cámara ${camara.aula_clave} (${camara.posicion}) a ${nuevo}.`;
    return nuevo === 'activa' ? base : `${base} Las sesiones nuevas del aula pasarán a pase manual si no queda otra cámara activa.`;
}

/** Contadores de cabecera: activas, inactivas (incluye mantenimiento) y activas sin capturas en 24 h. */
export function contadoresCamaras(items = []) {
    const lista = items || [];
    const activas = lista.filter((c) => c.estatus === 'activa').length;
    return {
        total: lista.length,
        activas,
        inactivas: lista.length - activas,
        sinCapturas: lista.filter(sinCapturar).length,
    };
}

export const CONFIG_CAPTURAS = { capturas: { label: 'Capturas en 24 h', color: 'var(--chart-1)' } };

export const MAX_BARRAS = 12;

/**
 * Filas de "Capturas en 24 h por cámara": las `max` con más capturas (de mayor a menor). Si dos cámaras comparten aula y posición
 * se añade su id para que no se mezclen en la lista. `omitidas` = cuántas quedaron fuera. El nombre va completo: la columna de nombres
 * de BarrasPildora lo parte en 2 líneas y su `title` lo trae entero, así que no hace falta recortarlo.
 */
export function datosCapturas(items = [], max = MAX_BARRAS) {
    const lista = [...(items || [])].sort((a, b) => (Number(b.capturas_24h) || 0) - (Number(a.capturas_24h) || 0));
    const nombres = lista.map((c) => `${c.aula_clave} · ${c.posicion}`);
    const repetidos = new Set(nombres.filter((n, i) => nombres.indexOf(n) !== i));
    const filas = lista.slice(0, max).map((c, i) => ({
        camara: repetidos.has(nombres[i]) ? `${nombres[i]} #${c.id_camara}` : nombres[i],
        capturas: Number(c.capturas_24h) || 0,
    }));
    return { filas, omitidas: Math.max(0, lista.length - filas.length) };
}

/** Texto alternativo de la gráfica de capturas. */
export function resumenCapturas({ filas, omitidas }) {
    if (!filas.length) return 'Sin cámaras.';
    const texto = filas.map((f) => `${f.camara}: ${f.capturas}`).join('; ');
    return omitidas > 0 ? `${texto}. Otras ${omitidas} cámaras no se muestran.` : texto;
}
