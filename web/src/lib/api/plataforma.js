import { callRpc } from './client.js';

/**
 * api_yo() -> identidad del usuario autenticado.
 * @param {object} [args]
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<{ id_usuario: number, auth_uid: string, correo: string, rol: 'administrador'|'docente'|'alumno'|'tecnico', activo: boolean, id_docente: number|null, id_alumno: number|null, nombre: string, home: string }>}
 */
export async function yo(args = {}, opts = {}) {
    return callRpc('api_yo', args, opts);
}

/**
 * api_ahora() -> hora de negocio (la del plantel; puede ser simulada en desarrollo).
 * @param {object} [args]
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<{ ahora: string, zona: string, fecha: string, hora: string, dia_semana: number, reloj_simulado: boolean }>}
 */
export async function ahora(args = {}, opts = {}) {
    return callRpc('api_ahora', args, opts);
}

/**
 * api_parametros_publicos() -> parámetros del sistema como { clave: valor } (los numéricos como número).
 * @param {object} [args]
 * @param {{ backend?: object }} [opts]
 * @returns {Promise<Record<string, string|number>>}
 */
export async function parametrosPublicos(args = {}, opts = {}) {
    return callRpc('api_parametros_publicos', args, opts);
}
