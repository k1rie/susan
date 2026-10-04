// Utilidades de las lecturas de un caso (detecciones atribuidas al alumno).

/** Un recorte purgado (RNF-05) no tiene URL ni disponibilidad: se conserva score y hora. */
export function recortePurgado(lectura) {
    return !lectura?.recorte_disponible && !lectura?.recorte?.url;
}

export function textoScore(score) {
    if (score == null) return '-';
    const n = Number(score);
    return Number.isFinite(n) ? n.toFixed(3) : '-';
}

export function textoCamara(posicion) {
    if (posicion === 'frente') return 'Cámara frontal';
    if (posicion === 'fondo') return 'Cámara de fondo';
    return 'Cámara';
}

/** Resumen «Lecturas válidas: x/min». El mínimo viene del servidor. */
export function resumenValidas(lecturas, minimo) {
    const validas = (lecturas ?? []).filter((l) => l.es_valida).length;
    return minimo ? `Lecturas válidas: ${validas}/${minimo}` : `Lecturas válidas: ${validas}`;
}

// Colores de la gráfica de scores: válida / no válida (tokens de asistencia, nunca solo color: el tooltip y el resumen dicen el texto).
export const CONFIG_SCORES = {
    valida: { label: 'Válida', color: 'var(--presente)' },
    no_valida: { label: 'No válida', color: 'var(--ausente)' },
};

// Tope de columnas de «Score por lectura»: a 360 px (tarjeta de ~245 px de ancho útil) caben 12 con su número de lectura de 2 dígitos
// completo y sus cifras; con 20 los números de 10 en adelante se cortaban en «1.», ilegibles. La lista de abajo trae todas las lecturas.
export const MAX_BARRAS_SCORE = 12;

// Number(null) es 0: una lectura sin score no se grafica como 0 %.
const tieneScore = (l) => l.score_similitud != null && Number.isFinite(Number(l.score_similitud));

const instante = (l) => {
    const t = new Date(l?.marca_tiempo).getTime();
    return Number.isFinite(t) ? t : 0;
};

/**
 * Lecturas en orden cronológico con su número (1 = la primera de la sesión). El servidor las entrega con las válidas primero
 * (migración 0122): la lista y la gráfica usan este mismo orden y número para que «lectura 3» sea la misma en ambas.
 */
export function lecturasNumeradas(lecturas) {
    return (Array.isArray(lecturas) ? lecturas : [])
        .map((l, i) => ({ l, i }))
        // Misma hora: se conserva el orden de llegada para que el número sea estable entre renders.
        .sort((x, y) => instante(x.l) - instante(y.l) || x.i - y.i)
        .map(({ l }, i) => ({ ...l, numero: i + 1 }));
}

/**
 * Datos de «Score por lectura»: una barra por lectura en orden cronológico (las más recientes si hay más de `max`), con el
 * score como porcentaje. La etiqueta del eje es el número de lectura que lleva la tarjeta de la lista (se conserva aunque
 * alguna lectura no tenga score y no se grafique). La barra va en la serie `valida` o `no_valida` según corresponda.
 */
export function datosScores(lecturas, max = MAX_BARRAS_SCORE) {
    return (
        lecturasNumeradas(lecturas)
            .filter(tieneScore)
            .slice(-max)
            .map((l) => {
                const valor = Math.min(100, Math.max(0, Math.round(Number(l.score_similitud) * 100)));
                return { lectura: String(l.numero), [l.es_valida ? 'valida' : 'no_valida']: valor };
            })
    );
}

/** Cuántas lecturas se pueden graficar (tienen score): con más que `max` la gráfica solo muestra las más recientes y hay que decirlo. */
export function contarConScore(lecturas) {
    return lecturasNumeradas(lecturas).filter(tieneScore).length;
}

/** Texto alternativo de la gráfica de scores. */
export function resumenScores(datos) {
    if (!datos.length) return 'Sin lecturas para graficar.';
    const filas = datos.map((d) => `lectura ${d.lectura}: ${d.valida ?? d.no_valida} % (${d.valida != null ? 'válida' : 'no válida'})`);
    return `Score de similitud por lectura, ${filas.join('; ')}.`;
}

/** Avance hacia el mínimo de lecturas válidas (RN-03): ancho de barra 0-100 y si ya se cumple. */
export function progresoValidas(lecturas, minimo) {
    const validas = (lecturas ?? []).filter((l) => l.es_valida).length;
    const min = Number(minimo);
    if (!Number.isFinite(min) || min <= 0) return { validas, minimo: null, ancho: 0, cumple: false };
    return { validas, minimo: min, ancho: Math.min(100, (validas / min) * 100), cumple: validas >= min };
}
