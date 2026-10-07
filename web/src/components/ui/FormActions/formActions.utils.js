// Texto del indicador de cambios. `dirty` puede ser un booleano o el número de campos cambiados (de useFormulario).
export function textoCambios(dirty, dirtyText) {
    const hay = typeof dirty === 'number' ? dirty > 0 : Boolean(dirty);
    if (!hay) return null;
    if (dirtyText) return dirtyText;
    if (typeof dirty === 'number') return dirty === 1 ? '1 cambio sin guardar' : `${dirty} cambios sin guardar`;
    return 'Cambios sin guardar';
}

export const ALINEACION = {
    end: 'sm:justify-end',
    start: 'sm:justify-start',
    center: 'sm:justify-center',
    between: 'sm:justify-between',
};

// Cómo se pega la barra. 'movil' (por omisión): por debajo de `lg` se queda a la vista, por encima de la barra inferior de navegación
// del AppShell (alto 5,25 rem + margen o área segura); desde `lg` es una fila normal al final del formulario. 'contenedor': pegada al
// borde inferior del contenedor con scroll (Modal, PanelLateral o una página sin barra inferior), en cualquier ancho. false: fila normal.
export const PEGADO = {
    movil:
        'sticky bottom-[calc(5.25rem+max(0.75rem,env(safe-area-inset-bottom)))] z-30 rounded-xl border border-border bg-card p-3 ' +
        'lg:static lg:z-auto lg:rounded-none lg:border-0 lg:border-t lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-4',
    contenedor: 'sticky bottom-0 z-10 border-t border-border bg-card pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
    ninguno: 'border-t border-border pt-4',
};
