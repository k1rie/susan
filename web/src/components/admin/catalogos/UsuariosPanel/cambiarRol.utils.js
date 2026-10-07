import { campoDeError } from '../comun.js';
import { requiereVinculo } from '../CrearUsuarioDialog/rolesUsuario.js';

/** Validación de «Cambiar rol»: el rol debe ser distinto del actual y, si exige vínculo, hay que elegirlo. */
export function validarCambioRol(v, fila) {
    const e = {};
    if (v.rol === fila.rol) e.rol = 'Elige un rol distinto del actual.';
    else if (requiereVinculo(v.rol) && !v.vinculo) e.vinculo = `Elige el ${v.rol} al que pertenece la cuenta.`;
    return e;
}

/** Cambios que manda `usuarioActualizar`: el rol y, según él, el vínculo nuevo. */
export const argumentosCambiarRol = (v) => ({
    rol: v.rol,
    ...(v.rol === 'docente' ? { id_docente: Number(v.vinculo) } : {}),
    ...(v.rol === 'alumno' ? { id_alumno: Number(v.vinculo) } : {}),
});

/**
 * Qué pasará con el vínculo actual de la cuenta (docente o alumno) al cambiar de rol, dicho antes de guardar.
 * Sin vínculo actual o sin cambio de rol no hay nada que avisar.
 */
export function avisoDeVinculo(fila, rolNuevo) {
    if (!fila.vinculo || rolNuevo === fila.rol) return null;
    const actual = `${fila.nombre ? `${fila.nombre} ` : ''}(${fila.vinculo})`;
    return requiereVinculo(rolNuevo)
        ? `Hoy la cuenta está vinculada a ${actual}; ese vínculo se reemplazará por el nuevo.`
        : `Hoy la cuenta está vinculada a ${actual}; con este rol se quitará ese vínculo.`;
}

export const errorDeCampoCambiarRol = (error) =>
    campoDeError(error, [
        { codigo: 'ROL_VINCULO_INCOHERENTE', campo: 'vinculo' },
        { codigo: 'DOCENTE_NO_ACTIVO', campo: 'vinculo' },
        { codigo: 'ALUMNO_NO_ACTIVO', campo: 'vinculo' },
        { codigo: 'DUPLICADO', campo: 'vinculo' },
    ]);
