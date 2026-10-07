import { etiquetaEstatus } from '../AlumnoForm/alumnoForm.utils.js';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Inscripciones que siguen activas (las que una baja o un egreso dan de baja). */
export const inscripcionesActivas = (alumno) => (alumno?.inscripciones ?? []).filter((i) => i.estatus === 'activa').length;

/**
 * Texto de la confirmación única de un cambio de estatus a baja o egreso (la misma desde el encabezado y desde el formulario).
 * Dice el efecto real: cuántas inscripciones activas se darán de baja y que reactivarlo no las restituye.
 */
export function textosConfirmacionEstatus({ estatus, nombre, inscripciones = 0 }) {
    const efecto = inscripciones > 0 ? `Se darán de baja sus ${plural(inscripciones, 'inscripción activa', 'inscripciones activas')}.` : 'No tiene inscripciones activas.';
    const cola = 'Se conserva todo su historial. Podrás reactivarlo, pero tendrás que inscribirlo de nuevo.';
    const titulos = {
        baja_temporal: [`¿Dar de baja temporal a ${nombre}?`, 'Dar de baja temporal'],
        baja_definitiva: [`¿Dar de baja definitiva a ${nombre}?`, 'Dar de baja'],
        egresado: [`¿Marcar a ${nombre} como egresado?`, 'Marcar como egresado'],
    };
    const [title, confirmLabel] = titulos[estatus] ?? [`¿Cambiar el estatus a ${etiquetaEstatus(estatus)}?`, 'Cambiar estatus'];
    return { title, confirmLabel, message: `${efecto} ${cola}` };
}

/**
 * Qué falta en la ficha, para el resumen de arriba: cada elemento enlaza a su tarjeta.
 *   cuenta  resultado de useCuentaAcceso (estado 'cargando' | 'error' | 'sin' | 'activa' | 'inactiva')
 *   -> [{ id, href, etiqueta, ok, texto }]
 */
export function resumenFicha(alumno, cuenta) {
    const plantilla = alumno.plantilla;
    const activas = inscripcionesActivas(alumno);
    const textoCuenta = { cargando: 'Comprobando…', error: 'Sin comprobar', sin: 'Pendiente', activa: 'Creada', inactiva: 'Desactivada' }[cuenta?.estado ?? 'cargando'];
    return [
        { id: 'consentimiento', href: '#consentimiento', etiqueta: 'Consentimiento', ok: Boolean(alumno.consentimiento_vigente), texto: alumno.consentimiento_vigente ? 'Vigente' : 'Pendiente' },
        { id: 'plantilla', href: '#plantilla', etiqueta: 'Plantilla facial', ok: Boolean(plantilla), texto: plantilla ? (plantilla.indexada === false ? 'Sin indexar' : 'Activa') : 'Pendiente' },
        { id: 'cuenta', href: '#cuenta', etiqueta: 'Cuenta de acceso', ok: cuenta?.estado === 'activa', texto: textoCuenta },
        { id: 'inscripciones', href: '#inscripciones', etiqueta: 'Inscripciones', ok: activas > 0, texto: activas > 0 ? plural(activas, 'activa', 'activas') : 'Ninguna' },
    ];
}
