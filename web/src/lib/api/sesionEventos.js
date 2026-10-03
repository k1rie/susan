// Pequeño bus de eventos de sesión: auth.js avisa cuando el usuario entra o sale y quien guarda datos
// del usuario en memoria (useMe) los descarta. Vive en lib/api para que auth.js no dependa de React.

const oyentes = new Set();

/**
 * Registra un oyente de cambios de sesión (inicio o cierre).
 * @param {(evento: 'inicio' | 'cierre') => void} fn
 * @returns {() => void} función para cancelar la suscripción
 */
export function suscribirCambioSesion(fn) {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
}

/** @param {'inicio' | 'cierre'} evento */
export function emitirCambioSesion(evento) {
    for (const fn of [...oyentes]) {
        try {
            fn(evento);
        } catch {
            // Un oyente defectuoso no debe impedir cerrar la sesión ni avisar a los demás.
        }
    }
}
