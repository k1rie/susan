// Utilidades del editor de horario semanal. Días 1 (lunes) a 6 (sábado), como api_horario_guardar.
export const DIAS = [
    { value: '1', label: 'Lunes' },
    { value: '2', label: 'Martes' },
    { value: '3', label: 'Miércoles' },
    { value: '4', label: 'Jueves' },
    { value: '5', label: 'Viernes' },
    { value: '6', label: 'Sábado' },
];

export const nombreDia = (d) => DIAS.find((x) => x.value === String(d))?.label ?? `Día ${d}`;

/** 'HH:MM' o 'HH:MM:SS' -> minutos desde medianoche, o null si no es válida. */
export function aMinutos(hora) {
    const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(hora ?? '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
}

export const recortarHora = (h) => String(h ?? '').slice(0, 5);

let contador = 0;
export const bloqueVacio = () => ({ clave: `b${++contador}`, dia_semana: '1', hora_inicio: '', hora_fin: '' });

/** Bloques de la API -> filas editables. */
export function desdeApi(horario = []) {
    return horario.map((b) => ({
        clave: `b${++contador}`,
        dia_semana: String(b.dia_semana),
        hora_inicio: recortarHora(b.hora_inicio),
        hora_fin: recortarHora(b.hora_fin),
    }));
}

/** Filas editables -> bloques que espera el servidor. */
export const haciaApi = (filas) => filas.map((b) => ({
    dia_semana: Number(b.dia_semana),
    hora_inicio: b.hora_inicio,
    hora_fin: b.hora_fin,
}));

/**
 * Valida los bloques. Devuelve { porFila: { [clave]: mensaje }, general: [mensajes] }.
 * Reglas: hora válida, fin > inicio y sin traslape entre bloques del mismo día (los contiguos no chocan).
 */
export function validarBloques(filas) {
    const porFila = {};
    const general = [];
    if (filas.length === 0) general.push('Agrega al menos un bloque de horario.');
    const validos = [];
    for (const f of filas) {
        const ini = aMinutos(f.hora_inicio);
        const fin = aMinutos(f.hora_fin);
        if (!(Number(f.dia_semana) >= 1 && Number(f.dia_semana) <= 6)) porFila[f.clave] = 'Elige un día de lunes a sábado.';
        else if (ini == null || fin == null) porFila[f.clave] = 'Indica la hora de inicio y la de fin.';
        else if (fin <= ini) porFila[f.clave] = 'La hora de fin debe ser posterior a la de inicio.';
        else validos.push({ f, ini, fin });
    }
    for (let i = 0; i < validos.length; i++) {
        for (let j = i + 1; j < validos.length; j++) {
            const a = validos[i];
            const b = validos[j];
            if (a.f.dia_semana === b.f.dia_semana && a.ini < b.fin && b.ini < a.fin) {
                porFila[b.f.clave] = porFila[b.f.clave] || `Se traslapa con otro bloque del ${nombreDia(b.f.dia_semana).toLowerCase()}.`;
            }
        }
    }
    return { porFila, general, valido: general.length === 0 && Object.keys(porFila).length === 0 };
}

/** Mensaje al usuario según el código devuelto por api_horario_guardar. */
export function mensajeErrorHorario(error) {
    if (error?.code === 'HORARIO_CHOQUE') {
        return `Choque de horario con otro grupo del aula: ${error.message}`;
    }
    return error?.message || 'No se pudo guardar el horario.';
}
