// Utilidades compartidas por los catálogos de administración.

/** Texto de un error de acción para mostrar al usuario (ApiError.message ya viene en español del servidor). */
export const mensajeDeError = (e) => e?.message || 'No se pudo completar la acción.';

/** Quita espacios y devuelve null si queda vacío (los opcionales no se mandan como cadena vacía). */
export const textoONulo = (v) => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
};

const ENTERO = /^\d+$/;
/** true si `v` es un entero entre min y max (ambos inclusive). */
export const enteroEnRango = (v, min, max) => {
    const t = String(v ?? '').trim();
    if (!ENTERO.test(t)) return false;
    const n = Number(t);
    return n >= min && n <= max;
};

export const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
