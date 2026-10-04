// Utilidades puras de presentacion de la sesion en curso. Las reglas de negocio viven en la BD: aqui solo se
// decide que mostrar y que control habilitar a partir de lo que devuelve api_sesion_monitor.
import { CONFIG_ASISTENCIA, pct } from '@/lib/graficas.js';

const ZONA = 'America/Mexico_City';

/** '07:00:00' -> '07:00' */
export const formatearHora = (hhmmss) => (hhmmss ? String(hhmmss).slice(0, 5) : '-');

/** ISO -> 'HH:MM:SS' en la zona del plantel. */
export function formatearHoraIso(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('es-MX', { timeZone: ZONA, hour12: false });
}

/** 'YYYY-MM-DD' -> '14 sep 2026' (sin pasar por Date local para no correr el dia). */
export function formatearFecha(fecha) {
    if (!fecha) return '-';
    const [a, m, d] = String(fecha).slice(0, 10).split('-').map(Number);
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${d} ${meses[m - 1] ?? ''} ${a}`;
}

/** Estado mostrado: el estado real o, sin registro, la etiqueta de pantalla 'sin_lecturas' (no es un estado de BD). */
export const estadoMostrado = (alumno) => alumno.estado ?? 'sin_lecturas';

/** Inscritos activos que el docente puede registrar a mano: sin consentimiento vigente o sin lecturas validas. */
export function requiereRegistroManual(alumno) {
    if (alumno.inscripcion && alumno.inscripcion !== 'activa') return false;
    if (alumno.estado && alumno.origen === 'manual') return false;
    return !alumno.consentimiento_vigente || !(alumno.lecturas_validas > 0);
}

/** Por que la fila ofrece «Registrar manualmente» (null si no la ofrece). Se muestra en la celda de accion: las columnas de consentimiento y lecturas se ocultan en pantallas angostas. */
export function motivoRegistroManual(alumno) {
    if (!requiereRegistroManual(alumno)) return null;
    return alumno.consentimiento_vigente ? 'Sin lecturas válidas' : 'Sin consentimiento vigente';
}

/** Sugerencia de estado segun el minuto transcurrido de la sesion (limite de presente y tolerancia de la propia sesion). */
export function sugerirEstado(sesion) {
    const m = Number(sesion?.minuto_actual);
    if (!Number.isFinite(m)) return 'presente';
    if (m <= Number(sesion.limite_presente_min ?? 10)) return 'presente';
    if (m <= Number(sesion.tolerancia_min ?? 20)) return 'retardo';
    return 'ausente';
}

/** El cierre se habilita cuando la sesion esta abierta y la ventana de tolerancia ya termino. */
export const cierreHabilitado = (sesion) => sesion?.estatus === 'abierta' && sesion.en_ventana === false;

/** Lecturas validas en capturas distintas que confirman la asistencia (min_detecciones_validas del servidor, RF-03). */
export const LECTURAS_REQUERIDAS = 3;

// null, '' y undefined no son numeros (Number(null) daria 0 y se creeria que la clase va en el minuto 0).
const numeroONaN = (v) => (v == null || v === '' ? Number.NaN : Number(v));

/** Minutos que faltan para que termine la tolerancia (y se habilite el cierre), redondeados hacia arriba; null si no se saben. */
export function minutosParaCierre(sesion) {
    const total = numeroONaN(sesion?.tolerancia_min);
    const minuto = numeroONaN(sesion?.minuto_actual);
    if (!Number.isFinite(total) || !Number.isFinite(minuto)) return null;
    return Math.max(1, Math.ceil(total - minuto));
}

/**
 * Por que el cierre aun no esta disponible, en una frase con los minutos que faltan; null si ya se puede cerrar (o la sesion no esta
 * abierta). Es el texto que acompana al boton deshabilitado: un boton gris sin motivo no dice que hay que esperar.
 */
export function motivoCierre(sesion) {
    if (sesion?.estatus !== 'abierta' || cierreHabilitado(sesion)) return null;
    const falta = minutosParaCierre(sesion);
    const total = numeroONaN(sesion?.tolerancia_min);
    if (falta == null) return `El cierre se habilita al terminar la tolerancia${Number.isFinite(total) ? ` (${total} min)` : ''}.`;
    return `El cierre se habilita al terminar la tolerancia: ${falta === 1 ? 'falta 1 min' : `faltan ${falta} min`}.`;
}

/** «hace 8 s», «hace 2 min»: tiempo transcurrido desde un instante (en segundos) con la granularidad que importa al docente. */
export function textoHace(segundos) {
    const s = Math.max(0, Math.floor(Number(segundos) || 0));
    if (s < 60) return `hace ${s} s`;
    const min = Math.floor(s / 60);
    return min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h`;
}

export const ETIQUETA_FASE = {
    presente: 'Presente (dentro del limite de puntualidad)',
    retardo: 'Retardo',
    fuera_de_ventana: 'Fuera de ventana',
};

