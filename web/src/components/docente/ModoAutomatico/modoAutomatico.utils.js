import { aMinutos, faseSesion, ordenarSesiones } from '../pasarLista.utils.js';

/** Cada cuánto se revisan las sesiones de hoy para cambiar de clase sin que nadie toque la pantalla. */
export const INTERVALO_REVISION_MS = 15000;
/** Sondeo del monitor de la clase en curso (cifras «N de M presentes»), el mismo ritmo que la pantalla de sesión. */
export const INTERVALO_MONITOR_MS = 5000;

const esAutomatica = (s) => (s.modo_previsto ?? 'automatico') === 'automatico';

/**
 * Clase que toca pasar lista AHORA en el modo automático: entre las sesiones de hoy abiertas o abribles (dentro de su horario) y con
 * cámara (modo automático), la que empezó más recientemente. Con clases encimadas (una termina mientras otra ya empezó) la ventana de
 * captura que sigue abierta es la de la clase más nueva: la anterior ya consumió sus minutos de tolerancia. null = ninguna.
 */
export function elegirSesionAutomatica(sesiones, hora) {
    const candidatas = ordenarSesiones(sesiones).filter((s) => {
        const fase = faseSesion(s, hora);
        return (fase === 'abierta' || fase === 'abrible') && esAutomatica(s);
    });
    return candidatas.at(-1) ?? null;
}

/** Próxima clase automática de hoy que aún no empieza (para la pantalla de espera). null = no queda ninguna. */
export function siguienteSesion(sesiones, hora) {
    const ahora = aMinutos(hora);
    if (ahora == null) return null;
    return ordenarSesiones(sesiones).find((s) => s.estatus === 'programada' && esAutomatica(s) && (aMinutos(s.hora_inicio) ?? -1) > ahora) ?? null;
}

/** Pide pantalla completa sin fallar: el navegador la niega sin un gesto del usuario (y el kiosco de la Raspberry ya la trae). */
export async function pedirPantallaCompleta(doc = globalThis.document) {
    const el = doc?.documentElement;
    if (!el?.requestFullscreen || doc.fullscreenElement) return false;
    try {
        await el.requestFullscreen();
        return true;
    } catch {
        return false;
    }
}

/** Sale de pantalla completa si se está en ella. */
export async function salirPantallaCompleta(doc = globalThis.document) {
    if (!doc?.fullscreenElement || !doc.exitFullscreen) return;
    try {
        await doc.exitFullscreen();
    } catch {
        // El navegador pudo salir por su cuenta (Esc): no hay nada que hacer.
    }
}
