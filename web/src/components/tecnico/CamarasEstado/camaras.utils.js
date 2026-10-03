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