export const etiquetaScore = (s) => (s == null ? '-' : Number(s).toFixed(2));

// ---- Graficas de la sesion (distribuciones a partir de `totales` de api_sesion_monitor) ----

// Sesion abierta: quien aun no tiene registro es 'sin_registro' (no es un estado de BD; en el cierre se vuelve ausente o pendiente).
export const CONFIG_SESION_ABIERTA = {
    presente: CONFIG_ASISTENCIA.presente,
    retardo: CONFIG_ASISTENCIA.retardo,
    sin_registro: { label: 'Sin registro', color: 'var(--ausente)' },
    pendiente: CONFIG_ASISTENCIA.pendiente,
};

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

/** Estados de la sesion en curso: [{ clave, valor }] en orden fijo (los ceros se conservan: la leyenda los muestra). */
export function distribucionSesionAbierta(totales) {
    const t = totales ?? {};
    return [
        { clave: 'presente', valor: num(t.presentes) },
        { clave: 'retardo', valor: num(t.retardos) },
        { clave: 'sin_registro', valor: num(t.sin_registro) },
        { clave: 'pendiente', valor: num(t.pendientes) },
    ];
}

/** Estados de una sesion cerrada (misma paleta que StatusChip: CONFIG_ASISTENCIA). */
export function distribucionSesionCerrada(totales) {
    const t = totales ?? {};
    return [
        { clave: 'presente', valor: num(t.presentes) },
        { clave: 'retardo', valor: num(t.retardos) },
        { clave: 'ausente', valor: num(t.ausentes) },
        { clave: 'justificado', valor: num(t.justificados) },
        { clave: 'pendiente', valor: num(t.pendientes) },
    ];
}

/** % de asistencia = (presentes + retardos) sobre inscritos, entero; 0 sin inscritos. */
export function porcentajeAsistencia(totales) {
    const t = totales ?? {};
    return pct(num(t.presentes) + num(t.retardos), num(t.inscritos), 0);
}

/** Texto del centro del anillo de una sesión cerrada: «83 %» y la etiqueta. */
export function centroAsistencia(totales) {
    return { valor: `${porcentajeAsistencia(totales)} %`, etiqueta: 'asistencia' };
}

/**
 * Centro del anillo en la sesión en curso: el número de inscritos. El % de asistencia ya lo dice el medidor líquido que va al lado
 * (ver `presentesAhora`); repetirlo en el centro pondría la misma cifra dos veces en la misma tarjeta.
 */
export function centroInscritos(totales) {
    return { valor: num(totales?.inscritos), etiqueta: 'Inscritos' };
}

/**
 * Datos del medidor «Presentes ahora»: `valor` = (presentes + retardos) sobre inscritos, entero y acotado a 0-100, y la línea de apoyo
 * «N de M inscritos». `null` sin inscritos: un medidor en 0 % de nadie no dice nada y el anillo ya avisa que no hay alumnos.
 */
export function presentesAhora(totales) {
    const t = totales ?? {};
    const inscritos = num(t.inscritos);
    if (inscritos <= 0) return null;
    const asistentes = num(t.presentes) + num(t.retardos);
    return {
        valor: Math.min(100, porcentajeAsistencia(totales)),
        asistentes,
        inscritos,
        descripcion: `${asistentes} de ${inscritos} inscritos`,
    };
}

// Claves de `totales` que alimentan cada grafica. El sondeo (cada 5 s) trae un objeto nuevo aunque los valores no cambien:
// comparar por valor evita volver a renderizar la grafica (y su medidor) sin que haya un dato nuevo.
export const CLAVES_ASISTENCIA = ['inscritos', 'presentes', 'retardos', 'sin_registro', 'ausentes', 'justificados', 'pendientes'];
export const CLAVES_ACTIVIDAD = ['capturas', 'detecciones', 'detecciones_validas'];

/** true si `a` y `b` tienen los mismos valores en `claves` (aunque sean objetos distintos). */
export const mismosValores = (a, b, claves) => a === b || claves.every((k) => a?.[k] === b?.[k]);

export const CONFIG_ACTIVIDAD = { cantidad: { label: 'Cantidad', color: 'var(--chart-1)' } };

/** Actividad del reconocimiento facial: capturas, detecciones y detecciones validas. [] si aun no hay actividad. */
export function actividadReconocimiento(totales) {
    const t = totales ?? {};
    const filas = [
        { etapa: 'Capturas', cantidad: num(t.capturas) },
        { etapa: 'Detecciones', cantidad: num(t.detecciones) },
        { etapa: 'Det. válidas', cantidad: num(t.detecciones_validas) },
    ];
    return filas.some((f) => f.cantidad > 0) ? filas : [];
}

/** Texto alternativo de la grafica de actividad. */
export function resumenActividad(filas) {
    if (!filas.length) return 'Aún no hay capturas ni detecciones.';
    return filas.map((f) => `${f.etapa}: ${f.cantidad}`).join('; ');
}
