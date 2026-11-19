// Funciones puras de la solicitud de laboratorio: valores, reglas, validación, traslapes y errores del servidor.
// La validación espeja las reglas de api_laboratorio_solicitar (docs/API-RPC.md) para avisar ANTES de enviar; la decisión final
// siempre es del servidor, por eso sus errores se muestran tal cual (mapearError) y nada aquí bloquea por capacidad o disponibilidad.
import { compararFechas, esFechaISO } from '@/lib/formularios/fechas.js';
import { minutosDeHora, sumarDias } from '../../laboratorios.utils.js';
import { fechaHoraDeInstante, instanteEnMinutos } from '../compartido/reloj.utils.js';
import { rotuloEdificio, rotuloGrupo, textoAlumnos } from '../compartido/rotulos.utils.js';

// Valores por omisión de los parámetros del sistema (supabase/migrations/0240): se usan si api_parametros_publicos no responde.
export const ANTICIPACION_DEFECTO = 24;
export const HORIZONTE_DEFECTO = 60;
export const DURACION_MINIMA = 30;
export const DURACION_MAXIMA = 8 * 60;
export const ACTIVIDAD_MIN = 3;
export const ACTIVIDAD_MAX = 200;

// Atajos de la fecha de uso. «Hoy» no se ofrece: con la anticipación mínima nunca es válido (y CampoFecha oculta los atajos fuera de rango).
export const ATAJOS_FECHA = [
    { label: 'Mañana', valor: ({ hoy }) => sumarDias(hoy, 1) },
    { label: 'En una semana', valor: ({ hoy }) => sumarDias(hoy, 7) },
];

// Los selects trabajan con texto: los ids se guardan como cadena y se convierten al enviar.
export const INICIAL_SOLICITUD = Object.freeze({ id_aula: '', id_grupo: '', fecha: '', hora_inicio: '', hora_fin: '', actividad: '' });

const numeroNoNegativo = (v, defecto) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : defecto;
};

/**
 * Reglas de plazo vigentes a partir del reloj del plantel y de api_parametros_publicos.
 *   primero      primer instante en que puede EMPEZAR un uso: ahora + anticipación mínima.
 *   fechaMaxima  último día que se puede solicitar: hoy + horizonte.
 */
export function reglasDe(reloj, parametros) {
    const anticipacionHoras = numeroNoNegativo(parametros?.lab_anticipacion_horas, ANTICIPACION_DEFECTO);
    const horizonteDias = numeroNoNegativo(parametros?.lab_horizonte_dias, HORIZONTE_DEFECTO);
    const ahora = instanteEnMinutos(reloj.hoy, reloj.hora);
    return {
        hoy: reloj.hoy,
        hora: reloj.hora,
        anticipacionHoras,
        horizonteDias,
        primero: fechaHoraDeInstante(ahora + anticipacionHoras * 60),
        fechaMaxima: sumarDias(reloj.hoy, horizonteDias),
    };
}

const textoHoras = (n) => `${n} ${n === 1 ? 'hora' : 'horas'}`;

function errorDeFecha(fecha, reglas) {
    if (!fecha) return 'Elige la fecha de uso.';
    if (!esFechaISO(fecha)) return 'La fecha no es válida.';
    if (compararFechas(fecha, reglas.hoy) < 0) return 'La fecha ya pasó.';
    if (compararFechas(fecha, reglas.fechaMaxima) > 0) {
        return `Solo se puede solicitar con hasta ${reglas.horizonteDias} días de anticipación.`;
    }
    if (compararFechas(fecha, reglas.primero.fecha) < 0) {
        return `Solicita el laboratorio con al menos ${textoHoras(reglas.anticipacionHoras)} de anticipación.`;
    }
    return null;
}

function errorDePlazo(fecha, hora, reglas) {
    const inicio = instanteEnMinutos(fecha, hora);
    const limite = instanteEnMinutos(reglas.primero.fecha, reglas.primero.hora);
    if (inicio == null || limite == null || inicio >= limite) return null;
    // El día límite se dice con la primera hora posible; así la persona sabe a qué hora corregirla.
    if (fecha === reglas.primero.fecha) {
        return `Ese día solo puedes empezar desde las ${reglas.primero.hora} (se pide con al menos ${textoHoras(reglas.anticipacionHoras)} de anticipación).`;
    }
    return `Solicita el laboratorio con al menos ${textoHoras(reglas.anticipacionHoras)} de anticipación.`;
}

