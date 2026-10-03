import { validarNumero } from '../common/validar.js';
import { ajusteLineal } from '../regression/minimosCuadrados.js';
import { desviacion, media } from '../stats/descriptiva.js';

/** Máximos por factor: suman 100 y son parte del contrato de explicabilidad (documentados en NUMERICS.md). */
export const PESOS_RIESGO = Object.freeze({
    distanciaLimite: 25,
    pendienteReciente: 15,
    faltasConsecutivas: 15,
    concentracionDia: 5,
    proyeccionCruce: 20,
    zScoreGrupo: 10,
    retardosAcumulados: 10,
});

const NOMBRES_DIA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** Día ISO (1 = lunes ... 7 = domingo) de una fecha 'YYYY-MM-DD', sin depender del reloj ni de la zona horaria. */
export function diaSemanaISO(fecha) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha));
    if (!m) {
        return null;
    }
    const dias = Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000);
    return ((((dias + 3) % 7) + 7) % 7) + 1;
}

const acotar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const redondear1 = (v) => Math.round(v * 10) / 10;

/**
 * Conteos de un alumno: faltas equivalentes = ausencias + floor(retardos / retardosPorAusencia);
 * justificado y pendiente no cuentan (RN-10, RN-11).
 * @param {(string|null)[]} estados
 * @param {number} rpa
 */
export function resumirAsistencia(estados, rpa) {
    let ausentes = 0;
    let retardos = 0;
    let justificados = 0;
    let registradas = 0;
    for (const e of estados) {
        if (e === null || e === undefined) {
            continue;
        }
        registradas += 1;
        if (e === 'ausente') {
            ausentes += 1;
        } else if (e === 'retardo') {
            retardos += 1;
        } else if (e === 'justificado') {
            justificados += 1;
        }
    }
    return { ausentes, retardos, justificados, registradas, faltasEq: ausentes + Math.floor(retardos / rpa) };
}

/**
 * @typedef {object} FactorRiesgo
 * @property {string} id
 * @property {string} nombre
 * @property {number|null} valor   magnitud observada (en `unidad`)
 * @property {string} unidad
 * @property {number} aporte       puntos que suma al puntaje (0..maximo)
 * @property {number} maximo
 * @property {string} explicacion  frase en español
 */

/**
 * @typedef {object} ContextoRiesgo
 * @property {number} sesionesProgramadas
 * @property {number} [limitePct]            por omisión 20
 * @property {number} [retardosPorAusencia]  por omisión 3
 * @property {number[]} [diasSemana]         día ISO de cada columna de `estados`
 * @property {string[]} [fechas]             alternativa a diasSemana
 * @property {number[]} [faltasGrupo]        faltas equivalentes de todo el grupo (para el z-score)
 * @property {number} [sesionesPorSemana]
 * @property {number} [semanaActual]
 */

/**
 * Puntaje de riesgo 0-100 de un alumno como suma de factores explicables, más nivel y acción sugerida.
 *
 * @param {{idAlumno?: number, matricula?: string, nombre?: string, estados: (string|null)[]}} alumno
 * @param {ContextoRiesgo} contexto
 */
