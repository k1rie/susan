// Funciones puras del calendario de asistencia (sin DOM). Las fechas son «YYYY-MM-DD» y se calculan en UTC: así una sesión del 14 de
// septiembre cae siempre en el 14, sin importar la zona horaria de quien mira la pantalla.

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;
const DIA_MS = 86400000;

// De más a menos grave: cuando dos sesiones caen el mismo día, la casilla muestra la más grave (no esconde una falta).
const GRAVEDAD = ['ausente', 'retardo', 'pendiente', 'sin_registro', 'justificado', 'presente'];

const FORMATO_MES = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' });
const FORMATO_DIA = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Milisegundos UTC de una fecha «YYYY-MM-DD» (o ISO que empiece así); null si no es una fecha real (2026-02-31 también es null). */
export function parseFecha(texto) {
    const m = RE_FECHA.exec(String(texto ?? ''));
    if (!m) return null;
    const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const t = Date.UTC(anio, mes - 1, dia);
    const d = new Date(t);
    return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia ? t : null;
}

/** 0 = lunes … 6 = domingo. */
export function diaSemana(t) {
    return (new Date(t).getUTCDay() + 6) % 7;
}

export function isoDe(t) {
    return new Date(t).toISOString().slice(0, 10);
}

/** «sep», «oct»… (sin el punto que algunos entornos agregan). */
export function mesCorto(t) {
    return FORMATO_MES.format(new Date(t)).replace('.', '');
}

/** «lun, 14 sep» para el title de una casilla. */
export function diaLargo(t) {
    return FORMATO_DIA.format(new Date(t)).replace(/\./g, '');
}

/**
 * Clave de estado de una sesión: presente | retardo | ausente | justificado | pendiente | sin_registro | suspendida.
 * `estado` null = sin registro; una sesión suspendida no cuenta como falta ni como asistencia.
 */
export function claveEstado(sesion) {
    if (sesion?.estatus === 'suspendida' || sesion?.estatus_sesion === 'suspendida') return 'suspendida';
    const e = sesion?.estado;
    if (e === 'presente' || e === 'retardo' || e === 'ausente' || e === 'justificado' || e === 'pendiente') return e;
    return 'sin_registro';
}

function masGrave(a, b) {
    const ia = GRAVEDAD.indexOf(a);
    const ib = GRAVEDAD.indexOf(b);
    if (ia === -1) return b;
    if (ib === -1) return a;
    return ia <= ib ? a : b;
}

function normalizar(sesiones) {
    const porDia = new Map();
    for (const s of Array.isArray(sesiones) ? sesiones : []) {
        const t = parseFecha(s?.fecha);
        if (t === null) continue;
        const clave = claveEstado(s);
        porDia.set(t, porDia.has(t) ? masGrave(porDia.get(t), clave) : clave);
    }
    return porDia;
}

/**
 * Cuadrícula tipo calendario de contribuciones: columnas = semanas (de lunes a domingo), filas = días de la semana.
 * `sesiones` = [{ fecha, estado, estatus? }]. Devuelve:
 *   semanas: [{ dias: [{ t, fecha, clave | null }] }]  (clave null = ese día no hubo sesión)
 *   filas:   índices de día visibles (0-4, y sábado/domingo solo si alguna sesión cae en ellos)
 *   meses:   [{ semana, etiqueta }]  (primer lunes de cada mes; si dos etiquetas quedarían pegadas, gana la del mes siguiente)
 *   total:   sesiones dibujadas · recortado: true si hubo más de `maxSemanas` y se muestran las más recientes
 */
