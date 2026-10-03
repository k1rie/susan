// Armado de datos para las gráficas del reporte (funciones puras, sin React). Los componentes solo pintan lo que sale de aquí.
// Las claves de estado coinciden con CONFIG_ASISTENCIA (presente, retardo, ausente, justificado, pendiente).

/** Límite de faltas (RN-11) cuando el reporte no lo trae. */
export const LIMITE_FALTAS_DEFECTO = 20;

/** Alumnos que se muestran en la gráfica de faltas y grupos en las gráficas del periodo. */
export const TOP_ALUMNOS = 8;
export const TOP_GRUPOS = 10;

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const hayDato = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));

/** Límite de faltas en % tomado de los datos del reporte (`limite_pct`); 20 si no existe o no es válido. */
export function limiteFaltas(reporte) {
    const n = Number(reporte?.limite_pct);
    return Number.isFinite(n) && n > 0 ? n : LIMITE_FALTAS_DEFECTO;
}

/** Asistencia mínima (%) que equivale al límite de faltas; null si el reporte no trae el límite (no se dibuja línea). */
export function umbralAsistencia(reporte) {
    const n = Number(reporte?.limite_pct);
    return Number.isFinite(n) && n > 0 && n < 100 ? Number((100 - n).toFixed(2)) : null;
}

