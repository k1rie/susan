// Modelo de «franjas» del editor de horario: una franja = unos días de la semana con la MISMA hora de inicio y fin
// (L-M-V 07:00-08:00). El servidor guarda un bloque por día (api_horario_guardar), así que al guardar cada franja se expande en
// N bloques y al cargar los bloques se agrupan por hora. Así «el mismo horario en varios días» se captura una sola vez.
import { DIAS, aMinutos, nombreDia, recortarHora, validarBloques } from '../HorarioEditor/horarioEditor.utils.js';
import { formatoDuracion } from '../compartido/grupos.utils.js';

export const MAX_BLOQUES = 42; // tope de api_horario_guardar
export const DURACIONES = [
    { value: '60', label: '1 h' },
    { value: '90', label: '1 h 30' },
    { value: '120', label: '2 h' },
    { value: '180', label: '3 h' },
];
export const PLANTILLAS_DIAS = [
    { id: 'lmv', label: 'Lun, Mié y Vie', dias: ['1', '3', '5'] },
    { id: 'mj', label: 'Mar y Jue', dias: ['2', '4'] },
    { id: 'lv', label: 'Lun a Vie', dias: ['1', '2', '3', '4', '5'] },
];

const CORTOS = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };
export const diaCorto = (d) => CORTOS[Number(d)] ?? `Día ${d}`;

let contador = 0;
export const franjaVacia = (props = {}) => ({ clave: `f${++contador}`, dias: [], hora_inicio: '', hora_fin: '', ...props });

const ordenarDias = (dias) => [...new Set(dias.map(String))].sort((a, b) => Number(a) - Number(b));

/** Bloques de la API [{ dia_semana, hora_inicio, hora_fin }] -> franjas (agrupa por hora, ordena por primer día y hora). */
export function franjasDesdeApi(horario = []) {
    const grupos = new Map();
    for (const b of horario ?? []) {
        const ini = recortarHora(b.hora_inicio);
        const fin = recortarHora(b.hora_fin);
        const clave = `${ini}|${fin}`;
        if (!grupos.has(clave)) grupos.set(clave, { ini, fin, dias: [] });
        grupos.get(clave).dias.push(String(b.dia_semana));
    }
    return [...grupos.values()]
        .map((g) => ({ ...g, dias: ordenarDias(g.dias) }))
        .sort((a, b) => Number(a.dias[0]) - Number(b.dias[0]) || (aMinutos(a.ini) ?? 0) - (aMinutos(b.ini) ?? 0))
        .map((g) => franjaVacia({ dias: g.dias, hora_inicio: g.ini, hora_fin: g.fin }));
}

/** Franjas -> bloques que espera el servidor, uno por día, ordenados por día y hora (el formato de siempre del payload). */
export function franjasHaciaApi(franjas = []) {
    return franjas
        .flatMap((f) => ordenarDias(f.dias).map((d) => ({ dia_semana: Number(d), hora_inicio: f.hora_inicio, hora_fin: f.hora_fin })))
        .sort((a, b) => a.dia_semana - b.dia_semana || (aMinutos(a.hora_inicio) ?? 0) - (aMinutos(b.hora_inicio) ?? 0));
}

/** Firma comparable del horario (ignora las claves internas y el orden de las franjas) para saber si hay cambios sin guardar. */
export const firmaFranjas = (franjas = []) => JSON.stringify(franjasHaciaApi(franjas));