/** Valida los valores del formulario: { campo: 'mensaje' } con solo los campos incorrectos. */
export function validarSolicitud(valores, reglas) {
    const e = {};
    if (!valores.id_aula) e.id_aula = 'Elige el laboratorio.';
    if (!valores.id_grupo) e.id_grupo = 'Elige el grupo.';

    const errFecha = errorDeFecha(valores.fecha, reglas);
    if (errFecha) e.fecha = errFecha;

    const inicio = minutosDeHora(valores.hora_inicio);
    const fin = minutosDeHora(valores.hora_fin);
    if (!valores.hora_inicio) e.hora_inicio = 'Elige la hora de inicio.';
    else if (inicio == null) e.hora_inicio = 'La hora de inicio no es válida.';
    // Si la fecha ya está mal, el plazo de la hora no aporta: se corrige primero la fecha.
    if (!e.fecha && !e.hora_inicio) {
        const plazo = errorDePlazo(valores.fecha, valores.hora_inicio, reglas);
        if (plazo) e.hora_inicio = plazo;
    }

    if (!valores.hora_fin) e.hora_fin = 'Elige la hora de fin.';
    else if (fin == null) e.hora_fin = 'La hora de fin no es válida.';
    else if (inicio != null) {
        if (fin <= inicio) e.hora_fin = 'La hora de fin debe ser posterior a la de inicio.';
        else if (fin - inicio < DURACION_MINIMA) e.hora_fin = 'El uso del laboratorio debe durar al menos 30 minutos.';
        else if (fin - inicio > DURACION_MAXIMA) e.hora_fin = 'El uso del laboratorio no puede pasar de 8 horas.';
    }

    const actividad = String(valores.actividad ?? '').trim();
    if (actividad.length === 0) e.actividad = 'Describe la actividad que harán en el laboratorio.';
    else if (actividad.length < ACTIVIDAD_MIN) e.actividad = `Describe la actividad con al menos ${ACTIVIDAD_MIN} caracteres.`;
    else if (actividad.length > ACTIVIDAD_MAX) e.actividad = `La actividad admite hasta ${ACTIVIDAD_MAX} caracteres.`;
    return e;
}

/** Cuerpo `datos` de laboratorioSolicitar a partir de los valores del formulario. */
export function datosSolicitud(valores) {
    return {
        id_aula: Number(valores.id_aula),
        id_grupo: Number(valores.id_grupo),
        fecha: valores.fecha,
        hora_inicio: valores.hora_inicio,
        hora_fin: valores.hora_fin,
        actividad: String(valores.actividad ?? '').trim(),
    };
}

/**
 * Pega el error del servidor al campo que lo causó (el mensaje ya viene en español y se muestra tal cual). Devuelve
 * { campo: mensaje } o null si es un error general (cuenta inactiva, red caída…), que va al aviso del formulario.
 */
export function errorDeCampoSolicitud(error) {
    if (!error) return null;
    const mensaje = error.message || 'No se pudo enviar la solicitud.';
    const en = (campo) => ({ [campo]: mensaje });
    switch (error.code) {
        // «...con al menos N horas de anticipación» depende de la hora de inicio; «ya pasaron» y «hasta N días», de la fecha.
        case 'LAB_FUERA_DE_PLAZO':
            return /horas/i.test(mensaje) ? en('hora_inicio') : en('fecha');
        case 'LAB_CAPACIDAD_INSUFICIENTE':
        case 'LAB_NO_ES_LABORATORIO':
            return en('id_aula');
        case 'LAB_OCUPADO':
            return en('hora_inicio');
        case 'SOLICITUD_DUPLICADA':
            return en('id_grupo');
        case 'HORA_INVALIDA':
            return /hora_inicio/i.test(mensaje) ? en('hora_inicio') : en('hora_fin');
        case 'NO_ENCONTRADO':
            if (/grupo/i.test(mensaje)) return en('id_grupo');
            if (/laboratorio/i.test(mensaje)) return en('id_aula');
            return null;
        case 'VALIDACION':
            if (/fecha/i.test(mensaje)) return en('fecha');
            if (/actividad/i.test(mensaje)) return en('actividad');
            if (/dur[ae]|minutos/i.test(mensaje)) return en('hora_fin');
            return null;
        default:
            return null;
    }
}

/** Opciones del select de laboratorio: «LAB-1 · Edificio C · 30 lugares». */
export function opcionesLaboratorio(laboratorios = []) {
    return laboratorios.map((l) => ({
        value: String(l.id_aula),
        label: `${l.clave} · ${rotuloEdificio(l.edificio)} · ${l.capacidad} lugares`,
    }));
}

/** Opciones del select de grupo: «Administración I (3A) · 4 alumnos». */
export function opcionesGrupo(grupos = []) {
    return grupos.map((g) => ({ value: String(g.id_grupo), label: `${rotuloGrupo(g)} · ${textoAlumnos(g.inscritos)}` }));
}

