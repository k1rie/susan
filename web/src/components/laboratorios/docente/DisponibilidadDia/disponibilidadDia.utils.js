// Funciones puras de «Disponibilidad ese día»: orden y rótulos de los bloques ocupados de un laboratorio.
import { minutosDeHora } from '../../laboratorios.utils.js';

/** Bloques de una fecha ordenados por hora de inicio (primero los que acaban antes). El arreglo original no se modifica. */
export function bloquesDelDia(bloques = [], fecha) {
    return bloques
        .filter((b) => b.fecha === fecha)
        .sort((a, b) => (minutosDeHora(a.hora_inicio) ?? 0) - (minutosDeHora(b.hora_inicio) ?? 0) || (minutosDeHora(a.hora_fin) ?? 0) - (minutosDeHora(b.hora_fin) ?? 0));
}

/** «3A · Administración I» (clave del grupo y materia; nunca el nombre de otro docente: el servidor no lo envía). */
export function rotuloBloque(bloque) {
    return [bloque.clave_grupo, bloque.materia_nombre].filter(Boolean).join(' · ');
}

/** Qué le pasa a la persona si su horario se traslapa con el bloque, según el nivel de `traslapes`. null si no se traslapa. */
export function textoTraslape(nivel) {
    if (nivel === 'duplicada') return 'Tu grupo ya tiene esta solicitud';
    if (nivel === 'bloquea') return 'Se traslapa con tu horario';
    if (nivel === 'compite') return 'Se traslapa; decide el administrador';
    return null;
}

/** Resumen de una línea: «Libre todo el día», «1 bloque ocupado», «3 bloques ocupados». */
export function resumenOcupacion(bloques = []) {
    if (bloques.length === 0) return 'Libre todo el día';
    return `${bloques.length} ${bloques.length === 1 ? 'bloque ocupado' : 'bloques ocupados'}`;
}