/** 'HH:MM' + minutos -> 'HH:MM' (se acota a 00:00-23:59). Devuelve '' si la hora de partida no es válida. */
export function sumarMinutos(hora, delta) {
    const base = aMinutos(hora);
    if (base == null) return '';
    const total = Math.min(Math.max(base + delta, 0), 23 * 60 + 59);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Al cambiar la hora de inicio la de fin la sigue: conserva la duración que ya tenía (07:00-08:00 -> inicio 09:00 = 09:00-10:00) y,
 * si aún no había una fin válida, propone una hora después (fin = inicio + 1 h).
 */
export function finAlCambiarInicio({ inicioAntes, finAntes, inicioNuevo }) {
    if (aMinutos(inicioNuevo) == null) return finAntes;
    const antes = aMinutos(inicioAntes);
    const fin = aMinutos(finAntes);
    const duracion = antes != null && fin != null && fin > antes ? fin - antes : 60;
    return sumarMinutos(inicioNuevo, duracion);
}

/** Duración en minutos de una franja (por día), o null si sus horas no son válidas. */
export function duracionFranja(f) {
    const ini = aMinutos(f.hora_inicio);
    const fin = aMinutos(f.hora_fin);
    return ini != null && fin != null && fin > ini ? fin - ini : null;
}

/** Minutos de clase por semana (suma de todas las franjas completas por sus días). */
export function totalMinutos(franjas = []) {
    return franjas.reduce((suma, f) => suma + (duracionFranja(f) ?? 0) * f.dias.length, 0);
}

export const horasPorSemana = (franjas) => formatoDuracion(totalMinutos(franjas));

/** [1,2,3,4,5] -> «Lun a Vie»; [1,3,5] -> «Lun, Mié y Vie»; [2] -> «Mar». */
export function etiquetaDias(dias = []) {
    const lista = ordenarDias(dias).map(Number);
    if (lista.length === 0) return 'Sin días';
    if (lista.length === 1) return nombreDia(lista[0]);
    const seguidos = lista.every((d, i) => i === 0 || d === lista[i - 1] + 1);
    if (seguidos && lista.length >= 3) return `${diaCorto(lista[0])} a ${diaCorto(lista[lista.length - 1])}`;
    const cortos = lista.map(diaCorto);
    return `${cortos.slice(0, -1).join(', ')} y ${cortos[cortos.length - 1]}`;
}

export const etiquetaHoras = (f) => (f.hora_inicio && f.hora_fin ? `${f.hora_inicio}–${f.hora_fin}` : 'Sin horas');

/** Línea de resumen de una franja: «Lun, Mié y Vie · 07:00–08:00». */
export const resumenFranja = (f) => `${etiquetaDias(f.dias)} · ${etiquetaHoras(f)}`;

/** Bloques por día para la vista semanal: { '1': [{ inicio, fin }], ... } (solo franjas completas y válidas). */
export function bloquesPorDia(franjas = []) {
    const porDia = Object.fromEntries(DIAS.map((d) => [d.value, []]));
    for (const f of franjas) {
        if (duracionFranja(f) == null) continue;
        for (const d of f.dias) porDia[String(d)]?.push({ inicio: f.hora_inicio, fin: f.hora_fin, clave: f.clave });
    }
    for (const d of Object.keys(porDia)) porDia[d].sort((a, b) => (aMinutos(a.inicio) ?? 0) - (aMinutos(b.inicio) ?? 0));
    return porDia;
}

/**
 * Valida las franjas. Devuelve { porFranja, general, valido }.
 *   porFranja[clave] = { dias?, inicio?, fin?, solape?, pendientes: ['dias' | 'inicio' | 'fin'] }
 * Los errores de ORDEN (fin <= inicio) y de TRASLAPE se ven al instante; lo que solo está sin llenar (`pendientes`) la interfaz lo
 * muestra después del primer intento de guardar, para no marcar en rojo una franja recién agregada.
 * Con `vacioValido` un horario sin franjas es válido (en el alta del grupo el horario es opcional).
 */
export function validarFranjas(franjas = [], { vacioValido = false } = {}) {
    const porFranja = {};
    const general = [];
    const marcar = (clave, campo, mensaje, pendiente = false) => {
        const e = (porFranja[clave] ??= { pendientes: [] });
        if (e[campo]) return;
        e[campo] = mensaje;
        if (pendiente) e.pendientes.push(campo);
    };

    if (franjas.length === 0 && !vacioValido) general.push('Agrega al menos una franja de horario.');

    for (const f of franjas) {
        if (f.dias.length === 0) marcar(f.clave, 'dias', 'Elige al menos un día.', true);
        const ini = aMinutos(f.hora_inicio);
        const fin = aMinutos(f.hora_fin);
        if (ini == null) marcar(f.clave, 'inicio', 'Indica la hora de inicio.', true);
        if (fin == null) marcar(f.clave, 'fin', 'Indica la hora de fin.', true);
        if (ini != null && fin != null && fin <= ini) marcar(f.clave, 'fin', 'La hora de fin debe ser posterior a la de inicio.');
    }

    // Traslapes: se revisan sobre los bloques ya expandidos (franja:día) con la misma regla del servidor y de HorarioEditor.
    const bloques = franjas.flatMap((f) =>
        ordenarDias(f.dias).map((d) => ({ clave: `${f.clave}:${d}`, franja: f.clave, dia_semana: d, hora_inicio: f.hora_inicio, hora_fin: f.hora_fin })),
    );
    if (bloques.length > MAX_BLOQUES) general.push(`Un grupo admite como máximo ${MAX_BLOQUES} bloques semanales (hoy son ${bloques.length}).`);
    const { porFila } = validarBloques(bloques);
    for (const b of bloques) {
        const mensaje = porFila[b.clave];
        // validarBloques también dice fin <= inicio y horas vacías; esos ya los marcó la franja, aquí solo el traslape.
        if (!mensaje || !/traslapa/.test(mensaje)) continue;
        const propia = franjas.find((x) => x.clave === b.franja);
        const otra = franjas.find((x) => x.clave !== b.franja && x.dias.includes(b.dia_semana) && solapan(x, propia));
        marcar(b.franja, 'solape', `Se traslapa el ${nombreDia(b.dia_semana).toLowerCase()} con otra franja${otra ? ` (${etiquetaHoras(otra)})` : ''}.`);
    }

    const hayErrores = general.length > 0 || Object.values(porFranja).some((e) => e.dias || e.inicio || e.fin || e.solape);
    return { porFranja, general, valido: !hayErrores };
}

function solapan(a, b) {
    const a1 = aMinutos(a.hora_inicio);
    const a2 = aMinutos(a.hora_fin);
    const b1 = aMinutos(b.hora_inicio);
    const b2 = aMinutos(b.hora_fin);
    return [a1, a2, b1, b2].every((x) => x != null) && a1 < b2 && b1 < a2;
}

/** Texto de la comparación con las horas por semana que declara la materia (solo informa: nunca bloquea). */
export function avisoHorasMateria(minutos, horasSemana) {
    const declaradas = Number(horasSemana);
    if (!Number.isFinite(declaradas) || declaradas <= 0 || minutos <= 0) return null;
    const esperadas = declaradas * 60;
    if (minutos === esperadas) return { tono: 'ok', texto: `Coincide con las ${declaradas} h por semana de la materia.` };
    return { tono: 'info', texto: `La materia declara ${declaradas} h por semana; este horario suma ${formatoDuracion(minutos)}.` };
}
