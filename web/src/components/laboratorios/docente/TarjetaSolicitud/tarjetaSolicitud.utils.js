// Funciones puras de la tarjeta de solicitud del docente.
import { duracionTexto, estatusVisible, formatoFechaCorta, rangoHoras } from '../../laboratorios.utils.js';
import { instanteEnMinutos } from '../compartido/reloj.utils.js';

// Rótulo del comentario del administrador según cómo terminó la solicitud: el mismo campo sirve para aprobar con nota, rechazar
// (motivo obligatorio) y cancelar (motivo opcional del docente o del administrador).
const ROTULO_COMENTARIO = {
    aprobada: 'Comentario del administrador',
    rechazada: 'Motivo del rechazo',
    cancelada: 'Motivo de la cancelación',
};

export const rotuloComentario = (estatus) => ROTULO_COMENTARIO[estatus] ?? 'Comentario';

/** true si la aprobada ya empezó (o pasó) según el reloj del plantel; el servidor responde SOLICITUD_VENCIDA al cancelarla. */
export function yaInicio(solicitud, reloj) {
    const inicio = instanteEnMinutos(solicitud.fecha, solicitud.hora_inicio);
    const ahora = instanteEnMinutos(reloj?.hoy, reloj?.hora);
    return inicio != null && ahora != null && inicio <= ahora;
}

/**
 * ¿Se ofrece «Cancelar»? Pendientes (también la vencida: cancelarla la limpia de la lista) y aprobadas que aún no empiezan.
 * Ojo: `vencida` del servidor solo marca pendientes; de una aprobada se sabe por la hora de inicio y el reloj.
 */
export function puedeCancelar(solicitud, reloj) {
    if (solicitud.estatus === 'pendiente') return true;
    if (solicitud.estatus === 'aprobada') return !yaInicio(solicitud, reloj);
    return false;
}

/** Nota corta bajo la solicitud sobre qué esperar; null si no hace falta. */
export function notaDeEstado(solicitud) {
    if (solicitud.estatus !== 'pendiente') return null;
    return estatusVisible(solicitud) === 'vencida'
        ? 'La hora de inicio ya pasó sin que se resolviera. Solo puedes cancelarla.'
        : 'Esperando la revisión del administrador.';
}

/** «LAB-1, mié 16 sep, 10:00 – 12:00» para el diálogo de cancelación y los nombres accesibles. */
export function resumenSolicitud(solicitud, hoy = null) {
    return `${solicitud.aula?.clave ?? 'Laboratorio'}, ${formatoFechaCorta(solicitud.fecha, hoy)}, ${rangoHoras(solicitud.hora_inicio, solicitud.hora_fin)}`;
}

/** Duración de la solicitud ('2 h') o null. */
export function duracionSolicitud(solicitud) {
    return duracionTexto(solicitud.hora_inicio, solicitud.hora_fin);
}
