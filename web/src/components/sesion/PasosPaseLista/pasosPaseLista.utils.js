// Los tres pasos de pasar lista, iguales en forma para la sesión con cámara y la manual: abrir, tomar la asistencia, revisar y cerrar.
// El texto de `detalle` es la única instrucción que se ve en pantalla de ese paso (una línea, no un párrafo por tarjeta).
export const PASOS = {
    automatico: [
        { id: 1, titulo: 'Abrir la sesión', detalle: 'Ábrela para empezar: se usa la cámara del aula.' },
        { id: 2, titulo: 'Pasar lista', detalle: 'Apunta la cámara al grupo: el sistema reconoce a los alumnos solo.' },
        { id: 3, titulo: 'Revisar y cerrar', detalle: 'Revisa quién falta y cierra el pase de lista.' },
    ],
    manual: [
        { id: 1, titulo: 'Abrir la sesión', detalle: 'Ábrela para empezar: el aula no tiene cámaras, se pasa lista a mano.' },
        { id: 2, titulo: 'Marcar alumnos', detalle: 'Marca a cada alumno: presente, retardo o ausente.' },
        { id: 3, titulo: 'Guardar y cerrar', detalle: 'Guarda y cierra: quien quede sin marcar será ausente.' },
    ],
};

/** Pasos del modo indicado; un modo desconocido cae en el de cámara. */
export const pasosDe = (modo) => PASOS[modo] ?? PASOS.automatico;

/** Estado de un paso respecto del actual: ya hecho, el que se está haciendo o pendiente. */
export const estadoPaso = (id, actual) => (id < actual ? 'hecho' : id === actual ? 'actual' : 'pendiente');
