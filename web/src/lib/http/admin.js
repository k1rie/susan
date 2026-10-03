// Clientes de las rutas de administración: cuentas de usuario y prueba de cámaras.
import { postJSON } from './client.js';

/**
 * POST /api/admin/usuarios. La respuesta trae `contrasena_temporal` UNA sola vez: hay que mostrarla y no guardarla.
 * @param {{ correo: string, rol: string, idDocente?: number, idAlumno?: number }} p
 * @returns {Promise<{ id_usuario: number, correo: string, rol: string, contrasena_temporal: string }>}
 */
export function crearUsuario({ correo, rol, idDocente, idAlumno }, { signal } = {}) {
    return postJSON('/api/admin/usuarios', {
        correo,
        rol,
        ...(idDocente !== undefined && idDocente !== null ? { id_docente: idDocente } : {}),
        ...(idAlumno !== undefined && idAlumno !== null ? { id_alumno: idAlumno } : {}),
    }, { signal });
}

/** POST /api/admin/usuarios/{id}/restablecer -> { id_usuario, correo, contrasena_temporal } (una sola vez). */
export function restablecerUsuario({ idUsuario }, { signal } = {}) {
    return postJSON(`/api/admin/usuarios/${encodeURIComponent(idUsuario)}/restablecer`, {}, { signal });
}

/** POST /api/admin/camaras/{id}/probar -> { ok, tipo, probada, rostros?, ms?, mensaje? }. */
export function probarCamara({ idCamara }, { signal } = {}) {
    return postJSON(`/api/admin/camaras/${encodeURIComponent(idCamara)}/probar`, {}, { signal });
}
