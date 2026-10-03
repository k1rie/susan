// Iniciales para el avatar: primera letra de las dos primeras palabras ("Ortega Salinas Patricia" -> "OS").
export function iniciales(nombre) {
    const palabras = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return '?';
    return palabras.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

// Colores sólidos del avatar (contraste AA con texto blanco). El mismo nombre siempre sale con el mismo color; la persona
// puede elegir otro en el onboarding (preferencia de perfil).
export const TINTES = ['#e5501e', '#0b6bcb', '#1f7a47', '#6f4fb3', '#b4551a', '#0e7490', '#a21caf', '#475569'];
export function tinteDe(nombre) {
    let h = 0;
    for (const c of String(nombre ?? '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return TINTES[h % TINTES.length];
}
