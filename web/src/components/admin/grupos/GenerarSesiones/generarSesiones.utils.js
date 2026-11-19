// Validación de los datos de "Generar sesiones" (el servidor aplica las reglas de fondo).
export const MAX_DIAS_RANGO = 366;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** true si la cadena AAAA-MM-DD es una fecha real. */
export function esFechaValida(s) {
    if (!FECHA_RE.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Texto libre (comas, espacios o saltos de línea) -> { fechas únicas ordenadas, invalidas }. */
export function parsearFechasOmitir(texto) {
    const piezas = String(texto ?? '').split(/[\s,;]+/).filter(Boolean);
    const fechas = [];
    const invalidas = [];
    for (const p of piezas) {
        if (!esFechaValida(p)) invalidas.push(p);
        else if (!fechas.includes(p)) fechas.push(p);
    }
    return { fechas: fechas.sort(), invalidas };
}

export function validarGeneracion({ desde, hasta, omitir }) {
    const e = {};
    if (!esFechaValida(desde)) e.desde = 'Indica la fecha inicial.';
    if (!esFechaValida(hasta)) e.hasta = 'Indica la fecha final.';
    if (!e.desde && !e.hasta) {
        if (hasta < desde) e.hasta = 'La fecha final no puede ser anterior a la inicial.';
        else {
            const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000 + 1;
            if (dias > MAX_DIAS_RANGO) e.hasta = `El rango no puede pasar de ${MAX_DIAS_RANGO} días.`;
        }
    }
    const { fechas, invalidas } = parsearFechasOmitir(omitir);
    if (invalidas.length) e.omitir = `Fechas no válidas (usa AAAA-MM-DD): ${invalidas.join(', ')}.`;
    return { errores: e, omitirFechas: fechas, valido: Object.keys(e).length === 0 };
}

const MS_DIA = 86400000;

/** Atajos de rango para el generador: «Próximas N semanas» desde el inicio ya elegido (o desde hoy). Sin calendario de periodos, solo relativos. */
export const ATAJOS_SESIONES = [2, 4, 8, 16].map((semanas) => ({
    label: semanas === 16 ? '16 semanas (un semestre)' : `${semanas} semanas`,
    valor: ({ actual, hoy }) => {
        const desde = esFechaValida(actual?.desde) ? actual.desde : hoy;
        const fin = new Date(Date.parse(`${desde}T00:00:00Z`) + (semanas * 7 - 1) * MS_DIA);
        return { desde, hasta: fin.toISOString().slice(0, 10) };
    },
}));

/** Día de la semana de una fecha AAAA-MM-DD en el formato del horario: 1 = lunes … 6 = sábado, 7 = domingo. */
export function diaSemanaDe(fecha) {
    const d = new Date(`${fecha}T00:00:00Z`).getUTCDay();
    return d === 0 ? 7 : d;
}

/**
 * Cuántas sesiones saldrían del horario entre dos fechas (ambas incluidas), restando las fechas a omitir. Cada bloque del horario es una
 * sesión por cada fecha que cae en su día; las que ya existan en el servidor se omiten allá, así que es un máximo.
 * @returns {{ total: number, sinOmitir: number, porFechas: number, dias: number[] }}
 */
export function contarSesiones({ horario = [], desde, hasta, omitir = [] }) {
    const porDia = {};
    for (const b of horario) porDia[Number(b.dia_semana)] = (porDia[Number(b.dia_semana)] ?? 0) + 1;
    const dias = Object.keys(porDia).map(Number).sort((a, b) => a - b);
    if (!esFechaValida(desde) || !esFechaValida(hasta) || hasta < desde) return { total: 0, sinOmitir: 0, porFechas: 0, dias };
    const inicio = Date.parse(`${desde}T00:00:00Z`);
    const largo = Math.round((Date.parse(`${hasta}T00:00:00Z`) - inicio) / MS_DIA) + 1;
    let sinOmitir = 0;
    for (let i = 0; i < Math.min(largo, MAX_DIAS_RANGO + 1); i += 1) {
        sinOmitir += porDia[diaSemanaDe(new Date(inicio + i * MS_DIA).toISOString().slice(0, 10))] ?? 0;
    }
    let porFechas = 0;
    for (const f of new Set(omitir)) {
        if (esFechaValida(f) && f >= desde && f <= hasta) porFechas += porDia[diaSemanaDe(f)] ?? 0;
    }
    return { total: Math.max(sinOmitir - porFechas, 0), sinOmitir, porFechas, dias };
}

/** Agrega una fecha a la lista de omitidas: sin repetidas, ordenada y solo fechas reales. */
export function agregarFechaOmitida(lista, fecha) {
    if (!esFechaValida(fecha) || lista.includes(fecha)) return lista;
    return [...lista, fecha].sort();
}
