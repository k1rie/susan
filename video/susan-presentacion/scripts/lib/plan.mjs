// plan.mjs - lectura de v2/plan.json y calculo de la linea de tiempo (compartido por validate-plan, build-index y frame-check).
//
// Un cuadro dura `duration` s propios (incluye solape de entrada y de salida). El cuadro i empieza en
//   inicio_i = inicio_(i-1) + duration_(i-1) - dur_transicion_(i-1)
// y el total es la suma de duraciones menos la suma de solapes.
import { existsSync, readFileSync } from 'node:fs';

export const TIPOS = ['cut', 'flash', 'push', 'whip', 'zoom', 'squeeze', 'iris', 'wipe', 'over', 'match'];
export const DIRS = ['left', 'right', 'up', 'down'];
export const VERBOS_CAMARA = ['snap', 'pull-back', 'pan', 'tilt', 'whip', 'push-fast', 'dolly', 'orbit', 'none'];
// Tipos "de corte seco" (sin solape que descubra nada): se agrupan para la regla de "<= 2 cortes seguidos".
export const SECOS = new Set(['cut', 'match', 'flash']);
// Rangos de 'dur' (solape en s) por tipo: [min, max]
export const RANGO_DUR = {
    cut: [0, 0], match: [0, 0], flash: [0.07, 0.15], push: [0.35, 0.9], whip: [0.2, 0.35], zoom: [0.3, 0.8],
    squeeze: [0.3, 0.5], iris: [0.4, 0.9], wipe: [0.35, 0.8], over: [0.2, 0.5],
};

export function cargarPlan(ruta) {
    if (!existsSync(ruta)) throw new Error(`No existe el plan: ${ruta}`);
    try {
        return JSON.parse(readFileSync(ruta, 'utf8'));
    } catch (e) {
        throw new Error(`El plan no es JSON valido (${ruta}): ${e.message}`);
    }
}

const r3 = (x) => Math.round(x * 1000) / 1000;

// Devuelve { total, cuadros: [{ id, i, duracion, inicio, fin, solapeEntrada, solapeSalida, utilFin, esFinal, transSalida, transEntrada }] }
export function linea(plan) {
    const frames = plan.frames ?? [];
    const trans = plan.transitions ?? [];
    const cuadros = [];
    let inicio = 0;
    frames.forEach((f, i) => {
        const tIn = i > 0 ? trans[i - 1] : null;
        const tOut = i < frames.length - 1 ? trans[i] : null;
        const solapeEntrada = tIn ? Number(tIn.dur) || 0 : 0;
        const solapeSalida = tOut ? Number(tOut.dur) || 0 : 0;
        const dur = Number(f.duration);
        cuadros.push({
            id: f.id, i, duracion: dur, inicio: r3(inicio), fin: r3(inicio + dur), solapeEntrada, solapeSalida,
            utilFin: r3(dur - solapeSalida), esFinal: i === frames.length - 1, transSalida: tOut, transEntrada: tIn,
        });
        inicio = inicio + dur - solapeSalida;
    });
    return { total: r3(inicio), cuadros };
}
