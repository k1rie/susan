// Eventos globales (window) que los hooks de datos escuchan.

/**
 * El reloj de demostracion (solo desarrollo local) cambio: toda consulta de useApiQuery montada vuelve a pedir sus
 * datos para que la pantalla refleje la nueva hora de negocio (ventanas de presente/retardo, cierre de sesion, etc.).
 * Fuera del modo local nadie lo emite, asi que escucharlo no cuesta nada.
 */
export const EVENTO_RELOJ_CAMBIO = 'susan:reloj-cambio';
