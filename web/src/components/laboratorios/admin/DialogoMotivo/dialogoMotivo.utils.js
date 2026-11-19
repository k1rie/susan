import { LIMITE_MOTIVO } from '../laboratoriosAdmin.utils.js';

/** Texto sin espacios en los extremos (lo que se manda y lo que se valida). */
export const normalizarMotivo = (texto) => String(texto ?? '').trim();

/**
 * Validación de conveniencia del motivo o comentario (la real es de la RPC). Devuelve el mensaje de error o null.
 *   obligatorio  true al rechazar o cancelar (3 a 300 caracteres); false al aprobar (vacío vale, máximo 300).
 */
export function validarMotivo(texto, { obligatorio = false } = {}) {
    const limpio = normalizarMotivo(texto);
    if (obligatorio && limpio.length < LIMITE_MOTIVO.min) return `Escribe el motivo: mínimo ${LIMITE_MOTIVO.min} caracteres.`;
    if (limpio.length > LIMITE_MOTIVO.max) return `El texto admite hasta ${LIMITE_MOTIVO.max} caracteres.`;
    return null;
}
