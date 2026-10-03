// Estados que el docente puede asignar a un pendiente o corregir (justificado/pendiente nunca se ofrecen).
export const ESTADOS_DESTINO = ['presente', 'retardo', 'ausente'];
export const MAX_COMENTARIO = 200;

export const ETIQUETAS = { presente: 'Presente', retardo: 'Retardo', ausente: 'Ausente' };

/** Estados ofrecidos: todos menos el actual. */
export function estadosOfrecidos(estadoActual) {
    return ESTADOS_DESTINO.filter((e) => e !== estadoActual);
}

/** El sugerido solo se destaca si es un destino válido (viene del servidor, RN-03). */
export function sugerenciaValida(estadoSugerido) {
    return ESTADOS_DESTINO.includes(estadoSugerido) ? estadoSugerido : null;
}

/** Comentario opcional: vacío -> null, recortado a 200. */
export function normalizarComentario(texto) {
    const t = (texto ?? '').trim();
    return t ? t.slice(0, MAX_COMENTARIO) : null;
}

/** Texto del aviso tras resolver, con el efecto sobre el derecho a examen si cambió. */
export function mensajeResolucion(resultado, estado) {
    const base = `Resuelto como ${ETIQUETAS[estado] ?? estado}`;
    const insc = resultado?.inscripcion;
    if (insc && insc.derecho_examen === false && insc.derecho_examen_anterior === true) {
        return `${base}. El alumno queda sin derecho a examen`;
    }
    if (insc && insc.derecho_examen === true && insc.derecho_examen_anterior === false) {
        return `${base}. El alumno recupera el derecho a examen`;
    }
    return base;
}
