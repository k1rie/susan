// Texto de apoyo de los contadores del panel del docente: dice QUÉ se espera de él con la misma cifra que la tarjeta muestra, así el
// estado no depende solo del color ámbar (singular/plural incluidos). Sin pendientes no hay acción que pedir.
export function apoyoPendiente(cantidad, accion) {
    const n = Number(cantidad);
    if (!(n > 0)) return 'Nada pendiente';
    return `${n === 1 ? 'Espera' : 'Esperan'} tu ${accion}`;
}

// La base entrega enteros, pero un `null` o un texto no deben dejar la tarjeta sin cifra: se cuentan como 0.
export function cantidadSegura(valor) {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? n : 0;
}
