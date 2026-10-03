import { validarNumero } from '../common/validar.js';
import { biseccion } from '../rootfinding/metodos.js';
import { newtonRaphson } from '../rootfinding/metodos.js';

/**
 * Convierte un instante continuo t (en semanas) a la semana entera en que se alcanza el límite
 * (la primera semana cuyo cierre ya lo supera). La tolerancia evita que 13.0000000001 pase a 14.
 * @param {number} t
 */
export function semanaDeCruce(t) {
    return Math.ceil(t - 1e-6);
}

/**
 * Busca cuándo el ajuste f(t) alcanza el límite resolviendo g(t) = f(t) - límite = 0.
 * 1) Si g(desde) >= 0 el límite ya está superado.
 * 2) Se barre [desde, hasta] con paso `paso` para encontrar el primer cambio de signo (corchete).
 * 3) Se refina con bisección (siempre converge) y, como contraste didáctico, con Newton-Raphson
 *    (derivada analítica del modelo) partiendo del centro del corchete.
 *
 * @param {{predecir: (t: number) => number, derivada: (t: number) => number}} modelo
 * @param {number} limite
 * @param {{desde: number, hasta: number, paso?: number, tolerancia?: number}} opciones
 * @returns {{estado: 'superado'|'cruza'|'no_cruza', t: number|null, semana: number|null,
 *   corchete: [number, number]|null, biseccion: import('../rootfinding/metodos.js').ResultadoRaiz|null,
 *   newton: (import('../rootfinding/metodos.js').ResultadoRaiz & {aviso?: string})|null}}
 */
export function buscarCruce(modelo, limite, opciones) {
    validarNumero(limite, 'limite');
    const { desde, hasta } = opciones;
    const paso = opciones.paso ?? 0.25;
    const tolerancia = opciones.tolerancia ?? 1e-8;
    validarNumero(desde, 'desde');
    validarNumero(hasta, 'hasta');
    validarNumero(paso, 'paso');
    if (!(hasta > desde) || paso <= 0) {
        throw new RangeError('Se requiere hasta > desde y paso > 0.');
    }
    const g = (t) => modelo.predecir(t) - limite;
    if (g(desde) >= 0) {
        return { estado: 'superado', t: desde, semana: semanaDeCruce(desde), corchete: null, biseccion: null, newton: null };
    }
    let previo = desde;
    for (let t = desde + paso; ; t += paso) {
        const actual = Math.min(t, hasta);
        if (g(actual) >= 0) {
            const bis = biseccion(g, previo, actual, { tolerancia });
            let newton = null;
            try {
                newton = newtonRaphson(g, (previo + actual) / 2, { df: modelo.derivada, tolerancia, maxIter: 50 });
            } catch (e) {
                // La derivada nula no invalida el cruce (ya lo da la bisección); solo se informa.
                newton = { raiz: NaN, iteraciones: 0, convergio: false, error: NaN, traza: [], aviso: e.message };
            }
            return { estado: 'cruza', t: bis.raiz, semana: semanaDeCruce(bis.raiz), corchete: [previo, actual], biseccion: bis, newton };
        }
        if (actual >= hasta) {
            break;
        }
        previo = actual;
    }
    return { estado: 'no_cruza', t: null, semana: null, corchete: null, biseccion: null, newton: null };
}
