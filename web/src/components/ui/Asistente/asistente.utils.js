// Utilidades puras del Asistente (sin React).

export const ID_REVISION = 'revision';

// `validarPaso(id)` puede devolver: true / undefined / null / {} (todo bien), false (mal, sin detalle), un texto (mal, con ese mensaje) o un
// objeto { campo: 'mensaje' } con errores (mal). Devuelve { ok, mensajes } con los mensajes ya listos para el resumen de errores.
export function resultadoDeValidacion(resultado) {
    if (resultado === true || resultado == null) return { ok: true, mensajes: [] };
    if (resultado === false) return { ok: false, mensajes: [] };
    if (typeof resultado === 'string') return resultado.trim() ? { ok: false, mensajes: [resultado] } : { ok: true, mensajes: [] };
    if (typeof resultado === 'object') {
        const mensajes = Object.values(resultado)
            .filter((v) => (typeof v === 'string' ? v.trim() !== '' : Boolean(v)))
            .map(String);
        return { ok: mensajes.length === 0, mensajes };
    }
    return { ok: true, mensajes: [] };
}

// Pasos que ve el Stepper: los del asistente y, si hay `resumen`, uno final de revisión.
// La descripción de cada paso NO va al Stepper: el asistente ya la escribe bajo el título del paso y no debe repetirse en pantalla.
export function pasosParaStepper(pasos, conRevision, { indice, maxAlcanzado, omitidos, tituloRevision = 'Revisión' }) {
    const lista = pasos.map((p, i) => ({
        id: p.id,
        label: p.titulo,
        estado: estadoPaso(i, indice, maxAlcanzado, omitidos.has(p.id)),
    }));
    if (conRevision) lista.push({ id: ID_REVISION, label: tituloRevision, estado: estadoPaso(pasos.length, indice, maxAlcanzado, false) });
    return lista;
}

export function estadoPaso(i, indice, maxAlcanzado, omitido) {
    if (i === indice) return 'actual';
    if (i <= maxAlcanzado) return omitido ? 'omitido' : 'hecho';
    return 'pendiente';
}

// Texto de un valor en la revisión: lo vacío se dice «Sin especificar» (nunca queda una fila en blanco que parezca un error).
export function textoValor(valor) {
    if (valor == null || valor === '') return null;
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    if (Array.isArray(valor)) return valor.length ? valor.map(String).join(', ') : null;
    return String(valor);
}

// Secciones de la revisión: tolera que `resumen` devuelva undefined o filas incompletas.
export function normalizarSecciones(secciones) {
    return (secciones ?? []).filter(Boolean).map((s, i) => ({
        id: s.id ?? `seccion-${i}`,
        titulo: s.titulo,
        paso: s.paso,
        filas: (s.filas ?? []).filter(Boolean),
    }));
}
