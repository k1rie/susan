import { esCorreo, LIMITES } from '@/lib/formularios';

// Ejemplo de la forma usuario@dominio (no presume que todas las cuentas sean de ese dominio).
export const EJEMPLO_CORREO = 'nombre@unach.mx';

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

/**
 * Mensaje concreto para un correo mal escrito (null si es válido). La regla es la del servidor (`esCorreo`); aquí solo se explica QUÉ
 * falta para que la persona lo arregle sin adivinar. `vacio` es el texto del campo sin escribir.
 */
export function mensajeCorreo(valor, { vacio = 'Escribe tu correo institucional.' } = {}) {
    const t = String(valor ?? '').trim();
    if (!t) return vacio;
    if (esCorreo(t)) return null;
    if (t.length > LIMITES.correo) return `El correo es demasiado largo (máximo ${LIMITES.correo} caracteres).`;
    if (/\s/.test(t)) return 'El correo no puede llevar espacios.';
    const arrobas = t.split('@').length - 1;
    if (arrobas === 0) return `Al correo le falta la @. Ejemplo: ${EJEMPLO_CORREO}`;
    if (arrobas > 1) return 'El correo solo puede llevar una @.';
    const [usuario, dominio] = t.split('@');
    if (!usuario) return `Escribe tu usuario antes de la @. Ejemplo: ${EJEMPLO_CORREO}`;
    if (!dominio) return `Escribe el dominio después de la @. Ejemplo: ${EJEMPLO_CORREO}`;
    return `Revisa el dominio después de la @. Ejemplo: ${EJEMPLO_CORREO}`;
}

/** @returns {{ correo?: string, contrasena?: string }} errores por campo (vacío si es válido) */
export function validarLogin({ correo, contrasena }) {
    const errores = {};
    const c = mensajeCorreo(correo);
    if (c) errores.correo = c;
    if (!contrasena) errores.contrasena = 'Escribe tu contraseña.';
    return errores;
}
