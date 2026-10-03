import { pct, resumenTexto, sumar } from '@/lib/graficas.js';

// Datos de las gráficas del portal del alumno. Solo presentación: las reglas (faltas equivalentes, límite, derecho a examen)
// las dicta la base; aquí únicamente se agrupan las cifras que ya trae `api_alumno_resumen`.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Suma los estados de todas las materias del resumen. */
export function totalesAsistencia(items = []) {
    const t = { presentes: 0, retardos: 0, ausencias: 0, justificadas: 0, pendientes: 0 };
    for (const it of items || []) {
        t.presentes += num(it.presentes);
        t.retardos += num(it.retardos);
        t.ausencias += num(it.ausencias);
        t.justificadas += num(it.justificadas);
        t.pendientes += num(it.pendientes);
    }
    return t;
}

/** Datos de la dona: solo los registros resueltos (los pendientes de revisión aún no cuentan, Tabla 44). */
export function datosDonaAsistencia(t) {
    return [
        { clave: 'presente', valor: t.presentes },
        { clave: 'retardo', valor: t.retardos },
        { clave: 'ausente', valor: t.ausencias },
        { clave: 'justificado', valor: t.justificadas },
    ];
}

/**
 * Porcentaje de registros resueltos en los que el alumno estuvo en el aula (presente o retardo). NO es el criterio de derecho
 * a examen: ese lo calcula la base con faltas equivalentes (los retardos también suman) y llega en `supera_limite` /
 * `en_limite`. Las justificadas no cuentan como "asistieron" (fue una ausencia con justificante). 0 si no hay registros.
 */
export function porcentajeAsistieron(t) {
    const total = sumar(datosDonaAsistencia(t));
    return pct(t.presentes + t.retardos, total, 0);
}

/** Aclaración al pie de la dona: qué cuenta "Asistieron" y que el derecho a examen se mide aparte. */
export const NOTA_ASISTIERON = 'Asistieron: presentes y retardos. El derecho a examen se mide en faltas equivalentes.';

const MAX_NOMBRE = 18;
const recortar = (s) => (s.length > MAX_NOMBRE ? `${s.slice(0, MAX_NOMBRE - 1)}…` : s);

/**
 * Filas para "Faltas frente al límite": una por materia con el % de faltas partido en tres series (dentro, en el límite y
 * sobre el límite) para que el color coincida con el de la BarraFaltas de su tarjeta; las series que no aplican van en null
 * (el tooltip no las lista). `en_limite` lo dicta la base (una falta más y pierde el derecho).
 * Si dos materias se llaman igual se añade la clave del grupo para que no se mezclen en el eje.
 * `limite` (la línea de referencia) es el mayor `limite_pct` de las materias: hoy es 20 % para todas.
 */
export function datosFaltasPorMateria(items = []) {
    const nombres = (items || []).map((it) => it.materia?.nombre || 'Materia');
    const repetidos = new Set(nombres.filter((n, i) => nombres.indexOf(n) !== i));
    const filas = (items || []).map((it, i) => {
        const base = repetidos.has(nombres[i]) ? `${nombres[i]} (${it.clave_grupo ?? it.id_grupo})` : nombres[i];
        const valor = Number(num(it.porcentaje_faltas).toFixed(2));
        const limitePct = num(it.limite_pct) || 20;
        const sobre = Boolean(it.supera_limite) || valor > limitePct;
        const enLimite = !sobre && Boolean(it.en_limite);
        return {
            materia: recortar(base),
            dentro: sobre || enLimite ? null : valor,
            enLimite: enLimite ? valor : null,
            sobre: sobre ? valor : null,
            valor,
        };
    });
    const limite = Math.max(0, ...(items || []).map((it) => num(it.limite_pct))) || 20;
    const maximo = Math.max(0, ...filas.map((f) => f.valor));
    return { filas, limite, dominio: [0, Math.max(Math.ceil(limite * 1.5), Math.ceil(maximo))] };
}

export const CONFIG_FALTAS = {
    dentro: { label: 'Dentro del límite', color: 'var(--presente)' },
    enLimite: { label: 'En el límite', color: 'var(--retardo)' },
    sobre: { label: 'Sobre el límite', color: 'var(--ausente)' },
};

/** Solo las series que tienen alguna barra (la leyenda no lista estados vacíos); siempre al menos "dentro". */
export function seriesFaltas(filas = []) {
    const usadas = ['dentro', 'enLimite', 'sobre'].filter((clave) => filas.some((f) => f[clave] !== null && f[clave] !== undefined));
    return (usadas.length ? usadas : ['dentro']).map((clave) => ({ clave }));
}

/** Alto de la gráfica de barras según el número de materias (≈ 44 px por barra). */
export const altoFaltas = (n) => Math.min(360, Math.max(180, 64 + n * 44));

/** Texto alternativo de la gráfica de faltas. */
export function resumenFaltas({ filas, limite }) {
    if (!filas.length) return 'Sin materias.';
    // El estado va en el texto (no solo en el color) para quien no ve la gráfica; "dentro" no necesita aclaración.
    const estado = (f) => (f.sobre !== null ? ' (sobre el límite)' : f.enLimite !== null ? ' (en el límite)' : '');
    return `${filas.map((f) => `${f.materia}: ${String(f.valor).replace('.', ',')} % de faltas${estado(f)}`).join('; ')}. Límite: ${limite} %.`;
}

/** Texto alternativo de la dona de asistencia. */
export function resumenAsistencia(t) {
    const datos = datosDonaAsistencia(t);
    if (sumar(datos) <= 0) return 'Aún no hay registros de asistencia.';
    return `${resumenTexto(datos, {
        presente: { label: 'Presentes' },
        retardo: { label: 'Retardos' },
        ausente: { label: 'Ausencias' },
        justificado: { label: 'Justificadas' },
    })}. Asistieron: ${porcentajeAsistieron(t)} %.`;
}

/** Nota al pie de la dona sobre los registros que aún no cuentan; null si no hay ninguno. */
export function notaPendientes(n) {
    const k = num(n);
    if (k <= 0) return null;
    return k === 1
        ? '1 registro pendiente de revisión aún no cuenta.'
        : `${k} registros pendientes de revisión aún no cuentan.`;
}