export function construirCalendario(sesiones, { maxSemanas = 26 } = {}) {
    const porDia = normalizar(sesiones);
    if (porDia.size === 0) return { semanas: [], filas: [], meses: [], total: 0, recortado: false };
    const tiempos = [...porDia.keys()];
    const min = Math.min(...tiempos);
    const max = Math.max(...tiempos);
    let inicio = min - diaSemana(min) * DIA_MS;
    const fin = max + (6 - diaSemana(max)) * DIA_MS;
    let numSemanas = Math.round((fin - inicio) / DIA_MS + 1) / 7;
    let recortado = false;
    if (numSemanas > maxSemanas) {
        numSemanas = maxSemanas;
        inicio = fin - (maxSemanas * 7 - 1) * DIA_MS;
        recortado = true;
    }
    const semanas = [];
    let total = 0;
    let finSabado = false;
    let finDomingo = false;
    for (let w = 0; w < numSemanas; w += 1) {
        const dias = [];
        for (let d = 0; d < 7; d += 1) {
            const t = inicio + (w * 7 + d) * DIA_MS;
            const clave = porDia.get(t) ?? null;
            if (clave) {
                total += 1;
                if (d === 5) finSabado = true;
                if (d === 6) finDomingo = true;
            }
            dias.push({ t, fecha: isoDe(t), clave });
        }
        semanas.push({ dias });
    }
    const filas = finDomingo ? [0, 1, 2, 3, 4, 5, 6] : finSabado ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4];
    const meses = [];
    let ultimoMes = null;
    let ultimaSemana = -10;
    semanas.forEach((semana, w) => {
        const t = semana.dias[0].t;
        const mes = new Date(t).getUTCMonth();
        if (mes !== ultimoMes) {
            ultimoMes = mes;
            // Con menos de 3 columnas de separación las etiquetas se pisarían: el mes que apenas ocupa 1 o 2 columnas cede su
            // etiqueta al siguiente (el calendario se lee mejor con el mes que domina la cuadrícula).
            if (meses.length && w - ultimaSemana < 3) meses.pop();
            meses.push({ semana: w, etiqueta: mesCorto(t) });
            ultimaSemana = w;
        }
    });
    return { semanas, filas, meses, total, recortado };
}

/** Cuántas sesiones hay de cada estado (solo las que se dibujan): { presente: 17, ausente: 2, … }. */
export function contarEstados(sesiones) {
    const cuenta = {};
    for (const clave of normalizar(sesiones).values()) cuenta[clave] = (cuenta[clave] ?? 0) + 1;
    return cuenta;
}

/**
 * Racha de asistencia: sesiones seguidas con asistencia (presente o retardo), contando hacia atrás desde la más reciente (`actual`) y
 * la mejor de todo el periodo (`mejor`). Una falta (ausente, o cerrada sin registro) corta la racha; justificadas, pendientes,
 * suspendidas y sesiones abiertas sin registro ni cuentan ni cortan. Si la sesión no trae estatus se supone cerrada.
 */
export function rachaAsistencia(sesiones) {
    const filas = [];
    for (const s of Array.isArray(sesiones) ? sesiones : []) {
        const t = parseFecha(s?.fecha);
        if (t === null) continue;
        const clave = claveEstado(s);
        const cerrada = (s?.estatus ?? s?.estatus_sesion) === 'cerrada' || (s?.estatus ?? s?.estatus_sesion) === undefined;
        let tipo = 'neutral';
        if (clave === 'presente' || clave === 'retardo') tipo = 'asistio';
        else if (clave === 'ausente' || (clave === 'sin_registro' && cerrada)) tipo = 'falto';
        filas.push({ t, tipo });
    }
    filas.sort((a, b) => a.t - b.t);
    let actual = 0;
    let corrida = 0;
    let mejor = 0;
    for (const f of filas) {
        if (f.tipo === 'asistio') {
            corrida += 1;
            if (corrida > mejor) mejor = corrida;
        } else if (f.tipo === 'falto') {
            corrida = 0;
        }
    }
    for (let i = filas.length - 1; i >= 0; i -= 1) {
        if (filas[i].tipo === 'neutral') continue;
        if (filas[i].tipo === 'falto') break;
        actual += 1;
    }
    return { actual, mejor };
}
