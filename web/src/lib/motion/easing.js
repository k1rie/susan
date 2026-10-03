// Curvas y duraciones de SUSAN (ver docs/design/SISTEMA.md, "Movimiento"). Solo propiedades baratas para el
// compositor: opacity y transform (y un blur breve en titulares). Nada de animar width/height/top/left.
export const EASE = {
    // Entrada con frenado largo: la sensación "fluida" de SchoolAI.
    salida: 'cubic-bezier(0.22, 1, 0.36, 1)',
    // Cambios de estado (hover, foco, pestañas).
    suave: 'cubic-bezier(0.4, 0, 0.2, 1)',
    // Rebote leve para confirmaciones (check, insignias).
    resorte: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// Segundos.
export const DURACION = { rapida: 0.2, media: 0.5, lenta: 0.9 };

// Easing numérico para los contadores (easeOutCubic): t en [0, 1] -> [0, 1].
export function salidaCubica(t) {
    const x = Math.min(1, Math.max(0, t));
    return 1 - (1 - x) ** 3;
}
