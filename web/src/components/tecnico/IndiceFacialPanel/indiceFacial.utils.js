import { pct, resumenTexto, sumar } from '@/lib/graficas.js';

// Datos del anillo de plantillas del índice facial (conteos de api_estado_indice; nunca vectores ni imágenes, RNF-03).

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const CONFIG_PLANTILLAS = {
    indexada: { label: 'Indexadas', color: 'var(--presente)' },
    pendiente: { label: 'Pendientes', color: 'var(--retardo)' },
};

export function datosPlantillas(p = {}) {
    return [
        { clave: 'indexada', valor: num(p?.indexadas) },
        { clave: 'pendiente', valor: num(p?.pendientes) },
    ];
}

/** % de plantillas activas ya indexadas (0 si no hay plantillas). */
export function porcentajeIndexado(p = {}) {
    return pct(num(p?.indexadas), sumar(datosPlantillas(p)), 0);
}

/** Texto alternativo del anillo. */
export function resumenPlantillas(p = {}) {
    const datos = datosPlantillas(p);
    if (sumar(datos) <= 0) return 'No hay plantillas activas.';
    const obsoletas = num(p?.obsoletas_en_indice);
    return `${resumenTexto(datos, CONFIG_PLANTILLAS)}.${obsoletas > 0 ? ` Obsoletas en el índice: ${obsoletas}.` : ''}`;
}

export const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-MX') : '-');

// Resúmenes de los Detalles plegados: con unidad, porque un número suelto junto al título ("Versiones del índice 3") es ambiguo.
export const textoPlantillas = (n) => `${n} plantilla${n === 1 ? '' : 's'}`;
// El plural pierde la tilde (versión -> versiones), por eso no basta con añadir 'es'.
export const textoVersiones = (n) => (n === 1 ? '1 versión' : `${n} versiones`);
