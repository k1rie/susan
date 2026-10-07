import { cierreHabilitado, motivoCierre } from '../MonitorSesion/monitorSesion.utils.js';

/**
 * Qué dice la tarjeta de decisión del paso «Revisar y cerrar»: un titular con lo que falta y la nota que acompaña al botón de cierre
 * (por qué está bloqueado, o qué pasa al pulsarlo). `faltan` = alumnos activos sin registro.
 */
export function decisionCierre(sesion, faltan) {
    const titulo = faltan === 0 ? 'Todos los alumnos tienen registro' : faltan === 1 ? 'Falta 1 alumno por registrar' : `Faltan ${faltan} alumnos por registrar`;
    if (!cierreHabilitado(sesion)) {
        const espera = motivoCierre(sesion);
        // Con la tolerancia en curso la cámara sigue reconociendo aunque el docente esté en esta vista.
        const sigue = sesion?.en_ventana === true ? ' La cámara sigue reconociendo mientras revisas.' : '';
        return { titulo, nota: `${espera ?? 'El cierre se habilita al terminar la tolerancia.'}${sigue}`, puedeCerrar: false };
    }
    return {
        titulo,
        nota: faltan === 0 ? 'Ya puedes cerrar el pase de lista.' : 'Si cierras ahora quedarán como ausentes. Puedes registrarlos a mano antes.',
        puedeCerrar: true,
    };
}
