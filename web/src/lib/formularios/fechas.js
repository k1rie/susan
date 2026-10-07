// Fechas de formulario como texto AAAA-MM-DD (el formato de <input type="date"> y de las RPC). Todo el cálculo es de calendario
// (sin hora ni zona), así que no hay saltos por horario de verano ni por UTC; "hoy" sí depende del reloj del navegador, por eso
// las pantallas pueden pasar su propio "hoy" (por ejemplo el del servidor o el del reloj de demostración).

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DIA = 86_400_000;

const dos = (n) => String(n).padStart(2, '0');
const aTexto = (ms) => {
    const d = new Date(ms);
    return `${String(d.getUTCFullYear()).padStart(4, '0')}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
};

/** Parte una fecha AAAA-MM-DD en { anio, mes, dia } o devuelve null si no es una fecha real (rechaza 2026-02-30). */
export function partesFecha(valor) {
    const m = FECHA_ISO.exec(String(valor ?? ''));
    if (!m) return null;
    const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const d = new Date(Date.UTC(anio, mes - 1, dia));
    if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
    return { anio, mes, dia };
}

/** true si el texto es una fecha real AAAA-MM-DD. */
export function esFechaISO(valor) {
    return partesFecha(valor) !== null;
}

/** Fecha local de hoy como AAAA-MM-DD (no usa UTC: a las 23:00 en México sigue siendo "hoy"). */
export function hoyLocal(fecha = new Date()) {
    return `${String(fecha.getFullYear()).padStart(4, '0')}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

function msUTC(valor) {
    const p = partesFecha(valor);
    return p ? Date.UTC(p.anio, p.mes - 1, p.dia) : null;
}

/** Suma `n` días (puede ser negativo). Devuelve '' si la fecha de partida no es válida. */
export function sumarDias(valor, n) {
    const ms = msUTC(valor);
    return ms === null ? '' : aTexto(ms + n * MS_DIA);
}

/** Suma `n` meses; si el día no existe en el mes destino queda en su último día (31 ene + 1 mes = 28 feb). */
export function sumarMeses(valor, n) {
    const p = partesFecha(valor);
    if (!p) return '';
    const indice = p.anio * 12 + (p.mes - 1) + n;
    const anio = Math.floor(indice / 12);
    const mes = indice - anio * 12;
    const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
    return aTexto(Date.UTC(anio, mes, Math.min(p.dia, ultimo)));
}

/** Suma `n` años (29 feb + 1 año = 28 feb). */
export function sumarAnios(valor, n) {
    return sumarMeses(valor, n * 12);
}

/** Compara dos fechas: negativo si a < b, 0 si iguales, positivo si a > b. Una fecha inválida cuenta como vacía y devuelve 0. */
export function compararFechas(a, b) {
    const x = msUTC(a);
    const y = msUTC(b);
    if (x === null || y === null) return 0;
    return Math.sign(x - y);
}

/** Días de calendario de `desde` a `hasta` (hasta - desde); null si alguna no es válida. */
export function diasEntre(desde, hasta) {
    const x = msUTC(desde);
    const y = msUTC(hasta);
    return x === null || y === null ? null : Math.round((y - x) / MS_DIA);
}

/** Acota una fecha al intervalo [min, max]; los extremos vacíos no acotan. */
export function acotarFecha(valor, { min, max } = {}) {
    if (!esFechaISO(valor)) return valor;
    if (esFechaISO(min) && compararFechas(valor, min) < 0) return min;
    if (esFechaISO(max) && compararFechas(valor, max) > 0) return max;
    return valor;
}

const FORMATO_LARGO = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const FORMATO_CORTO = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "lunes, 5 de octubre de 2026"; cadena vacía si la fecha no es válida. */
export function formatearFechaLarga(valor) {
    const ms = msUTC(valor);
    return ms === null ? '' : FORMATO_LARGO.format(new Date(ms));
}

/** "5 oct 2026"; cadena vacía si la fecha no es válida. */
export function formatearFechaCorta(valor) {
    const ms = msUTC(valor);
    return ms === null ? '' : FORMATO_CORTO.format(new Date(ms));
}
