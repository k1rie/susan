// Plan de los casos de revisión de la demostración (solo modo local).
//
// La pantalla de Revisión del docente1 vive de asistencias 'pendiente' (1 o 2 lecturas válidas al cerrar la sesión,
// RN-05) y de justificantes por resolver. Para que existan SIN inventar filas, el script de la demostración reproduce
// dos clases cerradas de reposición del grupo 3A pasando por las mismas funciones que usa la aplicación
// (api_abrir_sesion -> svc_crear_captura -> svc_registrar_detecciones -> cerrar_sesion). Este módulo es el guion
// puro de esas clases: quién sale en qué captura y con qué score. Sin importaciones (lo carga el script como módulo
// suelto) y sin azar: la misma ejecución produce siempre los mismos datos.
//
// Por qué sábado y domingo y no sesiones del horario normal: el plazo para resolver un pendiente es de 48 h desde
// hora_fin (RN-08). Con el reloj de la demostración fijo en lunes 14-sep-2026 07:12, las clases del viernes ya
// vencieron; estas dos siguen vigentes (la del sábado vence hoy a las 10:00, la del domingo mañana a las 10:00).

/** Espejo de los parámetros del sistema que importan al guion (supabase/migrations/0040_parametros.sql). */
export const PARAMETROS_DEMO = Object.freeze({
    umbral: 0.85,
    minDetecciones: 3,
    limitePresenteMin: 10,
    toleranciaMin: 20,
});

/** Alumnos activos del 3A por ordinal (1..24); el 25 está en baja y no pasa lista. */
export const ALUMNOS_ACTIVOS = 24;

// Hash entero determinista (sin Math.random): mismo (a, b) -> mismo número 0..99.
const centesimas = (a, b) => ((Math.imul(a + 1, 2654435761) ^ Math.imul(b + 7, 40503)) >>> 0) % 100;

/** Score de una lectura válida: 0.880..0.976, siempre por encima del umbral. */
const scoreHabitual = (ordinal, captura) => 0.88 + ((ordinal * 31 + captura * 17) % 97) / 1000;

const redondear3 = (x) => Math.round(x * 1000) / 1000;

/**
 * @typedef {{ ordinal: number, score: number } | { extrano: number }} Rostro  ordinal = posición del alumno en el 3A
 * @typedef {{ n: number, segundo: number, camara: 'frente' | 'fondo', rostros: Rostro[] }} Captura
 * @typedef {{ clave: string, grupo: string, fecha: string, horaInicio: string, horaFin: string, capturas: Captura[] }} SesionDemo
 */

// [captura (1..n), score opcional] -> { captura, score }
const lectura = (c, ordinal) => (typeof c === 'number'
    ? { captura: c, score: redondear3(scoreHabitual(ordinal, c)) }
    : { captura: c.c, score: c.score });

/**
 * @param {{ clave: string, fecha: string, horaInicio: string, horaFin: string, segundos: number[],
 *           retardos: number[], ausentes: number[],
 *           pendientes: Record<number, { validas: (number | { c: number, score: number })[], invalidas?: { c: number, score: number }[] }>,
 *           extranos: Record<number, number> }} d  extranos: captura -> ordinal del extraño
 * @returns {SesionDemo}
 */
function construirSesion({ clave, fecha, horaInicio, horaFin, segundos, retardos, ausentes, pendientes, extranos }) {
    const limiteSeg = PARAMETROS_DEMO.limitePresenteMin * 60;
    const capturas = segundos.map((segundo, i) => ({
        n: i + 1,
        segundo,
        // La cámara del navegador (frente) y la IP (fondo) muestrean por turnos, como en el aula A-12.
        camara: i % 2 === 0 ? 'frente' : 'fondo',
        rostros: [],
    }));

    for (let ordinal = 1; ordinal <= ALUMNOS_ACTIVOS; ordinal += 1) {
        if (ausentes.includes(ordinal)) continue;
        const caso = pendientes[ordinal];
        if (caso) {
            const lecturas = [
                ...(caso.invalidas ?? []).map((l) => ({ captura: l.c, score: l.score })),
                ...caso.validas.map((c) => lectura(c, ordinal)),
            ];
            for (const l of lecturas) capturas[l.captura - 1].rostros.push({ ordinal, score: l.score });
            continue;
        }
        for (const c of capturas) {
            const llegoTarde = retardos.includes(ordinal);
            // Quien llega tarde solo aparece desde el minuto 10; el puntual, siempre en las tres primeras capturas y
            // después con ~65 % de probabilidad (alguien se agacha, tapa la cara...).
            const aparece = llegoTarde
                ? c.segundo >= limiteSeg
                : c.n <= 3 || centesimas(ordinal, c.n) < 65;
            if (aparece) c.rostros.push({ ordinal, score: redondear3(scoreHabitual(ordinal, c.n)) });
        }
    }
    for (const [captura, extrano] of Object.entries(extranos)) capturas[Number(captura) - 1].rostros.push({ extrano });
    for (const c of capturas) {
        // Ordinales ascendentes y los extraños al final: el orden fija el nombre del recorte (n.jpg) y no cambia nunca.
        c.rostros.sort((a, b) => (a.ordinal ?? 1000 + a.extrano) - (b.ordinal ?? 1000 + b.extrano));
    }
    return { clave, grupo: '3A', fecha, horaInicio, horaFin, capturas };
}

