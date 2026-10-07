// Opciones y textos de la inscripción rápida.
import { plural } from '../compartido/grupos.utils.js';

/** Opción de dos líneas del Combobox: nombre arriba; matrícula y situación debajo (lo que impide o complica inscribirlo va a la vista). */
export function opcionAlumno(a, { yaInscrito = false, enLista = false } = {}) {
    const avisos = [];
    if (yaInscrito) avisos.push('Ya inscrito en este grupo');
    else if (enLista) avisos.push('Ya está en la lista');
    else {
        avisos.push('Activo');
        if (a.consentimiento_vigente === false) avisos.push('sin consentimiento vigente');
        if (a.plantilla_activa === false) avisos.push('sin plantilla facial');
    }
    return {
        value: String(a.id_alumno),
        label: a.nombre_completo,
        avatar: a.nombre_completo,
        description: [a.matricula, ...avisos].join(' · '),
        disabled: yaInscrito || enLista,
        datos: a,
    };
}

/**
 * Lugares del aula frente a lo que se va a inscribir.
 * @returns {{ libres: number|null, quedarian: number|null, exceso: number, texto: string|null, tono: 'info'|'warning' }}
 */
export function estadoCapacidad({ capacidad, activos, enLista = 0 }) {
    if (capacidad == null) return { libres: null, quedarian: null, exceso: 0, texto: null, tono: 'info' };
    const libres = capacidad - activos;
    const quedarian = libres - enLista;
    const exceso = Math.max(-quedarian, 0);
    if (enLista > 0 && exceso > 0) {
        return {
            libres,
            quedarian,
            exceso,
            texto: `Con ${plural(enLista, 'alumno')} más el grupo tendría ${activos + enLista} inscritos y el aula solo tiene ${capacidad} lugares. Puedes inscribirlos, pero conviene ampliar la capacidad o cambiar de aula.`,
            tono: 'warning',
        };
    }
    if (libres <= 0) {
        return { libres, quedarian, exceso, texto: `El aula está llena (${activos} de ${capacidad} lugares): una inscripción más la superaría.`, tono: 'warning' };
    }
    const resto = enLista > 0 ? ` Con la lista actual quedarían ${plural(quedarian, 'lugar libre', 'lugares libres')}.` : '';
    return { libres, quedarian, exceso, texto: `Quedan ${plural(libres, 'lugar libre', 'lugares libres')} en el aula (${activos} de ${capacidad}).${resto}`, tono: 'info' };
}

/** Texto del resultado de un lote: «2 alumnos inscritos (1 reinscrito). 1 no se pudo inscribir.» */
export function resumenLote({ ok, reinscritos, fallidos }) {
    const partes = [];
    if (ok > 0) partes.push(`${plural(ok, 'alumno inscrito', 'alumnos inscritos')}${reinscritos > 0 ? ` (${plural(reinscritos, 'reinscrito')})` : ''}.`);
    if (fallidos > 0) partes.push(`${plural(fallidos, 'alumno no se pudo inscribir', 'alumnos no se pudieron inscribir')}: revisa la lista.`);
    return partes.join(' ');
}
