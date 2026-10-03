import { validarNumero, validarParejas } from '../common/validar.js';
import { ajustarCandidatos, elegirModelo, intervaloPrediccion } from './modelos.js';

/**
 * Ajusta candidatos, elige el mejor por validación cruzada y proyecta `horizonte` pasos con intervalo.
 *
 * @param {{x: number[], y: number[], horizonte?: number, paso?: number, grados?: number[]}} entrada
 * @returns {{candidatos: import('./modelos.js').Candidato[], elegido: import('./modelos.js').Candidato,
 *   modelo: import('../regression/minimosCuadrados.js').AjustePolinomial, razon: string,
 *   ajustados: {x: number, valor: number}[], puntos: {x: number, valor: number, inferior: number, superior: number}[]}}
 */
export function proyectarSerie({ x, y, horizonte = 4, paso = 1, grados }) {
    validarParejas(x, y, 2);
    validarNumero(horizonte, 'horizonte');
    validarNumero(paso, 'paso');
    if (!Number.isInteger(horizonte) || horizonte < 0 || paso <= 0) {
        throw new RangeError('El horizonte debe ser un entero >= 0 y el paso positivo.');
    }
    const candidatos = ajustarCandidatos(x, y, { grados });
    const { elegido, razon } = elegirModelo(candidatos);
    const modelo = elegido.ajuste;
    const ultimo = x[x.length - 1];
    const puntos = [];
    for (let k = 1; k <= horizonte; k += 1) {
        const xp = ultimo + k * paso;
        const iv = intervaloPrediccion(modelo, xp);
        puntos.push({ x: xp, valor: iv.valor, inferior: iv.inferior, superior: iv.superior });
    }
    return {
        candidatos,
        elegido,
        modelo,
        razon,
        ajustados: x.map((xv, i) => ({ x: xv, valor: modelo.ajustados[i] })),
        puntos,
    };
}