/** Sábado 12-sep: 6 capturas (cada 3 min). Vence hoy a las 10:00: el caso urgente de la cola. */
const REPOSICION_SABADO = construirSesion({
    clave: 'reposicion-sabado',
    fecha: '2026-09-12',
    horaInicio: '09:00',
    horaFin: '10:00',
    segundos: [120, 300, 480, 660, 840, 1020],
    retardos: [6, 22],
    ausentes: [14, 16, 20],
    pendientes: {
        3: { validas: [1, 3] }, // 2 lecturas, la primera en el minuto 2 -> sugiere presente
        8: { invalidas: [{ c: 3, score: 0.79 }], validas: [{ c: 5, score: 0.874 }] }, // 1 válida (minuto 14) + 1 por debajo del umbral
        12: { validas: [4, 5] }, // 2 lecturas desde el minuto 11 -> sugiere retardo
        18: { validas: [{ c: 2, score: 0.931 }] }, // 1 lectura en el minuto 5
    },
    extranos: { 2: 0, 5: 1 },
});

/** Domingo 13-sep: 7 capturas, dos de ellas en el límite 9:59 / 10:00 de RN-03. Vence mañana a las 10:00. */
const REPOSICION_DOMINGO = construirSesion({
    clave: 'reposicion-domingo',
    fecha: '2026-09-13',
    horaInicio: '09:00',
    horaFin: '10:00',
    segundos: [120, 300, 480, 599, 600, 840, 1020],
    retardos: [7, 23],
    ausentes: [14, 17, 19],
    pendientes: {
        2: { validas: [1, 2] },
        9: { invalidas: [{ c: 5, score: 0.82 }], validas: [{ c: 7, score: 0.861 }] },
        15: { validas: [{ c: 4, score: 0.903 }] }, // 9:59 -> presente
        21: { validas: [{ c: 5, score: 0.897 }] }, // 10:00 -> retardo
    },
    extranos: { 2: 0, 5: 1, 6: 2 },
});

/** Clases de reposición del guion, en orden cronológico. */
export const SESIONES_DEMO = Object.freeze([REPOSICION_SABADO, REPOSICION_DOMINGO]);

/**
 * Justificantes por resolver que el guion agrega a los dos que ya trae la semilla del docente1 (3A y 5C, viernes 11):
 * en total quedan cuatro en la pestaña Justificantes. `instante` es cuándo se "registraron" (el reloj de la RPC).
 */
export const JUSTIFICANTES_DEMO = Object.freeze([
    { sesion: 'reposicion-sabado', ordinal: 16, motivo: 'Cita médica en el IMSS', registradoPor: 'alumno', instante: '2026-09-13 20:30:00-06' },
    { sesion: 'reposicion-domingo', ordinal: 7, motivo: 'Problemas de transporte', registradoPor: 'docente', instante: '2026-09-14 06:45:00-06' },
]);

/**
 * Lecturas válidas (capturas distintas con score >= umbral) de un alumno en una sesión del guion.
 * @param {SesionDemo} sesion
 * @param {number} ordinal
 * @param {number} [umbral]
 */
export function lecturasValidas(sesion, ordinal, umbral = PARAMETROS_DEMO.umbral) {
    return sesion.capturas.filter((c) => c.rostros.some((r) => r.ordinal === ordinal && r.score >= umbral));
}

/**
 * Estado con el que debe quedar el alumno al cerrar la sesión (RN-02 a RN-05, RN-07), aplicando las mismas reglas
 * que la base de datos. Sirve para validar el guion en pruebas y para comprobar lo que la base realmente produjo.
 * @param {SesionDemo} sesion
 * @param {number} ordinal
 * @param {typeof PARAMETROS_DEMO} [p]
 * @returns {{ estado: 'presente' | 'retardo' | 'pendiente' | 'ausente', lecturasValidas: number, primeraLecturaSeg: number | null }}
 */
export function resultadoEsperado(sesion, ordinal, p = PARAMETROS_DEMO) {
    const validas = lecturasValidas(sesion, ordinal, p.umbral);
    if (validas.length === 0) return { estado: 'ausente', lecturasValidas: 0, primeraLecturaSeg: null };
    const primera = validas[0].segundo;
    if (validas.length < p.minDetecciones) return { estado: 'pendiente', lecturasValidas: validas.length, primeraLecturaSeg: primera };
    const minuto = primera / 60;
    const estado = minuto < p.limitePresenteMin ? 'presente' : 'retardo';
    return { estado, lecturasValidas: validas.length, primeraLecturaSeg: primera };
}

/**
 * Ordinales del 3A por estado final de la sesión.
 * @returns {{ presente: number[], retardo: number[], pendiente: number[], ausente: number[] }}
 */
export function resumenEsperado(sesion, p = PARAMETROS_DEMO) {
    const salida = { presente: [], retardo: [], pendiente: [], ausente: [] };
    for (let ordinal = 1; ordinal <= ALUMNOS_ACTIVOS; ordinal += 1) salida[resultadoEsperado(sesion, ordinal, p).estado].push(ordinal);
    return salida;
}
