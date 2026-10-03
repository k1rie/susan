// Utilidades de las lecturas de un caso (detecciones atribuidas al alumno).

/** Un recorte purgado (RNF-05) no tiene URL ni disponibilidad: se conserva score y hora. */
export function recortePurgado(lectura) {
    return !lectura?.recorte_disponible && !lectura?.recorte?.url;
}

export function textoScore(score) {
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
