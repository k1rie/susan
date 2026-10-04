// Lista de ordinales de la línea de comandos del simulador de cámara (scripts/demo/captura.mjs): '1-18,20' -> [1..18, 20].
// Pura y sin importaciones (la carga el script de Node como módulo suelto).

/**
 * @param {string} texto trozos separados por coma; cada trozo es 'n' o 'a-b' (a <= b)
 * @param {number} maximo el mayor ordinal permitido (el tamaño del grupo)
 * @returns {number[]} ordinales sin repetir y en orden ascendente
 * @throws {RangeError} formato inválido o ordinal fuera de 1..maximo
 */
export function ordinalesDeLista(texto, maximo) {
    const salida = new Set();
    for (const trozo of String(texto).split(',')) {
        const m = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(trozo);
        if (!m) throw new RangeError(`Lista de alumnos no válida: '${texto}' (ejemplo: 1-18,20).`);
        const desde = Number(m[1]);
        const hasta = m[2] === undefined ? desde : Number(m[2]);
        if (desde < 1 || hasta < desde || hasta > maximo) {
            throw new RangeError(`Los ordinales deben estar entre 1 y ${maximo} (recibí ${trozo.trim()}).`);
        }
        for (let o = desde; o <= hasta; o += 1) salida.add(o);
    }
    return [...salida].sort((a, b) => a - b);
}
