/**
 * Id de un parámetro de la URL (?materia=3): entero positivo o undefined. Cualquier otra cosa (texto, 0, negativos, decimales, varios valores)
 * se ignora sin error: el asistente simplemente abre vacío.
 */
export function idPositivo(valor) {
    if (typeof valor !== 'string' || !/^\d{1,9}$/.test(valor.trim())) return undefined;
    const n = Number(valor);
    return n > 0 ? n : undefined;
}

/** Opción del catálogo cargado con ese id (value es texto), o undefined si el id no existe: entonces no se preselecciona nada. */
export function opcionPorId(opciones = [], id) {
    return id == null ? undefined : opciones.find((o) => o.value === String(id));
}
