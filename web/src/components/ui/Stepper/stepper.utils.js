// Normaliza los pasos: calcula el índice actual y el estado de cada uno (a menos que el paso traiga el suyo).
//   current: id del paso actual, o su índice. Un índice igual al total deja todos los pasos como hechos (flujo terminado).
export function normalizarPasos(steps, current) {
    const total = steps.length;
    let actual;
    if (typeof current === 'number') actual = Math.min(Math.max(current, 0), total);
    else {
        const i = steps.findIndex((s) => s.id === current);
        actual = i === -1 ? 0 : i;
    }
    const pasos = steps.map((s, i) => ({
        ...s,
        indice: i,
        estado: s.estado ?? (i < actual ? 'hecho' : i === actual ? 'actual' : 'pendiente'),
    }));
    return { pasos, indiceActual: actual, total };
}

export function textoPaso(indice, total, etiqueta) {
    return `Paso ${indice + 1} de ${total}${etiqueta ? ` · ${etiqueta}` : ''}`;
}

export const TEXTO_ESTADO = {
    hecho: 'completado',
    actual: 'paso actual',
    pendiente: 'pendiente',
    error: 'con errores',
    omitido: 'omitido',
};

// Segmento de la barra compacta (mismo vocabulario que BarraPasos del registro facial) y círculo de la versión ancha.
export const CLASE_SEGMENTO = {
    hecho: 'bg-foreground',
    actual: 'bg-foreground/40',
    error: 'bg-ausente',
    omitido: 'bg-border opacity-50',
    pendiente: 'bg-border',
};

export const CLASE_CIRCULO = {
    hecho: 'bg-foreground text-background',
    actual: 'border-2 border-foreground text-foreground',
    error: 'border-2 border-ausente text-ausente',
    omitido: 'border border-dashed border-input text-muted-foreground',
    pendiente: 'border border-input text-muted-foreground',
};
