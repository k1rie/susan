// Textos del login (plataforma.md 2.1). Los mensajes informativos llegan por ?error= o ?msg=.
export const MENSAJES_INFO = {
    cuenta_inactiva: { tone: 'danger', texto: 'Tu cuenta está inactiva. Contacta al administrador.' },
    sin_cuenta: { tone: 'danger', texto: 'Tu cuenta no está vinculada a un perfil. Contacta al administrador.' },
    sesion_expirada: { tone: 'info', texto: 'Tu sesión expiró. Inicia sesión de nuevo.' },
    contrasena_actualizada: { tone: 'success', texto: 'Contraseña actualizada. Inicia sesión con la nueva.' },
    sesion_cerrada: { tone: 'info', texto: 'Cerraste sesión.' },
};

const TEXTO_POR_CODIGO = {
    CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos.',
    CUENTA_INACTIVA: 'Tu cuenta está inactiva. Contacta al administrador.',
    CUENTA_NO_VINCULADA: 'Tu cuenta no está vinculada a un perfil. Contacta al administrador.',
    DEMASIADOS_INTENTOS: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    ERROR_RED: 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.',
};

export function textoErrorLogin(error) {
    return TEXTO_POR_CODIGO[error?.code] ?? error?.message ?? 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

/** @returns {{ correo?: string, contrasena?: string }} errores por campo (vacío si es válido) */
export function validarLogin({ correo, contrasena }) {
    const errores = {};
    const c = String(correo ?? '').trim();
    if (!c) errores.correo = 'Escribe tu correo institucional.';
    else if (!c.includes('@')) errores.correo = 'Escribe un correo válido.';
    if (!contrasena) errores.contrasena = 'Escribe tu contraseña.';
    return errores;
}
