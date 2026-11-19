// Funciones puras de la pantalla «Laboratorios» del docente: filtros por estatus, paginación y textos.
import { resumenSolicitud } from '../TarjetaSolicitud/tarjetaSolicitud.utils.js';

export const PAGINA = 50;

// Filtros por estatus (el primero no filtra). Los contadores salen de `conteos` de api_laboratorio_solicitudes_listar, que ignora el filtro.
export const FILTROS = [
    { id: 'todas', label: 'Todas' },
    { id: 'pendiente', label: 'Pendientes' },
    { id: 'aprobada', label: 'Aprobadas' },
    { id: 'rechazada', label: 'Rechazadas' },
    { id: 'cancelada', label: 'Canceladas' },
];

/** Estatus que se manda al servidor para un filtro; 'todas' = sin filtro. */
export const estatusDeFiltro = (id) => (id === 'todas' ? undefined : id);

/** Píldoras de `ui/Pills` con su contador. */
export function itemsDePills(conteos) {
    return FILTROS.map((f) => ({ id: f.id, label: f.label, count: (f.id === 'todas' ? conteos?.total : conteos?.[f.id]) ?? 0 }));
}

/** Tras enviar una solicitud nueva se muestra donde se vea (nace pendiente): solo se cambia el filtro si la ocultaría. */
export const filtroTrasCrear = (actual) => (actual === 'todas' || actual === 'pendiente' ? actual : 'pendiente');

/** Une la primera página con las que se cargaron con «Ver más», sin repetir solicitudes (una recarga puede traslapar páginas). */
export function unirPaginas(base = [], extras = []) {
    const vistos = new Set();
    const salida = [];
    for (const it of [...base, ...extras]) {
        if (vistos.has(it.id_solicitud)) continue;
        vistos.add(it.id_solicitud);
        salida.push(it);
    }
    return salida;
}

// Estado vacío por filtro. En «todas» además se ofrece crear la primera.
export const VACIOS = {
    todas: { title: 'Todavía no has solicitado laboratorios', description: 'Pide uno para tu grupo y aquí verás si el administrador lo aprueba.' },
    pendiente: { title: 'No tienes solicitudes pendientes', description: 'Las que envíes esperarán aquí la revisión del administrador.' },
    aprobada: { title: 'Aún no tienes solicitudes aprobadas' },
    rechazada: { title: 'No tienes solicitudes rechazadas' },
    cancelada: { title: 'No tienes solicitudes canceladas' },
};

/** Texto del diálogo de cancelación. */
export function textoCancelacion(solicitud) {
    const que = `¿Cancelar la solicitud de ${resumenSolicitud(solicitud)}?`;
    return solicitud.estatus === 'aprobada'
        ? `${que} Ya está aprobada: al cancelarla el laboratorio queda libre para otros docentes.`
        : `${que} Se retirará de la revisión del administrador.`;
}

/** «Mostrando 50 de 83» cuando hay más por cargar; vacío si ya se ve todo. */
export function textoResultado(mostradas, total) {
    return mostradas < total ? `Mostrando ${mostradas} de ${total} solicitudes` : '';
}
