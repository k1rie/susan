// Tonos de estado de asistencia (tokens de globals.css). Siempre van con el texto de la opción: el color nunca es el único canal.
export const TONOS = {
    presente: { punto: 'bg-presente', activo: 'border-presente/40 bg-presente-bg text-presente' },
    retardo: { punto: 'bg-retardo', activo: 'border-retardo/40 bg-retardo-bg text-retardo' },
    ausente: { punto: 'bg-ausente', activo: 'border-ausente/40 bg-ausente-bg text-ausente' },
    justificado: { punto: 'bg-justificado', activo: 'border-justificado/40 bg-justificado-bg text-justificado' },
    pendiente: { punto: 'bg-pendiente', activo: 'border-pendiente/40 bg-pendiente-bg text-pendiente' },
};

// Alto y tamaño de letra por tamaño. El relleno horizontal va aparte (RELLENO) porque a ancho completo es menor: así no hay dos
// clases `px-*` en conflicto y el consumidor puede afinarlo con `[&>button]:px-*` (la variante gana por especificidad).
export const TAMANOS = {
    sm: 'min-h-9 text-[13px]',
    md: 'min-h-11 text-sm',
};

// Relleno horizontal de cada opción. A ancho completo las opciones se reparten un ancho fijo (p. ej. un tercio de 296 px en un panel
// a 360 px de pantalla), así que el relleno holgado de `inline` le quita a «Mantenimiento» el espacio que necesita para caber.
export const RELLENO = {
    sm: 'px-3',
    md: 'px-4',
};

export const RELLENO_ANCHO_COMPLETO = {
    sm: 'px-2',
    md: 'px-2.5',
};

// Índice de la opción a la que lleva una tecla (flechas, Inicio, Fin), saltando las deshabilitadas y dando la vuelta.
// Devuelve -1 si la tecla no navega o no hay a dónde ir.
export function destinoDeTecla(items, indiceActual, tecla, deshabilitadoTodo = false) {
    if (deshabilitadoTodo) return -1;
    const habilitado = (i) => !items[i].disabled;
    const n = items.length;
    if (tecla === 'Home') return items.findIndex((_, i) => habilitado(i));
    if (tecla === 'End') {
        for (let i = n - 1; i >= 0; i -= 1) if (habilitado(i)) return i;
        return -1;
    }
    const paso = tecla === 'ArrowRight' || tecla === 'ArrowDown' ? 1 : tecla === 'ArrowLeft' || tecla === 'ArrowUp' ? -1 : 0;
    if (paso === 0) return -1;
    for (let k = 1; k <= n; k += 1) {
        const i = (((indiceActual + paso * k) % n) + n) % n;
        if (habilitado(i)) return i;
    }
    return -1;
}

// Qué opción es tabulable: la elegida, o la primera habilitada si no hay ninguna elegida (patrón de roving tabindex).
export function indiceTabulable(items, value, deshabilitadoTodo = false) {
    if (deshabilitadoTodo) return -1;
    const elegido = items.findIndex((it) => String(it.value) === String(value) && !it.disabled);
    return elegido >= 0 ? elegido : items.findIndex((it) => !it.disabled);
}
