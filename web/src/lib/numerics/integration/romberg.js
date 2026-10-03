import { evaluarFinito, validarFuncion, validarNumero } from '../common/validar.js';

/**
 * Integración de Romberg: trapecios con 2^i subintervalos (columna 0) y extrapolación de Richardson
 *   R[i][j] = (4^j·R[i][j-1] - R[i-1][j-1]) / (4^j - 1)
 *
 * @param {(x: number) => number} f
 * @param {number} a
 * @param {number} b
 * @param {{niveles?: number, tolerancia?: number}} [opciones] niveles máximos (filas) y tolerancia de paro
 * @returns {{valor: number, error: number, tabla: number[][], niveles: number, convergio: boolean, evaluaciones: number,
 *   pasos: import('../common/validar.js').Paso[]}}
 */
export function romberg(f, a, b, opciones = {}) {
    validarFuncion(f);
    validarNumero(a, 'a');
    validarNumero(b, 'b');
    if (!(b > a)) {
        throw new RangeError('Se requiere a < b.');
    }
    const maxNiveles = opciones.niveles ?? 8;
    const tolerancia = opciones.tolerancia ?? 1e-10;
    if (!Number.isInteger(maxNiveles) || maxNiveles < 2 || maxNiveles > 20) {
        throw new RangeError('Los niveles deben ser un entero entre 2 y 20.');
    }
    validarNumero(tolerancia, 'tolerancia');
    const tabla = [];
    let evaluaciones = 2;
    let h = b - a;
    tabla.push([(h / 2) * (evaluarFinito(f, a) + evaluarFinito(f, b))]);
    let error = Infinity;
    let convergio = false;
    for (let i = 1; i < maxNiveles; i += 1) {
        h /= 2;
        // Solo se evalúan los puntos nuevos (puntos medios); los anteriores se reutilizan.
        let nuevos = 0;
        const pasos = 2 ** (i - 1);
        for (let k = 1; k <= pasos; k += 1) {
            nuevos += evaluarFinito(f, a + (2 * k - 1) * h);
            evaluaciones += 1;
        }
        const fila = [tabla[i - 1][0] / 2 + h * nuevos];
        for (let j = 1; j <= i; j += 1) {
            const c = 4 ** j;
            fila.push((c * fila[j - 1] - tabla[i - 1][j - 1]) / (c - 1));
        }
        tabla.push(fila);
        error = Math.abs(fila[i] - tabla[i - 1][i - 1]);
        if (error < tolerancia) {
            convergio = true;
            break;
        }
    }
    const ult = tabla.length - 1;
    return {
        valor: tabla[ult][ult],
        error,
        tabla,
        niveles: tabla.length,
        convergio,
        evaluaciones,
        pasos: [{
            titulo: 'Tabla de Romberg',
            texto: 'Columna 0: trapecio con 2^i subintervalos; las siguientes aplican extrapolación de Richardson.',
            tabla: {
                columnas: ['i', ...tabla.map((_, j) => `R(i,${j})`)],
                filas: tabla.map((fila, i) => [i, ...tabla.map((_, j) => (j < fila.length ? fila[j] : null))]),
            },
            valores: [{ etiqueta: 'integral', valor: tabla[ult][ult] }, { etiqueta: 'error estimado', valor: error }],
        }],
    };
}
