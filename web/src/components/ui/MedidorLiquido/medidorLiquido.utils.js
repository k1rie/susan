import { formatoPct } from '@/lib/graficas.js';

const entre = (v, a, b) => Math.min(b, Math.max(a, v));

/** Nivel del medidor: número 0-100 con a lo más 1 decimal (el mismo que muestran la cifra y el nombre accesible). Lo no numérico -> 0. */
export function nivelMedidor(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return 0;
    return Number(entre(n, 0, 100).toFixed(1));
}

/**
 * Normaliza la marca de límite { valor, etiqueta }: valor 0-100 y etiqueta de texto (si falta, «Límite 80 %»). Sin valor numérico
 * (null, '', NaN, objeto ausente) no hay marca: null.
 */
export function limiteMedidor(limite) {
    if (!limite || typeof limite !== 'object') return null;
    const { valor, etiqueta } = limite;
    if (valor === null || valor === undefined || valor === '') return null;
    const n = Number(valor);
    if (!Number.isFinite(n)) return null;
    const v = Number(entre(n, 0, 100).toFixed(1));
    const texto = typeof etiqueta === 'string' ? etiqueta.trim() : '';
    return { valor: v, etiqueta: texto || `Límite ${formatoPct(v)}` };
}
