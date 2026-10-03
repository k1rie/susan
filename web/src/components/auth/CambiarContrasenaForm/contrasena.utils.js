/** Política de contraseña (espejo de Auth): >= 10 caracteres, con letra y dígito; confirmación idéntica. */
export function validarContrasena(nueva, confirmacion) {
    const errores = {};
    if (String(nueva ?? '').length < 10) errores.nueva = 'La contraseña debe tener al menos 10 caracteres.';
    else if (!/\p{L}/u.test(nueva) || !/\d/.test(nueva)) errores.nueva = 'Debe incluir al menos una letra y un número.';
    if (nueva !== confirmacion) errores.confirmacion = 'Las contraseñas no coinciden.';
    return errores;
}

export const TEXTO_ERROR_CONTRASENA = {
    CONTRASENA_DEBIL: 'La contraseña no cumple los requisitos de seguridad.',
    CONTRASENA_IGUAL: 'La nueva contraseña debe ser distinta de la actual.',
};
