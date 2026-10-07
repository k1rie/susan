// Normalización y validación de conveniencia de texto para formularios. La validación real es de la base de datos
// (RPC/CHECK): aquí solo se evita el viaje de ida y vuelta y se guía a la persona mientras escribe.

const MARCAS_COMBINANTES = /\p{M}/gu;

const comoTexto = (v) => String(v ?? '');

/** Quita las marcas diacríticas ("Analítica" -> "Analitica", "Peña" -> "Pena"). Conserva mayúsculas y minúsculas. */
export function sinAcentos(valor) {
    return comoTexto(valor).normalize('NFD').replace(MARCAS_COMBINANTES, '');
}

/** Forma canónica para buscar: sin acentos, en minúsculas y sin espacios en los extremos. */
export function normalizarBusqueda(valor) {
    return sinAcentos(valor).toLowerCase().trim();
}

/** Pasa a mayúsculas (la base guarda matrícula, claves y número de empleado en mayúsculas). */
export function mayusculas(valor) {
    return comoTexto(valor).toUpperCase();
}

/** Pasa a minúsculas (el servidor guarda el correo en minúsculas). */
export function minusculas(valor) {
    return comoTexto(valor).toLowerCase();
}

/**
 * Quita espacios de los extremos. Con `colapsar` además reduce los espacios repetidos del interior a uno solo
 * (útil en nombres: "Ana   María" -> "Ana María").
 */
export function recortar(valor, { colapsar = false } = {}) {
    const texto = comoTexto(valor).trim();
    return colapsar ? texto.replace(/\s+/g, ' ') : texto;
}

/** Deja solo los dígitos 0-9 (pegar "  123-45 " produce "12345"). */
export function soloDigitos(valor) {
    return comoTexto(valor).replace(/\D/g, '');
}

/** Deja solo letras ASCII y dígitos: es lo que admiten matrícula, número de empleado y claves de materia. */
export function soloAlfanumerico(valor) {
    return comoTexto(valor).replace(/[^A-Za-z0-9]/g, '');
}

// Misma regla que `api_alumno_guardar` y compañía (0201_admin_catalogos.sql): algo@dominio.tld sin espacios ni otra @.
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_CORREO = 120;

/** true si el texto (sin espacios en los extremos) tiene forma de correo y cabe en la columna (120). */
export function esCorreo(valor) {
    const t = comoTexto(valor).trim();
    return t.length > 0 && t.length <= MAX_CORREO && CORREO.test(t);
}

const ENTERO = /^\d+$/;

/** true si `valor` es un entero (solo dígitos) entre `min` y `max`, ambos inclusive. Admite texto o número. */
export function enteroEnRango(valor, min, max) {
    const t = comoTexto(valor).trim();
    if (!ENTERO.test(t)) return false;
    const n = Number(t);
    return n >= min && n <= max;
}
