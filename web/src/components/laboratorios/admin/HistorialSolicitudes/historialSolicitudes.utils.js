import { ETIQUETA_ESTATUS } from '../../laboratorios.utils.js';
import { formatoMomento } from '../laboratoriosAdmin.utils.js';

// El historial son las solicitudes ya resueltas. Las pendientes viven en su propia pestaña; por eso no hay «Todas»: sin filtro de
// estatus el servidor pondría las pendientes primero.
export const ESTATUS_HISTORIAL = ['aprobada', 'rechazada', 'cancelada'];
export const ESTATUS_INICIAL = 'aprobada';

const PLURAL = { aprobada: 'Aprobadas', rechazada: 'Rechazadas', cancelada: 'Canceladas' };

/** Píldoras de estatus con el contador de `conteos` (que ignora el filtro de estatus pero respeta el de laboratorio). */
export function pastillasHistorial(conteos) {
    return ESTATUS_HISTORIAL.map((id) => ({ id, label: PLURAL[id], count: conteos ? Number(conteos[id] ?? 0) : undefined }));
}

/** Texto del estado vacío según el estatus y si hay un laboratorio filtrado. */
export function textoVacioHistorial(estatus, conLaboratorio) {
    const plural = PLURAL[estatus]?.toLowerCase() ?? 'solicitudes';
    return conLaboratorio ? `No hay solicitudes ${plural} para este laboratorio.` : `Aún no hay solicitudes ${plural}.`;
}

/** 'Aprobada por admin@unach.mx · mié 16 sep, 07:12' (quién la resolvió y cuándo, en la zona de la sede). */
export function lineaResolucion(solicitud, hoy = null) {
    const quien = solicitud.resuelto_por ? ` por ${solicitud.resuelto_por}` : '';
    const cuando = solicitud.fecha_resolucion ? ` · ${formatoMomento(solicitud.fecha_resolucion, hoy)}` : '';
    return `${ETIQUETA_ESTATUS[solicitud.estatus] ?? solicitud.estatus}${quien}${cuando}`;
}

/** Rótulo del comentario según cómo terminó la solicitud. */
export function etiquetaComentario(estatus) {
    if (estatus === 'rechazada') return 'Motivo del rechazo';
    if (estatus === 'cancelada') return 'Motivo de la cancelación';
    return 'Comentario';
}
