/**
 * Política de contraseña (espejo de Auth): >= 10 caracteres, con letra y dígito. La confirmación idéntica solo se exige si se pasa
 * `confirmacion` (el formulario actual no la pide: con «Mostrar» y la lista de requisitos sobra el doble tecleo).
 */
export function validarContrasena(nueva, confirmacion) {
    const errores = {};
    if (String(nueva ?? '').length < 10) errores.nueva = 'La contraseña debe tener al menos 10 caracteres.';
    else if (!/\p{L}/u.test(nueva) || !/\d/.test(nueva)) errores.nueva = 'Debe incluir al menos una letra y un número.';
    if (confirmacion !== undefined && nueva !== confirmacion) errores.confirmacion = 'Las contraseñas no coinciden.';
    return errores;
}

/**
 * Mensaje de campo para una contraseña que no cumple (null si cumple). La lista de requisitos ya dice CUÁLES faltan, así que el
 * mensaje solo lo resume y manda a la lista; los requisitos salen de `reglasContrasena`, la misma política de arriba.
 */
export function mensajeContrasena(nueva) {
    const texto = String(nueva ?? '');
    if (!texto) return 'Escribe tu contraseña nueva.';
    const faltan = reglasContrasena(texto).filter((r) => !r.cumple);
    if (!faltan.length) return null;
    if (faltan.length === 1) return `Aún no cumple: ${faltan[0].texto.charAt(0).toLowerCase()}${faltan[0].texto.slice(1)}.`;
    return `Aún no cumple ${faltan.length} requisitos de la lista.`;
}

export const TEXTO_ERROR_CONTRASENA = {
    CONTRASENA_DEBIL: 'La contraseña no cumple los requisitos de seguridad.',
    CONTRASENA_IGUAL: 'La nueva contraseña debe ser distinta de la actual.',
};

/**
 * Reglas para mostrar en vivo (misma política que `validarContrasena`): [{ id, texto, cumple }].
 * `confirmacion` solo se evalúa cuando ya se escribió algo en ella.
 */
export function reglasContrasena(nueva, confirmacion = '') {
    const n = String(nueva ?? '');
    const reglas = [
        { id: 'largo', texto: 'Al menos 10 caracteres', cumple: n.length >= 10 },
        { id: 'letra', texto: 'Contiene una letra', cumple: /\p{L}/u.test(n) },
        { id: 'numero', texto: 'Contiene un número', cumple: /\d/.test(n) },
    ];
    if (confirmacion) reglas.push({ id: 'coincide', texto: 'Las contraseñas coinciden', cumple: n.length > 0 && n === confirmacion });
    return reglas;
}
