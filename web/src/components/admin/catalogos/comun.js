// Utilidades compartidas por los catálogos de administración.
import { mayusculas, soloAlfanumerico, sinAcentos } from '@/lib/formularios';

/** Texto de un error de acción para mostrar al usuario (ApiError.message ya viene en español del servidor). */
export const mensajeDeError = (e) => e?.message || 'No se pudo completar la acción.';

/** Quita espacios y devuelve null si queda vacío (los opcionales no se mandan como cadena vacía). */
export const textoONulo = (v) => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
};

/**
 * Pega un error del servidor al campo que lo causó (campos A01: el error vive junto a su campo, con foco en él).
 * `reglas` se evalúa en orden y gana la primera que coincide: `{ codigo?, patron?, campo }`; `codigo` compara con
 * `error.code` y `patron` (RegExp) con `error.message`. El texto que se muestra es el del servidor, que ya viene en
 * español y dice qué valor chocó («Ya existe un aula con la clave A-12.»). Devuelve `{ campo: mensaje }` o `null`
 * si ninguna regla aplica (entonces el error es general y va al aviso del formulario).
 */
export function campoDeError(error, reglas) {
    if (!error) return null;
    const mensaje = mensajeDeError(error);
    const regla = reglas.find((r) => (!r.codigo || r.codigo === error.code) && (!r.patron || r.patron.test(mensaje)));
    return regla ? { [regla.campo]: mensaje } : null;
}

/**
 * Código en mayúsculas y solo letras y dígitos (número de empleado, clave de materia): quita espacios, guiones y acentos
 * («d-001 » -> «D001», «Álgebra» -> «ALGEBRA»). Se aplica al salir del campo, nunca mientras se escribe. Los acentos se
 * convierten antes de filtrar para no perder la letra («ÁDM101» -> «ADM101», no «DM101»).
 */
export const normalizarCodigo = (v) => mayusculas(soloAlfanumerico(sinAcentos(v)));
