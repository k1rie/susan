import { diaSemanaISO } from '../risk/riesgo.js';

const esNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Días enteros desde 1970-01-01 de una fecha 'YYYY-MM-DD' (null si es inválida). */
export function diasDesdeEpoch(fecha) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha));
    if (!m) {
        return null;
    }
    return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000);
}

/**
 * Normaliza la serie del grupo (arreglo de sesiones, o un objeto con `sesiones`/`items`) descartando
 * sesiones sin fecha válida o con inscritos no positivos. Ordena por fecha.
 *
 * @param {unknown} serie
 * @returns {{sesiones: {fecha: string, dias: number, dia: number, lunes: number, inscritos: number, ausentes: number, retardos: number}[], descartadas: number}}
 */
export function normalizarSesiones(serie) {
    let lista = [];
    if (Array.isArray(serie)) {
        lista = serie;
    } else if (serie && Array.isArray(serie.sesiones)) {
        lista = serie.sesiones;
    } else if (serie && Array.isArray(serie.items)) {
        lista = serie.items;
    }
    const sesiones = [];
    let descartadas = 0;
    for (const s of lista) {
        const dias = s ? diasDesdeEpoch(s.fecha) : null;
        const inscritos = s?.inscritos;
        if (dias === null || !esNum(inscritos) || inscritos <= 0) {
            descartadas += 1;
            continue;
        }
        const dia = Number.isInteger(s.dia_semana) && s.dia_semana >= 1 && s.dia_semana <= 7 ? s.dia_semana : diaSemanaISO(s.fecha);
        sesiones.push({
            fecha: String(s.fecha).slice(0, 10),
            dias,
            dia,
            lunes: dias - (dia - 1),
            inscritos,
            ausentes: esNum(s.ausentes) ? s.ausentes : 0,
            retardos: esNum(s.retardos) ? s.retardos : 0,
        });
    }
    sesiones.sort((a, b) => a.dias - b.dias);
    return { sesiones, descartadas };
}

/**
 * Agrupa por semana relativa (1 = semana de la primera sesión; las semanas sin sesiones quedan con tasa null).
 *   tasa_semana = Σ ausentes / Σ inscritos
 *   acumuladoPct = 100 · Σ_{sesiones hasta la semana} (ausentes + retardos/rpa)/inscritos / sesionesProgramadas
 * (promedio por alumno de faltas equivalentes acumuladas, como % de las sesiones programadas).
 *
 * @param {ReturnType<typeof normalizarSesiones>['sesiones']} sesiones
 * @param {{rpa: number, sesionesProgramadas: number}} opciones
 */
export function agruparSemanas(sesiones, { rpa, sesionesProgramadas }) {
    if (sesiones.length === 0) {
        return [];
    }
    const lunes0 = sesiones[0].lunes;
    const total = Math.round((sesiones[sesiones.length - 1].lunes - lunes0) / 7) + 1;
    const semanas = Array.from({ length: total }, (_, i) => ({
        semana: i + 1, sesiones: 0, inscritos: 0, ausentes: 0, retardos: 0, faltaEqProm: 0, tasa: null, acumuladoPct: 0,
    }));
    for (const s of sesiones) {
        const w = semanas[Math.round((s.lunes - lunes0) / 7)];
        w.sesiones += 1;
        w.inscritos += s.inscritos;
        w.ausentes += s.ausentes;
        w.retardos += s.retardos;
        w.faltaEqProm += (s.ausentes + s.retardos / rpa) / s.inscritos;
    }
    let acum = 0;
    for (const w of semanas) {
        if (w.sesiones > 0) {
            w.tasa = w.ausentes / w.inscritos;
        }
        acum += w.faltaEqProm;
        w.acumuladoPct = (100 * acum) / sesionesProgramadas;
    }
    return semanas;
}

/**
 * Patrón por día de la semana: tasa = Σ ausentes / Σ inscritos de las sesiones de ese día.
 * El día crítico es el de mayor tasa (> 0) cuando hay al menos dos días con datos.
 */
export function patronPorDia(sesiones) {
    const nombres = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const acc = new Map();
    for (const s of sesiones) {
        const a = acc.get(s.dia) ?? { sesiones: 0, inscritos: 0, ausentes: 0 };
        a.sesiones += 1;
        a.inscritos += s.inscritos;
        a.ausentes += s.ausentes;
        acc.set(s.dia, a);
    }
    const dias = [...acc.keys()].sort((a, b) => a - b).map((dia) => {
        const a = acc.get(dia);
        return { dia, nombre: nombres[dia], sesiones: a.sesiones, ausentes: a.ausentes, tasa: a.ausentes / a.inscritos, critico: false };
    });
    let diaCritico = null;
    if (dias.length >= 2) {
        const top = dias.reduce((a, b) => (b.tasa > a.tasa ? b : a));
        if (top.tasa > 0) {
            top.critico = true;
            diaCritico = top.dia;
        }
    }
    return { dias, diaCritico, nombreDiaCritico: diaCritico ? nombres[diaCritico] : null };
}
