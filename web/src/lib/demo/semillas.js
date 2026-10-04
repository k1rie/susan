// Semillas de los rostros sintéticos de la demostración (solo modo local, EMBEDDER=fake).
//
// El embedder 'fake' del servicio de reconocimiento (recognition-service/app/embedders/fake.py) no mira caras: una
// "cara" es un cuadrado con marco magenta de 4 px cuyo interior es un color plano, y ese color codifica una semilla
// de 12 bits (3 canales x 4 bits; cada canal vale 64 + 8*n con n en 0..15, así tolera la compresión JPEG). De la
// semilla sale el vector: la misma semilla da el mismo vector (score 1.000) y semillas distintas dan vectores casi
// ortogonales (score ~0.5).
//
// Este módulo es la ÚNICA fuente de qué semilla le toca a cada persona. Lo usan:
//   - scripts/demo/seed-demo.mjs: fotos de registro y recortes de la semilla de demostración;
//   - el simulador de cámara del navegador: dibuja a cada alumno con la misma semilla con la que se registró,
//     de modo que el servicio lo reconozca.
// Sin importaciones a propósito: el script de Node lo carga como módulo suelto (no existe el alias '@/' allí).

/** Semillas posibles del embedder fake (12 bits). */
export const TOTAL_SEMILLAS = 4096;

/** Semillas de alumnos: 0..2047, o sea canal R entre 64 y 120 (lejos del magenta del marco). */
export const SEMILLAS_ALUMNO = 2048;

/**
 * Semillas de personas ajenas (visitantes, alguien sin plantilla): 2048..3839, canal R entre 128 y 176. Se deja
 * fuera el último bloque de R (n = 15 -> 184) para que ningún interior pueda parecerse al magenta (R > 180, G < 80,
 * B > 180) con el que el detector reconoce el marco.
 */
export const SEMILLAS_EXTRANO = 1792;

const MULTIPLICADOR = 37; // impar: invertible módulo una potencia de 2, así la asignación nunca repite semillas
const DESPLAZAMIENTO = 11;

const comoEntero = (valor, nombre) => {
    if (!Number.isInteger(valor)) throw new TypeError(`${nombre} debe ser un entero.`);
    return valor;
};

/**
 * Semilla de un alumno. Determinista y sin colisiones para id_alumno 1..2048 (biyección módulo 2048): la misma
 * función corre al registrar la foto (script de la semilla) y al dibujar al alumno ante la cámara simulada.
 * @param {number} idAlumno alumno.id_alumno
 * @returns {number} 0..2047
 */
export function semillaDeAlumno(idAlumno) {
    const id = comoEntero(idAlumno, 'idAlumno');
    if (id < 1 || id > SEMILLAS_ALUMNO) throw new RangeError(`idAlumno debe estar entre 1 y ${SEMILLAS_ALUMNO}.`);
    return (id * MULTIPLICADOR + DESPLAZAMIENTO) % SEMILLAS_ALUMNO;
}

/**
 * Semilla de una persona ajena al grupo (rostro que el reconocimiento no debe atribuir a nadie).
 * @param {number} n ordinal del extraño, 0..1791
 * @returns {number} 2048..3839
 */
export function semillaDeExtrano(n) {
    const i = comoEntero(n, 'n');
    if (i < 0 || i >= SEMILLAS_EXTRANO) throw new RangeError(`n debe estar entre 0 y ${SEMILLAS_EXTRANO - 1}.`);
    return SEMILLAS_ALUMNO + ((i * MULTIPLICADOR + DESPLAZAMIENTO) % SEMILLAS_EXTRANO);
}

/** @returns {boolean} true si la semilla pertenece al rango reservado a alumnos. */
export const esSemillaDeAlumno = (semilla) => Number.isInteger(semilla) && semilla >= 0 && semilla < SEMILLAS_ALUMNO;

/**
 * Color RGB del interior de la cara (espejo de seed_to_color de fake.py).
 * @param {number} semilla 0..4095
 * @returns {[number, number, number]}
 */
export function colorDeSemilla(semilla) {
    const s = comoEntero(semilla, 'semilla');
    if (s < 0 || s >= TOTAL_SEMILLAS) throw new RangeError('La semilla debe estar en 0..4095.');
    return [64 + 8 * ((s >> 8) & 15), 64 + 8 * ((s >> 4) & 15), 64 + 8 * (s & 15)];
}

/**
 * Semilla que lee el detector de un color (espejo de color_to_seed de fake.py): cada canal se redondea al escalón
 * de 8 más cercano, por eso tolera el ruido de la compresión JPEG.
 * @param {ArrayLike<number>} rgb
 * @returns {number} 0..4095
 */
export function semillaDeColor(rgb) {
    const n = [0, 1, 2].map((i) => Math.min(15, Math.max(0, Math.round((Number(rgb[i]) - 64) / 8))));
    return (n[0] << 8) | (n[1] << 4) | n[2];
}
