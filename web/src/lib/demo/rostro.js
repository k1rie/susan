// Geometría del rostro sintético que reconoce el embedder 'fake' (solo demostración local).
//
// El detector de recognition-service/app/embedders/fake.py busca un componente de píxeles magenta (marco) de al menos
// 24 px de lado y lee el color del centro; este módulo describe cómo dibujarlo, sin tocar el DOM, para que el simulador
// de cámara (canvas) y los scripts de la semilla (Python/Pillow) produzcan exactamente la misma figura.
import { colorDeSemilla } from './semillas.js';

/** Color del marco: el detector lo busca con R > 180, G < 80, B > 180. */
export const COLOR_MARCO = Object.freeze([255, 0, 255]);

/** Grosor del marco en píxeles. */
export const GROSOR_MARCO = 4;

/** Lado mínimo (px) con el que el detector considera un cuadrado como cara; por debajo es ruido. */
export const LADO_MINIMO = 24;

/** Lado mínimo (px) que exige la verificación de la foto de registro (RF-15, min_face_px del servicio). */
export const LADO_MINIMO_REGISTRO = 80;

/**
 * Rectángulos a pintar, en orden: primero el cuadrado magenta completo y encima el interior con el color de la semilla.
 * @param {number} semilla 0..4095 (semillaDeAlumno / semillaDeExtrano)
 * @param {{ x: number, y: number, lado: number }} caja esquina superior izquierda y lado en píxeles
 * @returns {{ marco: { x: number, y: number, ancho: number, alto: number, rgb: number[] },
 *            interior: { x: number, y: number, ancho: number, alto: number, rgb: number[] } }}
 */
export function rectangulosDeRostro(semilla, { x, y, lado }) {
    if (![x, y, lado].every(Number.isFinite)) throw new TypeError('x, y y lado deben ser números.');
    if (lado < LADO_MINIMO) throw new RangeError(`El lado debe ser de al menos ${LADO_MINIMO} px para que se detecte.`);
    return {
        marco: { x, y, ancho: lado, alto: lado, rgb: [...COLOR_MARCO] },
        interior: {
            x: x + GROSOR_MARCO,
            y: y + GROSOR_MARCO,
            ancho: lado - 2 * GROSOR_MARCO,
            alto: lado - 2 * GROSOR_MARCO,
            rgb: colorDeSemilla(semilla),
        },
    };
}

/** 'rgb(r, g, b)' para fillStyle de un canvas. */
export const cssRgb = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

/**
 * Reparte `cantidad` rostros en una cuadrícula centrada dentro de un fotograma, sin que se toquen (el detector los
 * uniría en un solo componente si los marcos quedaran pegados) ni salgan del encuadre.
 * @param {number} cantidad
 * @param {number} ancho ancho del fotograma en px
 * @param {number} alto alto del fotograma en px
 * @param {number} lado lado de cada rostro en px
 * @param {number} [separacion] hueco mínimo entre rostros y con el borde, en px
 * @returns {{ x: number, y: number }[]} esquinas superiores izquierdas, en orden de lectura
 * @throws {RangeError} si no caben
 */
export function posicionesDeRostros(cantidad, ancho, alto, lado, separacion = 16) {
    if (!Number.isInteger(cantidad) || cantidad < 0) throw new TypeError('cantidad debe ser un entero >= 0.');
    if (cantidad === 0) return [];
    const celda = lado + separacion;
    const columnas = Math.floor((ancho - separacion) / celda);
    const filas = Math.floor((alto - separacion) / celda);
    if (columnas < 1 || filas < 1 || columnas * filas < cantidad) {
        throw new RangeError(`No caben ${cantidad} rostros de ${lado} px en un fotograma de ${ancho}x${alto}.`);
    }
    // Se usan las columnas justas para que la última fila no quede muy vacía y el conjunto se vea centrado.
    const usadas = Math.min(columnas, cantidad);
    const filasUsadas = Math.ceil(cantidad / usadas);
    const ancho0 = usadas * celda - separacion;
    const alto0 = filasUsadas * celda - separacion;
    const x0 = Math.floor((ancho - ancho0) / 2);
    const y0 = Math.floor((alto - alto0) / 2);
    return Array.from({ length: cantidad }, (_, i) => ({
        x: x0 + (i % usadas) * celda,
        y: y0 + Math.floor(i / usadas) * celda,
    }));
}