export function evaluarRiesgoAlumno(alumno, contexto) {
    if (!alumno || !Array.isArray(alumno.estados)) {
        throw new TypeError('alumno.estados debe ser un arreglo de estados de asistencia.');
    }
    const limitePct = contexto.limitePct ?? 20;
    const rpa = contexto.retardosPorAusencia ?? 3;
    validarNumero(limitePct, 'limitePct');
    validarNumero(rpa, 'retardosPorAusencia');
    if (limitePct <= 0 || rpa < 1) {
        throw new RangeError('limitePct debe ser > 0 y retardosPorAusencia >= 1.');
    }
    const estados = alumno.estados;
    const res = resumirAsistencia(estados, rpa);
    const m = res.registradas;
    const prog = contexto.sesionesProgramadas > 0 ? contexto.sesionesProgramadas : Math.max(m, 1);
    const limiteFaltas = (limitePct * prog) / 100;
    const faltasMaximas = Math.floor(limiteFaltas + 1e-9);
    const superaLimite = res.faltasEq * 100 > limitePct * prog;
    const faltasRestantes = Math.max(0, faltasMaximas - res.faltasEq);
    const porcentajeFaltas = (res.faltasEq * 100) / prog;

    // Sesiones con registro, en orden, con su indicador de falta (retardo = fracción de falta).
    const registros = [];
    estados.forEach((e, i) => {
        if (e !== null && e !== undefined) {
            let dia = contexto.diasSemana?.[i] ?? null;
            if (dia === null && contexto.fechas?.[i]) {
                dia = diaSemanaISO(contexto.fechas[i]);
            }
            registros.push({ estado: e, dia, ind: e === 'ausente' ? 1 : (e === 'retardo' ? 1 / rpa : 0) });
        }
    });

    /** @type {FactorRiesgo[]} */
    const factores = [];

    // 1) Cercanía al límite: qué fracción del máximo permitido ya se consumió.
    const usado = porcentajeFaltas / limitePct;
    factores.push({
        id: 'distanciaLimite',
        nombre: 'Distancia al límite',
        valor: porcentajeFaltas,
        unidad: '% de faltas',
        aporte: redondear1(PESOS_RIESGO.distanciaLimite * Math.min(1, usado)),
        maximo: PESOS_RIESGO.distanciaLimite,
        explicacion: `Lleva ${res.faltasEq} falta(s) equivalente(s) (${porcentajeFaltas.toFixed(1)} %) de un límite de ${limitePct} %; ${superaLimite ? 'ya lo superó' : `le quedan ${faltasRestantes}`}.`,
    });

    // 2) Pendiente reciente de su tasa de faltas (últimas hasta 8 sesiones con registro).
    const ventana = registros.slice(-8);
    let pendiente = null;
    if (ventana.length >= 4) {
        pendiente = ajusteLineal(ventana.map((_, i) => i), ventana.map((r) => r.ind)).pendiente;
    }
    factores.push({
        id: 'pendienteReciente',
        nombre: 'Tendencia reciente de faltas',
        valor: pendiente === null ? null : pendiente * 100,
        unidad: 'puntos porcentuales por sesión',
        aporte: pendiente === null ? 0 : redondear1(PESOS_RIESGO.pendienteReciente * acotar(pendiente / 0.1, 0, 1)),
        maximo: PESOS_RIESGO.pendienteReciente,
        explicacion: pendiente === null
            ? 'Hay menos de 4 sesiones con registro: no se estima la tendencia.'
            : `La pendiente de su indicador de falta en las últimas ${ventana.length} sesiones es ${(pendiente * 100).toFixed(1)} puntos por sesión (${pendiente > 0.005 ? 'faltando más' : (pendiente < -0.005 ? 'mejorando' : 'estable')}).`,
    });

    // 3) Racha vigente de ausencias; las sesiones justificadas o pendientes no la cortan.
    let racha = 0;
    for (let i = registros.length - 1; i >= 0; i -= 1) {
        const e = registros[i].estado;
        if (e === 'ausente') {
            racha += 1;
        } else if (e !== 'justificado' && e !== 'pendiente') {
            break;
        }
    }
    factores.push({
        id: 'faltasConsecutivas',
        nombre: 'Faltas consecutivas',
        valor: racha,
        unidad: 'sesiones',
        aporte: redondear1(PESOS_RIESGO.faltasConsecutivas * Math.min(1, racha / 3)),
        maximo: PESOS_RIESGO.faltasConsecutivas,
        explicacion: racha === 0 ? 'No tiene una racha vigente de ausencias.' : `Acumula ${racha} ausencia(s) seguida(s) hasta la última sesión.`,
    });

    // 4) Concentración de ausencias en un mismo día de la semana (requiere >= 3 ausencias con día conocido).
    const porDia = new Map();
    let conDia = 0;
    for (const r of registros) {
        if (r.estado === 'ausente' && r.dia) {
            porDia.set(r.dia, (porDia.get(r.dia) ?? 0) + 1);
            conDia += 1;
        }
    }
    let diaTop = null;
    let participacion = null;
    if (conDia >= 3) {
        for (const [dia, c] of porDia) {
            if (diaTop === null || c > porDia.get(diaTop)) {
                diaTop = dia;
            }
        }
        participacion = porDia.get(diaTop) / conDia;
    }
    factores.push({
        id: 'concentracionDia',
        nombre: 'Concentración por día de la semana',
        valor: participacion === null ? null : participacion * 100,
        unidad: '% de sus ausencias en un mismo día',
        aporte: participacion === null ? 0 : redondear1(PESOS_RIESGO.concentracionDia * acotar((participacion - 0.5) / 0.5, 0, 1)),
        maximo: PESOS_RIESGO.concentracionDia,
        explicacion: participacion === null
            ? 'Tiene menos de 3 ausencias con día conocido: no se evalúa concentración.'
            : `${(participacion * 100).toFixed(0)} % de sus ausencias cae en ${NOMBRES_DIA[diaTop]}.`,
    });

    // 5) Proyección lineal del ritmo propio hasta el cierre del periodo.
    const ritmo = m > 0 ? res.faltasEq / m : 0;
    const pctProyectado = ritmo * 100;
    let sesionesParaCruce = null;
    let semanaCruceEstimada = null;
    if (superaLimite) {
        sesionesParaCruce = 0;
    } else if (ritmo > 0) {
        sesionesParaCruce = (limiteFaltas - res.faltasEq) / ritmo;
    }
    const cruzaEnPeriodo = superaLimite || (sesionesParaCruce !== null && m + sesionesParaCruce <= prog + 1e-9);
    if (cruzaEnPeriodo && !superaLimite && contexto.sesionesPorSemana > 0 && contexto.semanaActual > 0) {
        semanaCruceEstimada = contexto.semanaActual + Math.ceil(sesionesParaCruce / contexto.sesionesPorSemana - 1e-9);
    }
    factores.push({
        id: 'proyeccionCruce',
        nombre: 'Proyección al cruce del límite',
        valor: pctProyectado,
        unidad: '% de faltas proyectado al cierre',
        aporte: redondear1(PESOS_RIESGO.proyeccionCruce * acotar((pctProyectado / limitePct - 0.5) / 1, 0, 1)),
        maximo: PESOS_RIESGO.proyeccionCruce,
        explicacion: superaLimite
            ? 'Ya superó el límite de faltas.'
            : (ritmo === 0
                ? 'Sin faltas equivalentes: la proyección no cruza el límite.'
                : `Al ritmo actual cerraría con ${pctProyectado.toFixed(1)} % de faltas${cruzaEnPeriodo ? ` y cruzaría el límite en unas ${Math.ceil(sesionesParaCruce)} sesión(es)` : ' (no cruzaría el límite dentro del periodo)'}.`),
    });

    // 6) Comparación con el grupo mediante z-score de las faltas equivalentes.
    let z = null;
    if (Array.isArray(contexto.faltasGrupo) && contexto.faltasGrupo.length >= 3) {
        const sd = desviacion(contexto.faltasGrupo);
        z = sd > 0 ? (res.faltasEq - media(contexto.faltasGrupo)) / sd : 0;
    }
    factores.push({
        id: 'zScoreGrupo',
        nombre: 'Comparación con el grupo (z-score)',
        valor: z,
        unidad: 'desviaciones estándar',
        aporte: z === null ? 0 : redondear1(PESOS_RIESGO.zScoreGrupo * acotar(z / 2, 0, 1)),
        maximo: PESOS_RIESGO.zScoreGrupo,
        explicacion: z === null
            ? 'El grupo es demasiado pequeño para comparar.'
            : `Sus faltas equivalentes están ${z >= 0 ? 'por encima' : 'por debajo'} del promedio del grupo en ${Math.abs(z).toFixed(2)} desviaciones estándar.`,
    });

    // 7) Retardos acumulados: cada `rpa` retardos equivalen a una ausencia (RN-10).
    factores.push({
        id: 'retardosAcumulados',
        nombre: 'Retardos acumulados',
        valor: res.retardos,
        unidad: 'retardos',
        aporte: redondear1(PESOS_RIESGO.retardosAcumulados * Math.min(1, res.retardos / (2 * rpa))),
        maximo: PESOS_RIESGO.retardosAcumulados,
        explicacion: `${res.retardos} retardo(s); cada ${rpa} equivalen a una ausencia.`,
    });

    const puntaje = redondear1(factores.reduce((s, f) => s + f.aporte, 0));
    const nivel = superaLimite || puntaje >= 60 ? 'alto' : (puntaje >= 35 ? 'medio' : 'bajo');
    const dominante = factores.reduce((a, b) => (b.aporte / b.maximo > a.aporte / a.maximo ? b : a));
    const pistas = {
        faltasConsecutivas: ' Hay ausencias seguidas: confirmar si existe un problema de fondo (salud, transporte, trabajo).',
        concentracionDia: ' Sus ausencias se concentran en un día: revisar si coincide con otra obligación.',
        retardosAcumulados: ' Los retardos ya pesan: conversar sobre puntualidad.',
        pendienteReciente: ' Su asistencia empeora en las últimas sesiones: actuar pronto.',
    };
    let accion;
    if (superaLimite) {
        accion = 'Ya superó el límite de faltas: citar al alumno, revisar justificantes pendientes y avisar a la coordinación.';
    } else if (nivel === 'alto') {
        accion = 'Contactar al alumno esta semana y acordar un plan de asistencia; revisar si hay justificantes por registrar.';
    } else if (nivel === 'medio') {
        accion = 'Hablar con el alumno y dar seguimiento en las próximas sesiones.';
    } else {
        accion = 'Sin acción por ahora; mantener el seguimiento normal.';
    }
    if (nivel !== 'bajo' && pistas[dominante.id] && dominante.aporte > 0) {
        accion += pistas[dominante.id];
    }

    return {
        idAlumno: alumno.idAlumno ?? null,
        matricula: alumno.matricula ?? null,
        nombre: alumno.nombre ?? null,
        puntaje,
        nivel,
        factores,
        accion,
        ausentes: res.ausentes,
        retardos: res.retardos,
        faltasEq: res.faltasEq,
        faltasMaximas,
        faltasRestantes,
        porcentajeFaltas,
        superaLimite,
        sesionesParaCruce,
        semanaCruceEstimada,
        pasos: [
            {
                titulo: `Riesgo de ${alumno.nombre ?? 'alumno'}: ${puntaje} / 100 (${nivel})`,
                texto: 'El puntaje es la suma de los aportes de cada factor; ningún factor aporta más que su máximo.',
                tabla: {
                    columnas: ['factor', 'valor', 'unidad', 'aporte', 'máximo'],
                    filas: factores.map((f) => [f.nombre, f.valor === null ? null : Number(f.valor.toFixed(3)), f.unidad, f.aporte, f.maximo]),
                },
                valores: factores.map((f) => ({ etiqueta: f.nombre, valor: f.explicacion })),
            },
        ],
    };
}

/**
 * Evalúa a todo un grupo; calcula primero las faltas equivalentes de todos para el z-score.
 * Devuelve la lista ordenada de mayor a menor puntaje.
 *
 * @param {{idAlumno?: number, matricula?: string, nombre?: string, estados: (string|null)[]}[]} alumnos
 * @param {ContextoRiesgo} contexto
 */
export function evaluarRiesgoGrupo(alumnos, contexto) {
    if (!Array.isArray(alumnos)) {
        throw new TypeError('alumnos debe ser un arreglo.');
    }
    const rpa = contexto.retardosPorAusencia ?? 3;
    const faltasGrupo = alumnos.map((a) => resumirAsistencia(a.estados ?? [], rpa).faltasEq);
    return alumnos
        .map((a) => evaluarRiesgoAlumno({ ...a, estados: a.estados ?? [] }, { ...contexto, faltasGrupo }))
        .sort((a, b) => b.puntaje - a.puntaje || b.faltasEq - a.faltasEq || String(a.nombre).localeCompare(String(b.nombre), 'es'));
}
