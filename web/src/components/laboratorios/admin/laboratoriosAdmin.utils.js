// Utilidades puras compartidas por los componentes de la pantalla del administrador (solicitudes, agenda e historial).
// Las compartidas con la pantalla del docente (fechas, horas, estatus) viven en ../laboratorios.utils.js.
import { esFechaISO } from '@/lib/formularios/fechas.js';
import { formatoFechaCorta, minutosDeHora } from '../laboratorios.utils.js';

/** Largo del motivo o comentario: la RPC pide al menos 3 caracteres al rechazar o cancelar y admite hasta 300. */
export const LIMITE_MOTIVO = { min: 3, max: 300 };

// Las horas de negocio del plantel (api_ahora) siguen la zona de la sede; los instantes ISO que entrega la base se muestran en ella
// y no en la del navegador, para que «14 sep, 07:12» sea lo mismo en todas las pantallas.
const ZONA_NEGOCIO = 'America/Mexico_City';

/**
 * Errores que significan «el mundo cambió desde que cargaste la lista» (otra persona resolvió la solicitud, ya empezó, el laboratorio
 * se ocupó o dejó de serlo): la pantalla muestra el mensaje del servidor y recarga, en lugar de dejar el diálogo abierto.
 */
export const CODIGOS_ESTADO_CAMBIADO = [
    'LAB_OCUPADO',
    'SOLICITUD_VENCIDA',
    'SOLICITUD_YA_RESUELTA',
    'LAB_CAPACIDAD_INSUFICIENTE',
    'LAB_NO_ES_LABORATORIO',
    'NO_ENCONTRADO',
];

export const cambioElEstado = (error) => CODIGOS_ESTADO_CAMBIADO.includes(error?.code);

/** '1 solicitud' / '3 solicitudes'. */
export function conteoTexto(n, uno, varios) {
    return `${n} ${n === 1 ? uno : varios}`;
}

/** 'LAB-1 · Edificio C' (para listas desplegables, diálogos y textos de apoyo). */
export function etiquetaLaboratorio(aula) {
    if (!aula) return 'Laboratorio';
    return aula.edificio ? `${aula.clave} · ${aula.edificio}` : String(aula.clave);
}

/** Ocupación del laboratorio por el grupo: { inscritos, capacidad, excede, texto } con texto '28 alumnos de 30 lugares'. */
export function ocupacion(grupo, aula) {
    const inscritos = Number(grupo?.inscritos ?? 0);
    const capacidad = Number(aula?.capacidad ?? 0);
    return {
        inscritos,
        capacidad,
        // Misma regla que la RPC al aprobar: más inscritos activos que lugares.
        excede: capacidad > 0 && inscritos > capacidad,
        texto: `${inscritos} ${inscritos === 1 ? 'alumno' : 'alumnos'} de ${capacidad} ${capacidad === 1 ? 'lugar' : 'lugares'}`,
    };
}

/** { fecha, hora } 'AAAA-MM-DD' y 'HH:MM' a partir de api_ahora (la hora llega con segundos); null si no sirve. */
export function normalizarAhora(data) {
    if (!data || !esFechaISO(data.fecha)) return null;
    const hora = String(data.hora ?? '').slice(0, 5);
    return { fecha: data.fecha, hora: minutosDeHora(hora) == null ? null : hora };
}

/**
 * ¿La clase aún no empieza? Misma regla que el servidor (empezó si el inicio es menor o igual al ahora). Sin reloj conocido se asume que
 * sí: la decisión real es de la RPC, que responde SOLICITUD_VENCIDA.
 */
export function aunNoInicia(fecha, horaInicio, ahora) {
    if (!ahora?.fecha) return true;
    if (fecha !== ahora.fecha) return fecha > ahora.fecha;
    const inicio = minutosDeHora(horaInicio);
    const actual = minutosDeHora(ahora.hora);
    if (inicio == null || actual == null) return true;
    return inicio > actual;
}

/** El administrador puede cancelar una aprobada que todavía no inicia. */
export const esCancelable = (solicitud, ahora) => solicitud?.estatus === 'aprobada' && aunNoInicia(solicitud.fecha, solicitud.hora_inicio, ahora);

/** Une páginas de solicitudes sin repetir ninguna (si algo cambió entre dos cargas, el desplazamiento puede traer una repetida). */
export function unirPaginas(base = [], extras = []) {
    const vistos = new Set();
    const lista = [];
    for (const item of [...base, ...extras]) {
        if (vistos.has(item.id_solicitud)) continue;
        vistos.add(item.id_solicitud);
        lista.push(item);
    }
    return lista;
}

/** Instante ISO de la base -> 'mié 16 sep, 07:12' en la zona de la sede; '—' si no es válido. */
export function formatoMomento(iso, hoy = null) {
    if (!iso) return '—';
    const instante = new Date(iso);
    if (Number.isNaN(instante.getTime())) return '—';
    const partes = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: ZONA_NEGOCIO,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        })
            .formatToParts(instante)
            .map((p) => [p.type, p.value]),
    );
    return `${formatoFechaCorta(`${partes.year}-${partes.month}-${partes.day}`, hoy)}, ${partes.hour}:${partes.minute}`;
}
