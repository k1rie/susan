// Iniciales para el avatar: primera letra de las dos primeras palabras ("Ortega Salinas Patricia" -> "OS").
export function iniciales(nombre) {
    const palabras = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return '?';
    return palabras.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

// Tinte estable por nombre (hash simple) entre los colores de gráfica: el mismo alumno siempre sale igual.
export const TINTES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-5)'];
export function tinteDe(nombre) {
    let h = 0;
    for (const c of String(nombre ?? '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return TINTES[h % TINTES.length];
}