/** Acorta un texto con puntos suspensivos (para etiquetas de eje). */
export function acortar(texto, max = 16) {
    const t = String(texto ?? '').trim();
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// Garantiza etiquetas distintas en un eje de categorías (dos "Ana Pérez" se pintarían como una sola barra).
// `extra(fila, orden)` aporta el desempate (matrícula, o el orden de aparición si no hay nada mejor).
function etiquetasUnicas(filas, extra) {
    const total = new Map();
    for (const f of filas) total.set(f.etiqueta, (total.get(f.etiqueta) || 0) + 1);
    const orden = new Map();
    return filas.map((f) => {
        if (total.get(f.etiqueta) < 2) return f.etiqueta;
        const n = (orden.get(f.etiqueta) || 0) + 1;
        orden.set(f.etiqueta, n);
        return `${f.etiqueta} (${extra(f, n)})`;
    });
}

/** Distribución agregada de estados sumando a los alumnos: siempre 5 entradas [{ clave, valor }] (la dona omite los ceros). */
export function distribucionAsistencia(items = []) {
    const suma = (campo) => (items || []).reduce((a, i) => a + num(i[campo]), 0);
    return [
        { clave: 'presente', valor: suma('presentes') },
        { clave: 'retardo', valor: suma('retardos') },
        { clave: 'ausente', valor: suma('ausencias') },
        { clave: 'justificado', valor: suma('justificadas') },
        { clave: 'pendiente', valor: suma('pendientes') },
    ];
}

/** Centro de la dona: la asistencia promedio del reporte redondeada; sin dato, undefined (la dona muestra el total). */
export function centroAsistencia(asistenciaPromedio) {
    if (!hayDato(asistenciaPromedio)) return undefined;
    return { valor: `${Math.round(Number(asistenciaPromedio))} %`, etiqueta: 'Asistencia' };
}

/**
 * Centro de la dona del resumen de grupo. La asistencia promedio es del GRUPO completo: con un alumno seleccionado la dona
 * grafica solo sus registros y esa cifra no le corresponde, así que no se pone (la dona muestra el total de registros).
 * Tampoco se pone sin sesiones programadas (no hay porcentaje que decir).
 */
export function centroDonaGrupo({ asistenciaPromedio, sinSesiones = false, deAlumno = false } = {}) {
    if (sinSesiones || deAlumno) return undefined;
    return centroAsistencia(asistenciaPromedio);
}

/** Etiqueta corta del alumno para el eje: primer nombre + apellido paterno (o el nombre completo si faltan). */
export function etiquetaAlumno(a) {
    const nombre = String(a?.nombres || '').trim().split(/\s+/)[0];
    const apellido = String(a?.apellido_paterno || '').trim();
    const corta = [nombre, apellido].filter(Boolean).join(' ') || String(a?.nombre_completo || a?.matricula || 'Alumno');
    return acortar(corta, 18);
}

/**
 * Los `n` alumnos con mayor porcentaje de faltas: [{ id_alumno, alumno, faltas, faltas_equivalentes }], de mayor a menor.
 * Ignora filas sin porcentaje (grupo sin sesiones). Desempata por faltas equivalentes y luego por nombre.
 */
export function topFaltasAlumnos(items = [], n = TOP_ALUMNOS) {
    const filas = (items || [])
        .filter((a) => hayDato(a.porcentaje_faltas))
        .map((a) => ({ id_alumno: a.id_alumno, matricula: a.matricula, etiqueta: etiquetaAlumno(a), faltas: Number(num(a.porcentaje_faltas).toFixed(2)), faltas_equivalentes: num(a.faltas_equivalentes) }))
        .sort((x, y) => y.faltas - x.faltas || y.faltas_equivalentes - x.faltas_equivalentes || x.etiqueta.localeCompare(y.etiqueta, 'es'))
        .slice(0, Math.max(0, n));
    const etiquetas = etiquetasUnicas(filas, (f) => f.matricula);
    return filas.map((f, i) => ({ id_alumno: f.id_alumno, alumno: etiquetas[i], faltas: f.faltas, faltas_equivalentes: f.faltas_equivalentes }));
}

/** Alumnos con porcentaje de faltas que quedan fuera del top (para el "y N más"). */
export function alumnosFueraDelTop(items = [], n = TOP_ALUMNOS) {
    const con = (items || []).filter((a) => hayDato(a.porcentaje_faltas)).length;
    return Math.max(0, con - Math.max(0, n));
}

/** Dominio del eje de faltas: siempre deja ver la línea del límite y el mayor valor, redondeado a múltiplo de 5. */
export function dominioFaltas(datos = [], limite = LIMITE_FALTAS_DEFECTO) {
    const mayor = Math.max(0, ...(datos || []).map((d) => num(d.faltas)));
    const tope = Math.max(mayor, limite * 1.25);
    return [0, Math.ceil(tope / 5) * 5];
}

// Etiqueta de grupo para el eje: "3A · Finanzas" acortada.
function etiquetaGrupo(g) {
    return acortar([g.clave_grupo, g.materia_nombre].filter(Boolean).join(' · '), 17);
}

/**
 * Asistencia promedio por grupo: [{ grupo, asistencia }]. Las peores primero (lo accionable arriba); solo grupos con dato
 * y, con muchos grupos, los `n` más bajos.
 */
export function serieAsistenciaGrupos(items = [], n = TOP_GRUPOS) {
    const filas = (items || [])
        .filter((g) => hayDato(g.asistencia_promedio))
        .map((g) => ({ etiqueta: etiquetaGrupo(g), clave: g.clave_grupo, asistencia: Number(num(g.asistencia_promedio).toFixed(2)) }))
        .sort((x, y) => x.asistencia - y.asistencia || x.etiqueta.localeCompare(y.etiqueta, 'es'))
        .slice(0, Math.max(0, n));
    const etiquetas = etiquetasUnicas(filas, (f, n) => n);
    return filas.map((f, i) => ({ grupo: etiquetas[i], asistencia: f.asistencia }));
}

/** Cuántos grupos tienen asistencia promedio (para avisar que la gráfica muestra solo una parte). */
export function gruposConAsistencia(items = []) {
    return (items || []).filter((g) => hayDato(g.asistencia_promedio)).length;
}

/**
 * Alumnos por situación en cada grupo: [{ grupo, regulares, enLimite, sinDerecho }]. Primero los grupos con más alumnos en riesgo.
 * `regulares` = inscritos que no están en el límite ni sin derecho (nunca negativo si los datos vinieran inconsistentes).
 */
export function estadoAlumnosPorGrupo(items = [], n = TOP_GRUPOS) {
    const filas = (items || [])
        .filter((g) => num(g.inscritos) > 0 || num(g.alumnos_en_limite) > 0 || num(g.alumnos_sin_derecho) > 0)
        .map((g) => {
            const enLimite = num(g.alumnos_en_limite);
            const sinDerecho = num(g.alumnos_sin_derecho);
            return { etiqueta: etiquetaGrupo(g), clave: g.clave_grupo, regulares: Math.max(0, num(g.inscritos) - enLimite - sinDerecho), enLimite, sinDerecho };
        })
        .sort((x, y) => (y.sinDerecho + y.enLimite) - (x.sinDerecho + x.enLimite) || y.sinDerecho - x.sinDerecho || x.etiqueta.localeCompare(y.etiqueta, 'es'))
        .slice(0, Math.max(0, n));
    const etiquetas = etiquetasUnicas(filas, (f, n) => n);
    return filas.map((f, i) => ({ grupo: etiquetas[i], regulares: f.regulares, enLimite: f.enLimite, sinDerecho: f.sinDerecho }));
}

/** Configuración de series de la gráfica apilada de situación (mismos colores que los estados de asistencia). */
export const CONFIG_SITUACION = {
    regulares: { label: 'Con derecho', color: 'var(--presente)' },
    enLimite: { label: 'En el límite', color: 'var(--retardo)' },
    sinDerecho: { label: 'Sin derecho', color: 'var(--ausente)' },
};

/**
 * Indicadores agregados del periodo a partir de las filas por grupo. La asistencia se pondera por inscritos
 * (un grupo grande pesa más que uno pequeño); null si ningún grupo tiene dato.
 */
export function indicadoresPeriodo(items = []) {
    const grupos = items || [];
    let inscritos = 0;
    let enLimite = 0;
    let sinDerecho = 0;
    let pesoAsistencia = 0;
    let sumaAsistencia = 0;
    for (const g of grupos) {
        inscritos += num(g.inscritos);
        enLimite += num(g.alumnos_en_limite);
        sinDerecho += num(g.alumnos_sin_derecho);
        if (hayDato(g.asistencia_promedio)) {
            // Un grupo sin inscritos aún cuenta con peso 1 para no ignorar su dato.
            const peso = Math.max(1, num(g.inscritos));
            pesoAsistencia += peso;
            sumaAsistencia += num(g.asistencia_promedio) * peso;
        }
    }
    return {
        grupos: grupos.length,
        inscritos,
        enLimite,
        sinDerecho,
        asistenciaPromedio: pesoAsistencia > 0 ? Number((sumaAsistencia / pesoAsistencia).toFixed(2)) : null,
    };
}

/** Texto alternativo para una gráfica de barras de una serie: "Ana Pérez: 24,5 %; Luis Gómez: 12 %". */
export function resumenSerie(datos = [], claveEtiqueta, claveValor, unidad = ' %') {
    return (datos || []).map((d) => `${d[claveEtiqueta]}: ${d[claveValor]}${unidad}`).join('; ');
}

/** Texto alternativo de la gráfica apilada de situación por grupo. */
export function resumenSituacionGrupos(datos = []) {
    return (datos || [])
        .map((d) => `${d.grupo}: ${d.regulares} con derecho, ${d.enLimite} en el límite, ${d.sinDerecho} sin derecho`)
        .join('; ');
}
