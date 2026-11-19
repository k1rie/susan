import { conteoTexto, ocupacion } from '../laboratoriosAdmin.utils.js';

/** 'el grupo 3A ... 12:00.' -> 'No se puede aprobar: el grupo 3A ... 12:00.' (el servidor entrega la causa sin punto final). */
const sinPuntoFinal = (texto) => String(texto).trim().replace(/[.\s]+$/, '');

/**
 * Motivos por los que HOY no se puede aprobar la solicitud, en el orden en que importan. Con alguno, «Aprobar» queda apagado y el
 * motivo se escribe en la tarjeta; «Rechazar» sigue disponible. Vacío = se puede aprobar.
 *   - vencida: la hora de inicio ya pasó (la RPC respondería SOLICITUD_VENCIDA).
 *   - conflicto: texto del servidor (solicitud aprobada o clase de otro grupo en ese horario; LAB_OCUPADO).
 *   - capacidad: más inscritos activos que lugares (LAB_CAPACIDAD_INSUFICIENTE); `inscritos` cuenta lo mismo que la RPC.
 */
export function motivosBloqueo(solicitud) {
    const motivos = [];
    if (solicitud.vencida) motivos.push('No se puede aprobar: la hora de inicio ya pasó. Puedes rechazarla para avisar al docente.');
    if (solicitud.conflicto) motivos.push(`No se puede aprobar: ${sinPuntoFinal(solicitud.conflicto)}.`);
    const cupo = ocupacion(solicitud.grupo, solicitud.aula);
    if (cupo.excede) {
        motivos.push(`No se puede aprobar: el grupo tiene ${cupo.inscritos} alumnos y el laboratorio admite ${cupo.capacidad}.`);
    }
    return motivos;
}

/** Aviso de solicitudes pendientes que se traslapan con esta (el administrador decide entre ellas); '' si ninguna. */
export function textoCompite(compite) {
    const n = Number(compite ?? 0);
    if (!(n > 0)) return '';
    return `Compite con ${conteoTexto(n, 'solicitud pendiente', 'solicitudes pendientes')} por el mismo horario.`;
}
