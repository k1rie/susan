import { LECTURAS_REQUERIDAS, formatearHoraIso } from '../MonitorSesion/monitorSesion.utils.js';

/** Solo los inscritos activos pasan lista (una baja no aparece como candidata). */
export const esActivo = (alumno) => !alumno.inscripcion || alumno.inscripcion === 'activa';

/** Sin registro = aún sin estado (el mismo criterio de `totales.sin_registro`); un «pendiente» ya tiene registro, a la espera de revisión. */
export const sinRegistro = (alumno) => esActivo(alumno) && !alumno.estado;

/** Segunda línea de la fila: matrícula y, según el caso, la hora del registro o cuántas lecturas válidas lleva («0/3 lecturas»). */
export function metaAlumno(alumno) {
    const dato = alumno.hora_registro ? formatearHoraIso(alumno.hora_registro).slice(0, 5) : `${alumno.lecturas_validas ?? 0}/${LECTURAS_REQUERIDAS} lecturas`;
    return [alumno.matricula, dato].filter(Boolean).join(' · ');
}
