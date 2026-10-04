import { formatoNumero, formatoPct, numeroOpcional, pct, resumenTexto, sumar } from '@/lib/graficas.js';

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

/** Datos del anillo: solo los registros resueltos (los pendientes de revisión aún no cuentan, Tabla 44). */
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

const plural = (n, uno, varios) => `${formatoNumero(n)} ${n === 1 ? uno : varios}`;
const entre = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Datos del medidor «Tu asistencia». Mide lo MISMO que el derecho a examen (RN-11): 100 % menos las faltas equivalentes sobre las
 * sesiones programadas, sumando las materias que tienen sesiones. Así la marca de mínimo (100 % menos el límite de faltas) se compara
 * con la medida correcta; el «asististe» del anillo (presentes y retardos entre los registros resueltos) es otra cosa y no sirve aquí:
 * un alumno con 67 % de «asististe» puede estar muy por encima del mínimo si sus ausencias son pocas frente a todo el periodo.
 *
 *   valor    = asistencia 0-100 con 1 decimal
 *   limite   = { valor, etiqueta } con la asistencia mínima (100 - limite_pct), solo si TODAS las materias que cuentan traen el mismo
 *              `limite_pct`; con límites distintos o ausentes es null y no se dibuja marca (no se inventa un número)
 *   tono     = el peor estado que dicta la base en cualquier materia: `supera_limite`/`derecho_examen === false` -> 'ausente';
 *              `en_limite` -> 'retardo'; si no, 'presente' (una materia perdida no puede verse verde por el promedio de las demás)
 *   descripcion = «N faltas equivalentes de M sesiones» y, con varias materias, cuántas están sobre el límite
 *
 * `null` si ninguna materia trae sesiones programadas y faltas equivalentes: sin base no hay nada que medir, y un 0 % o un 100 % sería
 * inventado.
 */
export function datosMedidorAsistencia(items = []) {
    const lista = items || [];
    const base = lista
        .map((it) => ({ sesiones: numeroOpcional(it.sesiones_programadas), faltas: numeroOpcional(it.faltas_equivalentes), limite: numeroOpcional(it.limite_pct) }))
        .filter((b) => b.sesiones !== null && b.sesiones > 0 && b.faltas !== null);
    if (!base.length) return null;

    const sesiones = base.reduce((a, b) => a + b.sesiones, 0);
    const faltas = base.reduce((a, b) => a + b.faltas, 0);
    const valor = Number(entre(100 - (faltas * 100) / sesiones, 0, 100).toFixed(1));

    const [primero] = base;
    const mismoLimite = base.every((b) => b.limite !== null && b.limite > 0 && b.limite < 100 && b.limite === primero.limite);
    const minimo = mismoLimite ? Number((100 - primero.limite).toFixed(2)) : null;

    const sobre = lista.filter((it) => it.supera_limite || it.derecho_examen === false).length;
    const tono = sobre > 0 ? 'ausente' : lista.some((it) => it.en_limite) ? 'retardo' : 'presente';

    let descripcion = `${plural(faltas, 'falta equivalente', 'faltas equivalentes')} de ${plural(sesiones, 'sesión', 'sesiones')}`;
    if (sobre > 0 && lista.length > 1) descripcion += ` · ${plural(sobre, 'materia', 'materias')} sobre el límite`;

    return {
        valor,
        faltas,
        sesiones,
        tono,
        limite: minimo === null ? null : { valor: minimo, etiqueta: `Mínimo ${formatoPct(minimo)}` },
        descripcion,
    };
}

/** Cómo se calcula el medidor (va plegado en «Cómo se calcula»). La frase de la marca solo aparece si el medidor la lleva. */
export function notaMedidor(medidor) {
    if (!medidor) return null;
    const base = 'Tu asistencia es 100 % menos tus faltas equivalentes sobre las sesiones programadas de todas tus materias; los retardos acumulados suman faltas y las justificadas y pendientes no cuentan.';
    return medidor.limite ? `${base} La marca de mínimo sale del límite de faltas.` : base;
}

/** Aclaración del anillo (plegada): qué cuenta «asististe» y que el derecho a examen se mide aparte. null sin registros resueltos. */
export function notaRegistros(t) {
    if (sumar(datosDonaAsistencia(t)) <= 0) return null;
    return `En el anillo, asististe (presente o retardo) en el ${porcentajeAsistieron(t)} % de los registros ya resueltos. El derecho a examen no se mide así, sino en faltas equivalentes.`;
}

/**
 * Filas para "Faltas frente al límite": una por materia con el % de faltas partido en tres series (dentro, en el límite y
 * sobre el límite) para que el color coincida con el de la BarraFaltas de su tarjeta; las series que no aplican van en null
 * (el texto de la fila no las lista). `en_limite` lo dicta la base (una falta más y pierde el derecho).
 * El nombre va completo: BarrasPildora lo parte en 2 líneas y trae el nombre entero en su title (y el texto alternativo lo lee entero).
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
            materia: base,
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

/** Texto alternativo de la gráfica de faltas. */
export function resumenFaltas({ filas, limite }) {
    if (!filas.length) return 'Sin materias.';
    // El estado va en el texto (no solo en el color) para quien no ve la gráfica; "dentro" no necesita aclaración.
    const estado = (f) => (f.sobre !== null ? ' (sobre el límite)' : f.enLimite !== null ? ' (en el límite)' : '');
    return `${filas.map((f) => `${f.materia}: ${String(f.valor).replace('.', ',')} % de faltas${estado(f)}`).join('; ')}. Límite: ${limite} %.`;
}

/** Texto alternativo del anillo de asistencia. */
export function resumenAsistencia(t) {
    const datos = datosDonaAsistencia(t);
    if (sumar(datos) <= 0) return 'Aún no hay registros de asistencia.';
    return `${resumenTexto(datos, {
        presente: { label: 'Presentes' },
        retardo: { label: 'Retardos' },
        ausente: { label: 'Ausencias' },
        justificado: { label: 'Justificadas' },
    })}. Asististe (presente o retardo) en el ${porcentajeAsistieron(t)} % de los registros ya resueltos.`;
}

/** Nota al pie del anillo sobre los registros que aún no cuentan; null si no hay ninguno. */
export function notaPendientes(n) {
    const k = num(n);
    if (k <= 0) return null;
    return k === 1
        ? '1 registro pendiente de revisión aún no cuenta.'
        : `${k} registros pendientes de revisión aún no cuentan.`;
}