/**
 * Aviso (no error) cuando el grupo no cabe en el laboratorio. El servidor rechaza la solicitud con LAB_CAPACIDAD_INSUFICIENTE; aquí
 * solo se adelanta para que la persona elija otro laboratorio sin esperar al envío. null si cabe o falta elegir.
 */
export function avisoCapacidad(grupo, laboratorio) {
    if (!grupo || !laboratorio) return null;
    if (!(Number(grupo.inscritos) > Number(laboratorio.capacidad))) return null;
    return `El grupo ${grupo.clave_grupo} tiene ${textoAlumnos(grupo.inscritos)} activos y ${laboratorio.clave} admite ${laboratorio.capacidad}. El sistema rechazará la solicitud: elige un laboratorio con más lugares.`;
}

/**
 * Argumentos de laboratorioAgenda para «Disponibilidad ese día», o null si todavía no se puede consultar (falta laboratorio o fecha, o la
 * fecha está fuera de la ventana en la que se puede solicitar: no tiene caso mirarla).
 */
export function argumentosAgenda({ idAula, fecha }, reglas) {
    if (!idAula || !esFechaISO(fecha)) return null;
    if (compararFechas(fecha, reglas.primero.fecha) < 0 || compararFechas(fecha, reglas.fechaMaxima) > 0) return null;
    return { idAula: Number(idAula), desde: fecha, hasta: fecha };
}

const mismoGrupo = (bloque, grupo) =>
    Boolean(grupo) && bloque.clave_grupo === grupo.clave_grupo && bloque.materia_clave === grupo.materia_clave;

/**
 * Bloques ocupados de la agenda que se traslapan con el horario elegido, cada uno con su nivel:
 *   'duplicada'  el mismo grupo ya tiene una solicitud pendiente o aprobada ahí (el servidor responde SOLICITUD_DUPLICADA);
 *   'bloquea'    una clase de otro grupo o una solicitud APROBADA (el servidor responde LAB_OCUPADO);
 *   'compite'    otra solicitud PENDIENTE: no bloquea, el administrador decide entre ambas.
 * La clase del propio grupo en ese laboratorio no cuenta (el servidor tampoco la considera choque).
 */
export function traslapes(bloques = [], inicio, fin, grupo = null) {
    const a = minutosDeHora(inicio);
    const b = minutosDeHora(fin);
    if (a == null || b == null || b <= a) return [];
    const choques = [];
    for (const bloque of bloques) {
        const bi = minutosDeHora(bloque.hora_inicio);
        const bf = minutosDeHora(bloque.hora_fin);
        if (bi == null || bf == null || !(bi < b && bf > a)) continue;
        if (bloque.tipo === 'clase') {
            if (!mismoGrupo(bloque, grupo)) choques.push({ bloque, nivel: 'bloquea' });
        } else if (mismoGrupo(bloque, grupo)) {
            choques.push({ bloque, nivel: 'duplicada' });
        } else {
            choques.push({ bloque, nivel: bloque.estatus === 'aprobada' ? 'bloquea' : 'compite' });
        }
    }
    return choques;
}

const detalleBloque = (b) => {
    const que = b.tipo === 'clase' ? 'clase' : `solicitud ${b.estatus === 'aprobada' ? 'aprobada' : 'pendiente'}`;
    return `${b.hora_inicio} – ${b.hora_fin}, ${que} de ${b.clave_grupo}`;
};

/**
 * Aviso de traslape para mostrar junto al horario: { tono: 'warning' | 'info', titulo, detalle } o null si no hay choque.
 * Prioridad: duplicada > bloquea > compite (se avisa lo más grave y se listan los bloques de ese nivel).
 */
export function avisoTraslape(choques = []) {
    for (const nivel of ['duplicada', 'bloquea', 'compite']) {
        const lista = choques.filter((c) => c.nivel === nivel);
        if (lista.length === 0) continue;
        const detalle = lista.map((c) => detalleBloque(c.bloque)).join('; ');
        if (nivel === 'duplicada') {
            return { tono: 'warning', titulo: 'Ese grupo ya tiene una solicitud en este horario', detalle: `${detalle}. Cancélala o elige otro horario.` };
        }
        if (nivel === 'bloquea') {
            return { tono: 'warning', titulo: 'El laboratorio está ocupado en este horario', detalle: `Se traslapa con ${detalle}. El sistema rechazará la solicitud: elige otro horario.` };
        }
        return {
            tono: 'info',
            titulo: 'Hay otra solicitud pendiente en este horario',
            detalle: `${detalle}. Puedes enviar la tuya: el administrador decidirá entre las solicitudes.`,
        };
    }
    return null;
}
